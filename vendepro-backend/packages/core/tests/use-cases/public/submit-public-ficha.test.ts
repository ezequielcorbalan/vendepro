import { describe, it, expect, vi } from 'vitest'
import { SubmitPublicFichaUseCase } from '../../../src/application/use-cases/public/submit-public-ficha'
import { FichaLink } from '../../../src/domain/entities/ficha-link'
import { NotFoundError } from '../../../src/domain/errors/not-found'
import { ValidationError } from '../../../src/domain/errors/validation-error'

function makeLink(over: Partial<Parameters<typeof FichaLink.create>[0]> = {}) {
  return FichaLink.create({
    id: 'link-1',
    org_id: 'org-1',
    agent_id: 'agent-1',
    mode: 'open',
    slug: 'abc123def456gh',
    label: 'Bio Instagram',
    lead_id: null,
    prefill: null,
    ...over,
  })
}

/** Payload mínimo válido. */
const VALID = {
  slug: 'abc123def456gh',
  owner_name: 'Juan Pérez',
  owner_phone: '11 5555 5555',
  address: 'Av. Libertador 2340',
  neighborhood: 'Martínez',
}

function makeDeps(over: Record<string, any> = {}) {
  let idCounter = 0
  return {
    linkRepo: {
      findBySlug: vi.fn().mockResolvedValue(makeLink()),
      registerSubmission: vi.fn().mockResolvedValue(undefined),
      ...(over.linkRepo ?? {}),
    },
    fichaRepo: {
      save: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      ...(over.fichaRepo ?? {}),
    },
    leadRepo: {
      findById: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
      ...(over.leadRepo ?? {}),
    },
    contactRepo: {
      findByEmailOrPhone: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
      ...(over.contactRepo ?? {}),
    },
    userRepo: {
      findFirstAdminByOrg: vi.fn().mockResolvedValue({ id: 'admin-1' }),
      ...(over.userRepo ?? {}),
    },
    appraisalRepo: {
      save: vi.fn().mockResolvedValue(undefined),
      ...(over.appraisalRepo ?? {}),
    },
    ids: { generate: vi.fn(() => `id-${++idCounter}`) },
  }
}

function build(over: Record<string, any> = {}) {
  const d = makeDeps(over)
  const uc = new SubmitPublicFichaUseCase(
    d.linkRepo as any,
    d.fichaRepo as any,
    d.leadRepo as any,
    d.contactRepo as any,
    d.userRepo as any,
    d.appraisalRepo as any,
    d.ids as any,
  )
  return { uc, d }
}

