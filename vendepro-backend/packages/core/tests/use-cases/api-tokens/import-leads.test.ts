import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ImportLeadsUseCase, MAX_IMPORT_BATCH } from '../../../src/application/use-cases/api-tokens/import-leads'
import { ValidationError } from '../../../src/domain/errors/validation-error'

const mockLeadRepo = { findById: vi.fn(), findByOrg: vi.fn(), save: vi.fn().mockResolvedValue(undefined), delete: vi.fn() }
const mockContactRepo = { findById: vi.fn(), findByOrg: vi.fn(), save: vi.fn().mockResolvedValue(undefined), delete: vi.fn(), findWithLeadsAndProperties: vi.fn() }
const mockUserRepo = { findFirstAdminByOrg: vi.fn().mockResolvedValue({ id: 'admin-1' }) }

let idCounter = 0
const mockIds = { generate: vi.fn().mockImplementation(() => `gen-${++idCounter}`) }

describe('ImportLeadsUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    idCounter = 0
    mockIds.generate.mockImplementation(() => `gen-${++idCounter}`)
    mockLeadRepo.save.mockResolvedValue(undefined)
    mockContactRepo.save.mockResolvedValue(undefined)
    mockUserRepo.findFirstAdminByOrg.mockResolvedValue({ id: 'admin-1' })
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
})
