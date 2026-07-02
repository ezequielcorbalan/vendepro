import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ImportLeadsUseCase, MAX_IMPORT_BATCH, slugifyTag } from '../../../src/application/use-cases/api-tokens/import-leads'
import { ValidationError } from '../../../src/domain/errors/validation-error'

const mockLeadRepo = { findById: vi.fn(), findByOrg: vi.fn(), save: vi.fn().mockResolvedValue(undefined), delete: vi.fn() }
const mockContactRepo = {
  findById: vi.fn(),
  findByOrg: vi.fn(),
  findByEmailOrPhone: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn(),
  findWithLeadsAndProperties: vi.fn(),
}
const mockUserRepo = { findFirstAdminByOrg: vi.fn().mockResolvedValue({ id: 'admin-1' }) }
const mockTagRepo = {
  findByOrg: vi.fn(),
  findByLead: vi.fn(),
  findByName: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(undefined),
  addToLead: vi.fn().mockResolvedValue(undefined),
  removeFromLead: vi.fn(),
  delete: vi.fn(),
}

let idCounter = 0
const mockIds = { generate: vi.fn().mockImplementation(() => `gen-${++idCounter}`) }

describe('ImportLeadsUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    idCounter = 0
    mockIds.generate.mockImplementation(() => `gen-${++idCounter}`)
    mockLeadRepo.save.mockResolvedValue(undefined)
    mockContactRepo.save.mockResolvedValue(undefined)
    mockContactRepo.findByEmailOrPhone.mockResolvedValue(null)
    mockUserRepo.findFirstAdminByOrg.mockResolvedValue({ id: 'admin-1' })
    mockTagRepo.findByName.mockResolvedValue(null)
    mockTagRepo.save.mockResolvedValue(undefined)
    mockTagRepo.addToLead.mockResolvedValue(undefined)
  })

  it('importa un lote y devuelve resultado por item', async () => {
    const uc = new ImportLeadsUseCase(mockLeadRepo, mockContactRepo, mockUserRepo, mockIds)
    const result = await uc.execute({
      orgId: 'org_mg',
      leads: [
        { full_name: 'Ana López', phone: '111' },
        { full_name: 'Juan Pérez', email: 'juan@mail.com' },
      ],
    })

    expect(result.created).toBe(2)
    expect(result.failed).toBe(0)
    expect(result.ok).toBe(true)
    expect(mockLeadRepo.save).toHaveBeenCalledTimes(2)
    // el lead se crea SIN asignar
    const savedLead = mockLeadRepo.save.mock.calls[0][0]
    expect(savedLead.assigned_to).toBeNull()
    expect(savedLead.stage).toBe('nuevo')
    expect(savedLead.source).toBe('api')
    // el contacto sí se asigna al admin
    const savedContact = mockContactRepo.save.mock.calls[0][0]
    expect(savedContact.agent_id).toBe('admin-1')
  })

  it('un lead inválido no aborta el lote (falla sólo ese item)', async () => {
    const uc = new ImportLeadsUseCase(mockLeadRepo, mockContactRepo, mockUserRepo, mockIds)
    const result = await uc.execute({
      orgId: 'org_mg',
      leads: [{ full_name: 'Válido' }, { full_name: '' }],
    })
    expect(result.created).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.results[1].ok).toBe(false)
    expect(result.results[1].error).toBeTruthy()
  })

  it('rechaza lote vacío', async () => {
    const uc = new ImportLeadsUseCase(mockLeadRepo, mockContactRepo, mockUserRepo, mockIds)
    await expect(uc.execute({ orgId: 'org_mg', leads: [] })).rejects.toThrow(ValidationError)
  })

  it('rechaza lote mayor al máximo', async () => {
    const uc = new ImportLeadsUseCase(mockLeadRepo, mockContactRepo, mockUserRepo, mockIds)
    const many = Array.from({ length: MAX_IMPORT_BATCH + 1 }, () => ({ full_name: 'X' }))
    await expect(uc.execute({ orgId: 'org_mg', leads: many })).rejects.toThrow(ValidationError)
  })

  it('rechaza si la org no tiene admin', async () => {
    mockUserRepo.findFirstAdminByOrg.mockResolvedValue(null)
    const uc = new ImportLeadsUseCase(mockLeadRepo, mockContactRepo, mockUserRepo, mockIds)
    await expect(uc.execute({ orgId: 'org_mg', leads: [{ full_name: 'Ana' }] })).rejects.toThrow(ValidationError)
  })

  // ── Dedup de contactos ──────────────────────────────────────────

  it('reutiliza el contacto si ya existe uno con el mismo email/teléfono', async () => {
    mockContactRepo.findByEmailOrPhone.mockResolvedValue({ id: 'contact-existente' })
    const uc = new ImportLeadsUseCase(mockLeadRepo, mockContactRepo, mockUserRepo, mockIds)
    const result = await uc.execute({
      orgId: 'org_mg',
      leads: [{ full_name: 'Juan Pérez', email: 'juan@mail.com' }],
    })

    expect(result.created).toBe(1)
    expect(result.results[0].deduped).toBe(true)
    expect(result.results[0].contact_id).toBe('contact-existente')
    // NO se crea contacto nuevo
    expect(mockContactRepo.save).not.toHaveBeenCalled()
    // el lead nuevo queda vinculado al contacto existente
    const savedLead = mockLeadRepo.save.mock.calls[0][0]
    expect(savedLead.contact_id).toBe('contact-existente')
  })

  it('crea contacto nuevo cuando no hay match (deduped: false)', async () => {
    const uc = new ImportLeadsUseCase(mockLeadRepo, mockContactRepo, mockUserRepo, mockIds)
    const result = await uc.execute({
      orgId: 'org_mg',
      leads: [{ full_name: 'Ana López', email: 'ana@mail.com' }],
    })
    expect(result.results[0].deduped).toBe(false)
    expect(mockContactRepo.save).toHaveBeenCalledTimes(1)
  })

  it('no busca dedup si el lead no trae ni email ni teléfono', async () => {
    const uc = new ImportLeadsUseCase(mockLeadRepo, mockContactRepo, mockUserRepo, mockIds)
    await uc.execute({ orgId: 'org_mg', leads: [{ full_name: 'Sin Datos' }] })
    expect(mockContactRepo.findByEmailOrPhone).not.toHaveBeenCalled()
  })

  it('si la búsqueda de dedup falla, crea contacto nuevo igual (best-effort)', async () => {
    mockContactRepo.findByEmailOrPhone.mockRejectedValue(new Error('db error'))
    const uc = new ImportLeadsUseCase(mockLeadRepo, mockContactRepo, mockUserRepo, mockIds)
    const result = await uc.execute({
      orgId: 'org_mg',
      leads: [{ full_name: 'Juan', email: 'j@mail.com' }],
    })
    expect(result.created).toBe(1)
    expect(mockContactRepo.save).toHaveBeenCalledTimes(1)
  })

  // ── Tags ────────────────────────────────────────────────────────

  it('auto-crea tags nuevos (normalizados a slug) y los vincula al lead', async () => {
    const uc = new ImportLeadsUseCase(mockLeadRepo, mockContactRepo, mockUserRepo, mockIds, mockTagRepo)
    const result = await uc.execute({
      orgId: 'org_mg',
      leads: [{ full_name: 'Ana', tags: ['ZonaProp', 'Tasación Web'] }],
    })

    expect(result.created).toBe(1)
    expect(mockTagRepo.save).toHaveBeenCalledTimes(2)
    const savedTag = mockTagRepo.save.mock.calls[0][0].toObject()
    expect(savedTag.name).toBe('zonaprop')
    expect(mockTagRepo.save.mock.calls[1][0].toObject().name).toBe('tasacion-web')
    expect(mockTagRepo.addToLead).toHaveBeenCalledTimes(2)
    expect(mockTagRepo.addToLead.mock.calls[0][2]).toBe('org_mg')
  })

  it('reutiliza el tag si ya existe (case-insensitive por nombre)', async () => {
    mockTagRepo.findByName.mockResolvedValue({ id: 'tag-existente' })
    const uc = new ImportLeadsUseCase(mockLeadRepo, mockContactRepo, mockUserRepo, mockIds, mockTagRepo)
    await uc.execute({ orgId: 'org_mg', leads: [{ full_name: 'Ana', tags: ['zonaprop'] }] })

    expect(mockTagRepo.save).not.toHaveBeenCalled()
    expect(mockTagRepo.addToLead).toHaveBeenCalledWith(expect.any(String), 'tag-existente', 'org_mg')
  })

  it('un tag que falla no aborta el lead ni los demás tags', async () => {
    mockTagRepo.addToLead
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(undefined)
    const uc = new ImportLeadsUseCase(mockLeadRepo, mockContactRepo, mockUserRepo, mockIds, mockTagRepo)
    const result = await uc.execute({
      orgId: 'org_mg',
      leads: [{ full_name: 'Ana', tags: ['a', 'b'] }],
    })
    expect(result.created).toBe(1)
    expect(result.results[0].ok).toBe(true)
    expect(mockTagRepo.addToLead).toHaveBeenCalledTimes(2)
  })

  it('funciona sin tagRepo (retrocompatible) aunque el lead traiga tags', async () => {
    const uc = new ImportLeadsUseCase(mockLeadRepo, mockContactRepo, mockUserRepo, mockIds)
    const result = await uc.execute({
      orgId: 'org_mg',
      leads: [{ full_name: 'Ana', tags: ['zonaprop'] }],
    })
    expect(result.created).toBe(1)
  })

  it('ignora tags vacíos o que quedan vacíos tras normalizar', async () => {
    const uc = new ImportLeadsUseCase(mockLeadRepo, mockContactRepo, mockUserRepo, mockIds, mockTagRepo)
    await uc.execute({ orgId: 'org_mg', leads: [{ full_name: 'Ana', tags: ['', '  ', '!!!'] }] })
    expect(mockTagRepo.save).not.toHaveBeenCalled()
    expect(mockTagRepo.addToLead).not.toHaveBeenCalled()
  })

  // ── Campos extendidos ───────────────────────────────────────────

  it('pasa los campos extendidos de la propiedad al lead', async () => {
    const uc = new ImportLeadsUseCase(mockLeadRepo, mockContactRepo, mockUserRepo, mockIds)
    await uc.execute({
      orgId: 'org_mg',
      leads: [{
        full_name: 'Ana',
        property_address: 'Av. Cabildo 2345',
        neighborhood: 'Belgrano',
        property_type: 'departamento',
        budget: 185000,
        estimated_value: 190000,
        timing: 'inmediato',
      }],
    })
    const savedLead = mockLeadRepo.save.mock.calls[0][0]
    expect(savedLead.property_address).toBe('Av. Cabildo 2345')
    expect(savedLead.neighborhood).toBe('Belgrano')
    expect(savedLead.budget).toBe(185000)
    expect(savedLead.estimated_value).toBe(190000)
    expect(savedLead.timing).toBe('inmediato')
  })
})

describe('slugifyTag', () => {
  it('normaliza acentos, mayúsculas y espacios', () => {
    expect(slugifyTag('Tasación Web')).toBe('tasacion-web')
    expect(slugifyTag('ZonaProp')).toBe('zonaprop')
    expect(slugifyTag('  Meta Ads!  ')).toBe('meta-ads')
    expect(slugifyTag('ñoño')).toBe('nono')
  })

  it('devuelve vacío para entradas sin contenido alfanumérico', () => {
    expect(slugifyTag('')).toBe('')
    expect(slugifyTag('!!!')).toBe('')
  })
})