describe('SubmitPublicFichaUseCase', () => {
  it('crea contacto, lead, ficha y tasación en borrador', async () => {
    const { uc, d } = build()
    const result = await uc.execute(VALID)

    expect(result.success).toBe(true)
    expect(d.contactRepo.save).toHaveBeenCalledOnce()
    expect(d.leadRepo.save).toHaveBeenCalledOnce()
    expect(d.fichaRepo.save).toHaveBeenCalledOnce()
    expect(d.appraisalRepo.save).toHaveBeenCalledOnce()
    expect(d.linkRepo.registerSubmission).toHaveBeenCalledWith('link-1')

    // La tasación queda linkeada a la ficha para que el agente no las una a mano.
    expect(d.fichaRepo.update).toHaveBeenCalledWith(
      result.ficha_id,
      'org-1',
      { appraisal_id: result.appraisal_id },
    )
  })

  it('la ficha queda marcada como declarada por el propietario', async () => {
    const { uc, d } = build()
    await uc.execute(VALID)

    const saved = d.fichaRepo.save.mock.calls[0][0].toObject()
    expect(saved.filled_by).toBe('propietario')
    expect(saved.submitted_at).not.toBeNull()
    expect(saved.ficha_link_id).toBe('link-1')
    expect(saved.owner_name).toBe('Juan Pérez')
  })

  it('la tasación nace en borrador y sin precio', async () => {
    const { uc, d } = build()
    await uc.execute({ ...VALID, covered_area: '78' })

    const appraisal = d.appraisalRepo.save.mock.calls[0][0].toObject()
    expect(appraisal.status).toBe('draft')
    expect(appraisal.suggested_price).toBeNull()
    expect(appraisal.covered_area).toBe(78)
    expect(appraisal.property_address).toBe('Av. Libertador 2340')
  })

  it('reutiliza el contacto existente en vez de duplicarlo', async () => {
    const { uc, d } = build({
      contactRepo: { findByEmailOrPhone: vi.fn().mockResolvedValue({ id: 'contact-9' }) },
    })
    const result = await uc.execute(VALID)

    expect(result.contact_id).toBe('contact-9')
    expect(d.contactRepo.save).not.toHaveBeenCalled()
  })

  it('un link dirigido cuelga la ficha del lead existente sin crear otro', async () => {
    const { uc, d } = build({
      linkRepo: {
        findBySlug: vi.fn().mockResolvedValue(
          makeLink({ mode: 'single', lead_id: 'lead-7' }),
        ),
      },
      leadRepo: { findById: vi.fn().mockResolvedValue({ id: 'lead-7' }) },
    })
    const result = await uc.execute(VALID)

    expect(result.lead_id).toBe('lead-7')
    expect(d.leadRepo.save).not.toHaveBeenCalled()
  })

  it('el link institucional asigna el trabajo al admin de la org', async () => {
    const { uc, d } = build({
      linkRepo: { findBySlug: vi.fn().mockResolvedValue(makeLink({ agent_id: null })) },
    })
    const result = await uc.execute(VALID)

    expect(result.agent_id).toBe('admin-1')
    expect(d.userRepo.findFirstAdminByOrg).toHaveBeenCalledWith('org-1')
  })

  it('normaliza amenities a texto separado por comas', async () => {
    const { uc, d } = build()
    await uc.execute({ ...VALID, amenities: ['Pileta', 'Parrilla', 'Seguridad 24 hs'] })

    const saved = d.fichaRepo.save.mock.calls[0][0].toObject()
    expect(saved.amenities).toBe('Pileta, Parrilla, Seguridad 24 hs')
  })

  it('baja "consultar el reglamento" a observaciones sin perder el matiz', async () => {
    const { uc, d } = build()
    await uc.execute({ ...VALID, is_professional: 'consultar', notes: 'Se pintó en marzo.' })

    const saved = d.fichaRepo.save.mock.calls[0][0].toObject()
    expect(saved.is_professional).toBe(0)
    expect(saved.notes).toContain('Se pintó en marzo.')
    expect(saved.notes).toContain('consultar el reglamento')
  })

  it('los campos numéricos vacíos quedan en null, no en 0', async () => {
    const { uc, d } = build()
    await uc.execute({ ...VALID, covered_area: '', expenses: '', bathrooms: '' })

    const saved = d.fichaRepo.save.mock.calls[0][0].toObject()
    expect(saved.covered_area).toBeNull()
    expect(saved.expenses).toBeNull()
    expect(saved.bathrooms).toBeNull()
  })

  it('rechaza un slug inexistente', async () => {
    const { uc, d } = build({ linkRepo: { findBySlug: vi.fn().mockResolvedValue(null) } })
    await expect(uc.execute(VALID)).rejects.toThrow(NotFoundError)
    expect(d.fichaRepo.save).not.toHaveBeenCalled()
  })

  it('rechaza un link dirigido ya usado', async () => {
    const { uc, d } = build({
      linkRepo: {
        findBySlug: vi.fn().mockResolvedValue(
          makeLink({ mode: 'single', lead_id: 'lead-7', submissions_count: 1 }),
        ),
      },
    })
    await expect(uc.execute(VALID)).rejects.toThrow(ValidationError)
    expect(d.fichaRepo.save).not.toHaveBeenCalled()
  })

  it('rechaza un link archivado', async () => {
    const { uc } = build({
      linkRepo: {
        findBySlug: vi.fn().mockResolvedValue(
          makeLink({ archived_at: '2026-08-01T00:00:00.000Z' }),
        ),
      },
    })
    await expect(uc.execute(VALID)).rejects.toThrow(ValidationError)
  })

  it('exige nombre, dirección y una vía de contacto', async () => {
    const { uc } = build()
    await expect(uc.execute({ ...VALID, owner_name: '  ' })).rejects.toThrow(ValidationError)
    await expect(uc.execute({ ...VALID, address: '' })).rejects.toThrow(ValidationError)
    await expect(
      uc.execute({ ...VALID, owner_phone: '', owner_email: null }),
    ).rejects.toThrow(ValidationError)
  })
})

describe('SubmitPublicFichaUseCase — preguntas por tipo de propiedad', () => {
  it('la operación elegida baja al lead y a la ficha', async () => {
    const { uc, d } = build()
    await uc.execute({ ...VALID, operation: 'ambas' })

    expect(d.leadRepo.save.mock.calls[0][0].toObject().operation).toBe('ambas')
    expect(d.fichaRepo.save.mock.calls[0][0].toObject().operation).toBe('ambas')
  })

  it('sin operación declarada el lead queda en venta', async () => {
    const { uc, d } = build()
    await uc.execute(VALID)
    expect(d.leadRepo.save.mock.calls[0][0].toObject().operation).toBe('venta')
  })

  it('guarda las tres superficies y suma el total en la tasación', async () => {
    const { uc, d } = build()
    await uc.execute({ ...VALID, covered_area: '80', semi_area: '10', uncovered_area: '30' })

    const ficha = d.fichaRepo.save.mock.calls[0][0].toObject()
    expect(ficha.covered_area).toBe(80)
    expect(ficha.semi_area).toBe(10)
    expect(ficha.uncovered_area).toBe(30)

    const appraisal = d.appraisalRepo.save.mock.calls[0][0].toObject()
    expect(appraisal.total_area).toBe(120)
    expect(appraisal.covered_area).toBe(80)
  })

  it('en un terreno la superficie total es la del lote', async () => {
    const { uc, d } = build()
    await uc.execute({
      ...VALID,
      property_type: 'terreno',
      covered_area: '',
      land_area: '450',
      frontage_m: '15',
      depth_m: '30',
      property_condition: 'baldio',
      zoning: 'R2b1',
      utilities: ['Agua', 'Luz', 'Cloacas'],
    })

    const ficha = d.fichaRepo.save.mock.calls[0][0].toObject()
    expect(ficha.land_area).toBe(450)
    expect(ficha.frontage_m).toBe(15)
    expect(ficha.depth_m).toBe(30)
    expect(ficha.property_condition).toBe('baldio')
    expect(ficha.zoning).toBe('R2b1')
    expect(ficha.utilities).toBe('Agua, Luz, Cloacas')
    expect(ficha.covered_area).toBeNull()

    const appraisal = d.appraisalRepo.save.mock.calls[0][0].toObject()
    expect(appraisal.total_area).toBe(450)
  })

  it('guarda la UF de la cochera y el número de baulera', async () => {
    const { uc, d } = build()
    await uc.execute({
      ...VALID,
      parking_type: 'fija_cubierta',
      parking_unit: 'UF 42 — cochera 17',
      storage_rooms: '1',
      storage_unit: 'Baulera 8',
    })

    const ficha = d.fichaRepo.save.mock.calls[0][0].toObject()
    expect(ficha.parking_unit).toBe('UF 42 — cochera 17')
    expect(ficha.storage_unit).toBe('Baulera 8')
  })

  it('guarda los campos de local comercial', async () => {
    const { uc, d } = build()
    await uc.execute({
      ...VALID,
      property_type: 'local',
      commercial_use: 'Gastronomía',
      has_warehouse: 'si',
      frontage_m: '6',
    })

    const ficha = d.fichaRepo.save.mock.calls[0][0].toObject()
    expect(ficha.commercial_use).toBe('Gastronomía')
    expect(ficha.has_warehouse).toBe('si')
    expect(ficha.frontage_m).toBe(6)
  })

  it('guarda las plantas de una casa', async () => {
    const { uc, d } = build()
    await uc.execute({ ...VALID, property_type: 'casa', floors_count: '2', land_area: '300' })

    const ficha = d.fichaRepo.save.mock.calls[0][0].toObject()
    expect(ficha.floors_count).toBe(2)
    expect(ficha.land_area).toBe(300)
  })
})

describe('SubmitPublicFichaUseCase — respuestas multivalor', () => {
  it('guarda varios espacios exteriores y varios sistemas de calefacción', async () => {
    const { uc, d } = build()
    await uc.execute({
      ...VALID,
      property_type: 'casa',
      land_area: '300',
      balcony_type: ['jardin', 'terraza'],
      heating_type: ['losa_radiante', 'split'],
    })

    const ficha = d.fichaRepo.save.mock.calls[0][0].toObject()
    expect(ficha.balcony_type).toBe('jardin, terraza')
    expect(ficha.heating_type).toBe('losa_radiante, split')
  })

  it('tolera que lleguen como string suelto (fichas viejas y clientes externos)', async () => {
    const { uc, d } = build()
    await uc.execute({ ...VALID, balcony_type: 'balcon', heating_type: 'central' })

    const ficha = d.fichaRepo.save.mock.calls[0][0].toObject()
    expect(ficha.balcony_type).toBe('balcon')
    expect(ficha.heating_type).toBe('central')
  })

  it('un array vacío queda en null, no en cadena vacía', async () => {
    const { uc, d } = build()
    await uc.execute({ ...VALID, balcony_type: [], heating_type: [] })

    const ficha = d.fichaRepo.save.mock.calls[0][0].toObject()
    expect(ficha.balcony_type).toBeNull()
    expect(ficha.heating_type).toBeNull()
  })
})
