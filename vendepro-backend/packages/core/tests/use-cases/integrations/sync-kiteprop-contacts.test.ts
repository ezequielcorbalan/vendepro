import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SyncKitepropContactsUseCase } from '../../../src/application/use-cases/integrations/sync-kiteprop-contacts'
import { OrgIntegration } from '../../../src/domain/entities/org-integration'
import { Contact } from '../../../src/domain/entities/contact'

const mockIntegrationRepo = {
  findByOrgAndProvider: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  findEnabledByProvider: vi.fn(),
}
const mockLinkRepo = {
  findContactId: vi.fn().mockResolvedValue(null),
  findContactIds: vi.fn().mockResolvedValue({}),
  save: vi.fn().mockResolvedValue(undefined),
}
const mockSyncLogRepo = {
  save: vi.fn().mockResolvedValue(undefined),
  listByOrg: vi.fn(),
}
const mockContactRepo = {
  findById: vi.fn().mockResolvedValue(null),
  findByOrg: vi.fn(),
  findByEmailOrPhone: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn(),
}
const mockUserRepo = {
  findFirstAdminByOrg: vi.fn().mockResolvedValue({ id: 'admin-1' }),
  findByEmail: vi.fn().mockResolvedValue(null),
  findByOrg: vi.fn().mockResolvedValue([]),
}
const mockGateway = {
  testConnection: vi.fn(),
  fetchContacts: vi.fn(),
  fetchMessages: vi.fn(),
  getPropertyRef: vi.fn().mockResolvedValue(null),
  getProperty: vi.fn().mockResolvedValue(null),
  fetchAgents: vi.fn().mockResolvedValue([]),
  getContactAgent: vi.fn().mockResolvedValue(null),
}
let idCounter = 0
const mockIds = { generate: vi.fn(() => `gen-${++idCounter}`) }
const decrypt = vi.fn(async () => 'kp_key')

function integration(overrides: Record<string, unknown> = {}) {
  return OrgIntegration.create({
    id: 'integ-1', org_id: 'org_mg', provider: 'kiteprop',
    credentials_encrypted: 'enc(kp_key)', enabled: true,
    last_sync_at: '2026-07-01T00:00:00.000Z', ...overrides,
  })
}

function kpContact(id: number, overrides: Record<string, unknown> = {}) {
  return {
    external_id: String(id), full_name: `Contacto ${id}`, email: `c${id}@mail.com`,
    phone: null, source: 'zonaprop', tags: ['whatsappbot'], category: 'Nuevo',
    created_at: '2026-07-02T10:00:00.000Z', ...overrides,
  }
}

function kpMessage(id: number, overrides: Record<string, unknown> = {}) {
  const contactId = (overrides.contactId as number) ?? id
  return {
    external_id: String(id),
    body: `Consulta ${id}`,
    source: 'argenprop',
    property_id: 500 + id,
    created_at: '2026-07-03T10:00:00.000Z',
    contact: { external_id: String(contactId), full_name: `Persona ${contactId}`, email: `p${contactId}@mail.com`, phone: null },
    ...overrides,
  }
}

function page(data: any[], currentPage = 1, lastPage = 1, total?: number) {
  return { data, current_page: currentPage, last_page: lastPage, total: total ?? data.length }
}

function makeUc() {
  return new SyncKitepropContactsUseCase(
    mockIntegrationRepo, mockLinkRepo, mockSyncLogRepo,
    mockContactRepo, mockUserRepo, mockGateway, mockIds, decrypt,
  )
}

describe('SyncKitepropContactsUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    idCounter = 0
    mockIds.generate.mockImplementation(() => `gen-${++idCounter}`)
    mockIntegrationRepo.findByOrgAndProvider.mockResolvedValue(integration())
    mockIntegrationRepo.save.mockResolvedValue(undefined)
    mockLinkRepo.findContactId.mockResolvedValue(null)
    mockLinkRepo.findContactIds.mockResolvedValue({})
    mockLinkRepo.save.mockResolvedValue(undefined)
    mockSyncLogRepo.save.mockResolvedValue(undefined)
    mockContactRepo.findById.mockResolvedValue(null)
    mockContactRepo.findByEmailOrPhone.mockResolvedValue(null)
    mockContactRepo.save.mockResolvedValue(undefined)
    mockUserRepo.findFirstAdminByOrg.mockResolvedValue({ id: 'admin-1' })
    mockUserRepo.findByEmail.mockResolvedValue(null)
    mockUserRepo.findByOrg.mockResolvedValue([])
    mockGateway.getProperty.mockResolvedValue(null)
    decrypt.mockResolvedValue('kp_key')
  })

  // ─────────────── MESSAGE-DRIVEN (auto/manual) ───────────────

  it('crea contacto nuevo con portal como source, agente por email y notas con mensaje + propiedad', async () => {
    mockGateway.fetchMessages.mockResolvedValue(page([kpMessage(1)]))
    mockGateway.getProperty.mockResolvedValue({ code: 'KP501', title: 'Oficina Villa Urquiza', address: 'Av. 100', agent_email: 'andres@dein.com', agent_name: 'Andrés Giunta' })
    mockUserRepo.findByEmail.mockResolvedValue({ id: 'user-andres' })

    const result = await makeUc().execute({ orgId: 'org_mg', mode: 'manual' })

    expect(result).toMatchObject({ ok: true, created: 1, enriched: 0, done: true })
    const saved = mockContactRepo.save.mock.calls[0][0]
    expect(saved.source).toBe('argenprop')          // portal real
    expect(saved.agent_id).toBe('user-andres')       // agente mapeado por email
    expect(saved.notes).toContain('vía KiteProp')
    expect(saved.notes).toContain('Argenprop')
    expect(saved.notes).toContain('KP501')
    expect(saved.notes).toContain('Oficina Villa Urquiza')
    expect(saved.notes).toContain('Consulta 1')
    // link de contacto + link de mensaje (idempotencia por consulta)
    expect(mockLinkRepo.save).toHaveBeenCalledWith('org_mg', 'kiteprop', '1', expect.any(String))
    expect(mockLinkRepo.save).toHaveBeenCalledWith('org_mg', 'kiteprop', 'msg:1', expect.any(String))
  })

  it('agente: fallback por nombre cuando no matchea el email', async () => {
    mockGateway.fetchMessages.mockResolvedValue(page([kpMessage(1)]))
    mockGateway.getProperty.mockResolvedValue({ code: 'KP501', title: 'X', address: null, agent_email: 'noexiste@dein.com', agent_name: 'Andrés Giunta' })
    mockUserRepo.findByEmail.mockResolvedValue(null)
    mockUserRepo.findByOrg.mockResolvedValue([{ id: 'user-andres', email: 'otro@vp.com', full_name: 'Andres Giunta' }])

    await makeUc().execute({ orgId: 'org_mg', mode: 'manual' })
    expect(mockContactRepo.save.mock.calls[0][0].agent_id).toBe('user-andres')
  })

  it('agente: cae al admin cuando no matchea ni por email ni por nombre', async () => {
    mockGateway.fetchMessages.mockResolvedValue(page([kpMessage(1)]))
    mockGateway.getProperty.mockResolvedValue({ code: null, title: null, address: null, agent_email: 'x@x.com', agent_name: 'Nadie' })

    await makeUc().execute({ orgId: 'org_mg', mode: 'manual' })
    expect(mockContactRepo.save.mock.calls[0][0].agent_id).toBe('admin-1')
  })

  it('agent_map: usa el usuario mapeado del agente ASIGNADO en KiteProp (prioridad sobre email/propiedad)', async () => {
    mockGateway.fetchMessages.mockResolvedValue(page([kpMessage(1)]))
    // El contacto está asignado a Marcela (id 7673) en KiteProp
    mockGateway.getContactAgent.mockResolvedValue({ external_id: '7673', email: 'marcelagenta@dein.com', name: 'Marcela Genta' })
    // El agente de la propiedad es otro (no debería ganarle al asignado)
    mockGateway.getProperty.mockResolvedValue({ code: 'KP1', title: 'X', address: null, agent_email: 'otro@dein.com', agent_name: 'Otro' })
    mockIntegrationRepo.findByOrgAndProvider.mockResolvedValue(
      integration({ config_json: JSON.stringify({ agent_map: { '7673': 'user-marcela' } }) }),
    )

    await makeUc().execute({ orgId: 'org_mg', mode: 'manual' })
    expect(mockContactRepo.save.mock.calls[0][0].agent_id).toBe('user-marcela')
    expect(mockUserRepo.findByEmail).not.toHaveBeenCalled() // el mapeo directo cortó antes
  })

  it('modo enrich: sin corte por fecha, procesa consultas viejas y persiste enrich_next_page', async () => {
    // last_sync_at = 2026-07-01; en auto estas se cortarían por viejas. Enrich las procesa.
    mockGateway.fetchMessages
      .mockResolvedValueOnce(page([kpMessage(1, { created_at: '2026-06-10T10:00:00.000Z' })], 1, 3, 60))
      .mockResolvedValueOnce(page([kpMessage(2, { contactId: 2, created_at: '2026-06-05T10:00:00.000Z' })], 2, 3, 60))

    const result = await makeUc().execute({ orgId: 'org_mg', mode: 'enrich', maxPages: 2 })

    expect(result.created).toBe(2)
    expect(result.done).toBe(false)
    expect(result.nextPage).toBe(3)
    const savedIntegration: OrgIntegration = mockIntegrationRepo.save.mock.calls[0][0]
    expect(savedIntegration.getConfig().enrich_next_page).toBe(3)
    expect(savedIntegration.last_sync_at).toBe('2026-07-01T00:00:00.000Z') // enrich no toca last_sync_at
  })

  it('modo enrich reanuda desde enrich_next_page y marca done', async () => {
    mockIntegrationRepo.findByOrgAndProvider.mockResolvedValue(
      integration({ config_json: JSON.stringify({ enrich_next_page: 3 }) }),
    )
    mockGateway.fetchMessages.mockResolvedValue(page([kpMessage(9, { created_at: '2026-05-01T10:00:00.000Z' })], 3, 3, 60))

    const result = await makeUc().execute({ orgId: 'org_mg', mode: 'enrich' })
    expect(mockGateway.fetchMessages.mock.calls[0][1].page).toBe(3)
    expect(result.done).toBe(true)
    expect((mockIntegrationRepo.save.mock.calls[0][0] as OrgIntegration).getConfig().enrich_done).toBe(true)
  })

  it('contacto existente (por link): enriquece source/agente/notas y cuenta enriched', async () => {
    mockGateway.fetchMessages.mockResolvedValue(page([kpMessage(1, { contactId: 77 })]))
    mockGateway.getProperty.mockResolvedValue({ code: 'KP501', title: 'Oficina', address: null, agent_email: 'a@dein.com', agent_name: 'Andrés' })
    mockUserRepo.findByEmail.mockResolvedValue({ id: 'user-andres' })
    mockLinkRepo.findContactId.mockResolvedValue('contact-77')
    mockContactRepo.findById.mockResolvedValue(Contact.create({
      id: 'contact-77', org_id: 'org_mg', full_name: 'Persona 77', phone: null, email: 'p77@mail.com',
      contact_type: 'otro', neighborhood: null, notes: 'Importado de KiteProp', source: 'kiteprop', agent_id: 'admin-1',
    }))

    const result = await makeUc().execute({ orgId: 'org_mg', mode: 'manual' })

    expect(result.created).toBe(0)
    expect(result.enriched).toBe(1)
    const saved = mockContactRepo.save.mock.calls[0][0]
    expect(saved.id).toBe('contact-77')       // mismo contacto, no duplica
    expect(saved.source).toBe('argenprop')     // portal reemplaza kiteprop
    expect(saved.agent_id).toBe('user-andres') // agente real
    expect(saved.notes).toContain('Consulta 1')
    expect(saved.notes).toContain('Importado de KiteProp') // preserva lo anterior (prepend)
    expect(mockLinkRepo.save).toHaveBeenCalledWith('org_mg', 'kiteprop', 'msg:1', 'contact-77')
  })

  it('mensaje ya procesado (msg: link): skip sin tocar el contacto', async () => {
    mockGateway.fetchMessages.mockResolvedValue(page([kpMessage(1)]))
    mockLinkRepo.findContactIds.mockResolvedValue({ 'msg:1': 'contact-x' })

    const result = await makeUc().execute({ orgId: 'org_mg', mode: 'manual' })
    expect(result.skipped).toBe(1)
    expect(result.created).toBe(0)
    expect(mockContactRepo.save).not.toHaveBeenCalled()
  })

  it('cachea get_property: dos consultas de la misma propiedad → una sola llamada', async () => {
    mockGateway.fetchMessages.mockResolvedValue(page([
      kpMessage(1, { property_id: 999, contactId: 1 }),
      kpMessage(2, { property_id: 999, contactId: 2 }),
    ]))
    mockGateway.getProperty.mockResolvedValue({ code: 'KP999', title: 'T', address: null, agent_email: null, agent_name: null })

    await makeUc().execute({ orgId: 'org_mg', mode: 'manual' })
    expect(mockGateway.getProperty).toHaveBeenCalledTimes(1)
    expect(mockGateway.getProperty).toHaveBeenCalledWith('kp_key', 999)
  })

  it('corta al pasar la marca de fecha (KiteProp ignora date_from)', async () => {
    mockGateway.fetchMessages.mockResolvedValue(page([
      kpMessage(3, { created_at: '2026-07-03T10:00:00.000Z' }),
      kpMessage(2, { created_at: '2026-06-10T10:00:00.000Z' }), // anterior a last_sync 2026-07-01
    ], 1, 5, 40))

    const result = await makeUc().execute({ orgId: 'org_mg', mode: 'auto' })
    expect(result.created).toBe(1)
    expect(result.done).toBe(true)
    expect(mockGateway.fetchMessages).toHaveBeenCalledTimes(1)
  })

  it('avanza last_sync_at al terminar (done)', async () => {
    mockGateway.fetchMessages.mockResolvedValue(page([kpMessage(1)], 1, 1, 1))
    await makeUc().execute({ orgId: 'org_mg', mode: 'auto' })
    const savedIntegration: OrgIntegration = mockIntegrationRepo.save.mock.calls[0][0]
    expect(savedIntegration.last_sync_at).not.toBe('2026-07-01T00:00:00.000Z')
  })

  it('error del gateway corta sin avanzar last_sync_at', async () => {
    mockGateway.fetchMessages
      .mockResolvedValueOnce(page([kpMessage(1)], 1, 3, 60))
      .mockRejectedValueOnce(new Error('KiteProp MCP: HTTP 429'))

    const result = await makeUc().execute({ orgId: 'org_mg', mode: 'auto' })
    expect(result.ok).toBe(true)
    expect(result.done).toBe(false)
    expect(result.error).toContain('429')
    const savedIntegration: OrgIntegration = mockIntegrationRepo.save.mock.calls[0][0]
    expect(savedIntegration.last_sync_at).toBe('2026-07-01T00:00:00.000Z')
  })

  it('decrypt null → error, no llama al gateway', async () => {
    decrypt.mockResolvedValue(null)
    const result = await makeUc().execute({ orgId: 'org_mg', mode: 'auto' })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('desencriptar')
    expect(mockGateway.fetchMessages).not.toHaveBeenCalled()
    expect(mockSyncLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', kind: 'auto' }))
  })

  it('integración deshabilitada no sincroniza', async () => {
    mockIntegrationRepo.findByOrgAndProvider.mockResolvedValue(integration({ enabled: false }))
    const result = await makeUc().execute({ orgId: 'org_mg', mode: 'auto' })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('deshabilitada')
  })

  it('escribe el sync log con conteos (created+enriched)', async () => {
    mockGateway.fetchMessages.mockResolvedValue(page([kpMessage(1), kpMessage(2, { contactId: 88 })]))
    mockLinkRepo.findContactId.mockImplementation(async (_o: string, _p: string, ext: string) => ext === '88' ? 'contact-88' : null)
    mockContactRepo.findById.mockResolvedValue(Contact.create({
      id: 'contact-88', org_id: 'org_mg', full_name: 'P88', phone: null, email: 'p88@mail.com',
      contact_type: 'otro', neighborhood: null, notes: 'x', source: 'kiteprop', agent_id: 'admin-1',
    }))

    await makeUc().execute({ orgId: 'org_mg', mode: 'manual' })
    expect(mockSyncLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      org_id: 'org_mg', integration_id: 'integ-1', kind: 'manual', status: 'ok',
      contacts_created: 2, // 1 created + 1 enriched
    }))
  })

  // ─────────────── CONTACT-DRIVEN (backfill) ───────────────

  it('backfill usa fetchContacts (agenda base, sin enriquecer)', async () => {
    mockGateway.fetchContacts.mockResolvedValue(page([kpContact(100), kpContact(200)]))
    const result = await makeUc().execute({ orgId: 'org_mg', mode: 'backfill' })

    expect(mockGateway.fetchMessages).not.toHaveBeenCalled()
    expect(result.created).toBe(2)
    const saved = mockContactRepo.save.mock.calls[0][0]
    expect(saved.source).toBe('zonaprop')
    expect(saved.notes).toContain('Importado de KiteProp')
  })

  it('backfill: match por email/teléfono solo linkea', async () => {
    mockGateway.fetchContacts.mockResolvedValue(page([kpContact(100)]))
    mockContactRepo.findByEmailOrPhone.mockResolvedValue({ id: 'contact-existente' })
    const result = await makeUc().execute({ orgId: 'org_mg', mode: 'backfill' })
    expect(result.created).toBe(0)
    expect(mockContactRepo.save).not.toHaveBeenCalled()
    expect(mockLinkRepo.save).toHaveBeenCalledWith('org_mg', 'kiteprop', '100', 'contact-existente')
  })

  it('backfill: chunked con nextPage persistido en config_json', async () => {
    mockGateway.fetchContacts
      .mockResolvedValueOnce(page([kpContact(1)], 1, 3, 60))
      .mockResolvedValueOnce(page([kpContact(2)], 2, 3, 60))

    const result = await makeUc().execute({ orgId: 'org_mg', mode: 'backfill', maxPages: 2 })
    expect(result.done).toBe(false)
    expect(result.nextPage).toBe(3)
    const savedIntegration: OrgIntegration = mockIntegrationRepo.save.mock.calls[0][0]
    expect(savedIntegration.getConfig().backfill_next_page).toBe(3)
    expect(savedIntegration.last_sync_at).toBe('2026-07-01T00:00:00.000Z')
  })

  it('backfill reanuda desde config_json.backfill_next_page y marca done', async () => {
    mockIntegrationRepo.findByOrgAndProvider.mockResolvedValue(
      integration({ config_json: JSON.stringify({ backfill_next_page: 3 }) }),
    )
    mockGateway.fetchContacts.mockResolvedValue(page([kpContact(50)], 3, 3, 60))

    const result = await makeUc().execute({ orgId: 'org_mg', mode: 'backfill' })
    expect(mockGateway.fetchContacts.mock.calls[0][1].page).toBe(3)
    expect(result.done).toBe(true)
    expect((mockIntegrationRepo.save.mock.calls[0][0] as OrgIntegration).getConfig().backfill_done).toBe(true)
  })
})

// ─────────────── LEADS COMPRADORES (message-driven + repos opcionales) ───────────────

const mockLeadRepo = {
  findById: vi.fn(),
  findByOrg: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn(),
  findOpenBuyerByContact: vi.fn().mockResolvedValue(null),
} as any
const mockLeadPropertyRepo = {
  findById: vi.fn(),
  findByLead: vi.fn(),
  findByLeadAndProperty: vi.fn().mockResolvedValue(null),
  findByLeadWithProperty: vi.fn(),
  findInterestedByProperty: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn(),
} as any
const mockPropertyLinkRepo = {
  findPropertyId: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(undefined),
} as any
const mockPropertyRepo = {
  findById: vi.fn(),
  findByNormalizedAddress: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(undefined),
} as any

function makeBuyerUc() {
  return new SyncKitepropContactsUseCase(
    mockIntegrationRepo, mockLinkRepo, mockSyncLogRepo,
    mockContactRepo, mockUserRepo, mockGateway, mockIds, decrypt,
    mockLeadRepo, mockLeadPropertyRepo, mockPropertyLinkRepo, mockPropertyRepo,
  )
}

const kpPropertyDto = (over: Record<string, unknown> = {}) => ({
  external_id: '501', code: 'KP501', title: 'Depto 3 amb', address: 'Av. Cabildo 1234',
  neighborhood: 'Belgrano', property_type: 'Departamento', rooms: 3, size_m2: 75,
  price: 150000, currency: 'USD', cover_photo: null,
  agent_email: 'andres@dein.com', agent_name: 'Andrés Giunta', ...over,
})

describe('SyncKitepropContactsUseCase — leads compradores', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    idCounter = 0
    mockIds.generate.mockImplementation(() => `gen-${++idCounter}`)
    mockIntegrationRepo.findByOrgAndProvider.mockResolvedValue(integration())
    mockIntegrationRepo.save.mockResolvedValue(undefined)
    mockLinkRepo.findContactId.mockResolvedValue(null)
    mockLinkRepo.findContactIds.mockResolvedValue({})
    mockLinkRepo.save.mockResolvedValue(undefined)
    mockSyncLogRepo.save.mockResolvedValue(undefined)
    mockContactRepo.findById.mockResolvedValue(null)
    mockContactRepo.findByEmailOrPhone.mockResolvedValue(null)
    mockContactRepo.save.mockResolvedValue(undefined)
    mockUserRepo.findFirstAdminByOrg.mockResolvedValue({ id: 'admin-1' })
    mockUserRepo.findByEmail.mockResolvedValue(null)
    mockUserRepo.findByOrg.mockResolvedValue([])
    mockGateway.getProperty.mockResolvedValue(kpPropertyDto())
    decrypt.mockResolvedValue('kp_key')
    mockLeadRepo.findOpenBuyerByContact.mockResolvedValue(null)
    mockLeadRepo.save.mockResolvedValue(undefined)
    mockLeadPropertyRepo.findByLeadAndProperty.mockResolvedValue(null)
    mockLeadPropertyRepo.save.mockResolvedValue(undefined)
    mockPropertyLinkRepo.findPropertyId.mockResolvedValue(null)
    mockPropertyLinkRepo.save.mockResolvedValue(undefined)
    mockPropertyRepo.findByNormalizedAddress.mockResolvedValue(null)
    mockPropertyRepo.save.mockResolvedValue(undefined)
  })

  it('consulta nueva: crea contacto + lead comprador + propiedad importada + link + lead_property', async () => {
    mockGateway.fetchMessages.mockResolvedValue(page([kpMessage(1)]))

    const result = await makeBuyerUc().execute({ orgId: 'org_mg', mode: 'manual' })

    expect(result.created).toBe(1)
    // Lead comprador en 'nuevo' con contact_id y source del portal
    expect(mockLeadRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      pipeline: 'comprador', stage: 'nuevo', source: 'argenprop',
    }))
    // Propiedad importada como local (source kiteprop, publicada)
    expect(mockPropertyRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      source: 'kiteprop', commercial_stage: 'publicada', address: 'Av. Cabildo 1234',
    }))
    // Link aviso KiteProp → propiedad local
    expect(mockPropertyLinkRepo.save).toHaveBeenCalledWith('org_mg', 'kiteprop', '501', expect.any(String), 'KP501')
    // Relación de interés
    expect(mockLeadPropertyRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'interesado' }))
  })

  it('mismo contacto con lead comprador abierto: NO crea 2º lead, SÍ agrega la propiedad', async () => {
    mockGateway.fetchMessages.mockResolvedValue(page([kpMessage(1)]))
    mockLeadRepo.findOpenBuyerByContact.mockResolvedValue({ id: 'lead-open' })

    await makeBuyerUc().execute({ orgId: 'org_mg', mode: 'manual' })

    expect(mockLeadRepo.save).not.toHaveBeenCalled()
    expect(mockLeadPropertyRepo.save).toHaveBeenCalledWith(expect.objectContaining({ lead_id: 'lead-open' }))
  })

  it('aviso ya mapeado en property_links: reusa la propiedad local sin importar', async () => {
    mockGateway.fetchMessages.mockResolvedValue(page([kpMessage(1)]))
    mockPropertyLinkRepo.findPropertyId.mockResolvedValue('prop-local-1')

    await makeBuyerUc().execute({ orgId: 'org_mg', mode: 'manual' })

    expect(mockPropertyRepo.save).not.toHaveBeenCalled()
    expect(mockLeadPropertyRepo.save).toHaveBeenCalledWith(expect.objectContaining({ property_id: 'prop-local-1' }))
  })

  it('match por dirección: no duplica una captación propia, solo crea el link', async () => {
    mockGateway.fetchMessages.mockResolvedValue(page([kpMessage(1)]))
    mockPropertyRepo.findByNormalizedAddress.mockResolvedValue({ id: 'prop-captada' })

    await makeBuyerUc().execute({ orgId: 'org_mg', mode: 'manual' })

    expect(mockPropertyRepo.save).not.toHaveBeenCalled()
    expect(mockPropertyLinkRepo.save).toHaveBeenCalledWith('org_mg', 'kiteprop', '501', 'prop-captada', 'KP501')
  })

  it('relación existente (p.ej. visitada): no la pisa', async () => {
    mockGateway.fetchMessages.mockResolvedValue(page([kpMessage(1)]))
    mockPropertyLinkRepo.findPropertyId.mockResolvedValue('prop-local-1')
    mockLeadPropertyRepo.findByLeadAndProperty.mockResolvedValue({ id: 'lp-1', status: 'visitada' })

    await makeBuyerUc().execute({ orgId: 'org_mg', mode: 'manual' })

    expect(mockLeadPropertyRepo.save).not.toHaveBeenCalled()
  })

  it('flag create_buyer_leads: false → solo contacto, sin lead', async () => {
    mockIntegrationRepo.findByOrgAndProvider.mockResolvedValue(
      integration({ config_json: JSON.stringify({ create_buyer_leads: false }) }),
    )
    mockGateway.fetchMessages.mockResolvedValue(page([kpMessage(1)]))

    const result = await makeBuyerUc().execute({ orgId: 'org_mg', mode: 'manual' })

    expect(result.created).toBe(1) // el contacto
    expect(mockLeadRepo.save).not.toHaveBeenCalled()
    expect(mockLeadPropertyRepo.save).not.toHaveBeenCalled()
  })

  it('modo enrich: NO crea leads compradores (histórico)', async () => {
    mockGateway.fetchMessages.mockResolvedValue(page([kpMessage(1)]))

    await makeBuyerUc().execute({ orgId: 'org_mg', mode: 'enrich' })

    expect(mockLeadRepo.save).not.toHaveBeenCalled()
  })

  it('fallo creando el lead NO voltea la creación del contacto', async () => {
    mockGateway.fetchMessages.mockResolvedValue(page([kpMessage(1)]))
    mockLeadRepo.findOpenBuyerByContact.mockRejectedValue(new Error('D1 down'))

    const result = await makeBuyerUc().execute({ orgId: 'org_mg', mode: 'manual' })

    expect(result.created).toBe(1) // el contacto se creó igual
    expect(mockContactRepo.save).toHaveBeenCalled()
    expect(result.error).toBe('D1 down')
  })

  it('fallo de getProperty: el lead se crea igual, sin relación de propiedad', async () => {
    mockGateway.fetchMessages.mockResolvedValue(page([kpMessage(1)]))
    mockGateway.getProperty.mockResolvedValue(null)

    await makeBuyerUc().execute({ orgId: 'org_mg', mode: 'manual' })

    expect(mockLeadRepo.save).toHaveBeenCalledWith(expect.objectContaining({ pipeline: 'comprador' }))
    expect(mockLeadPropertyRepo.save).not.toHaveBeenCalled()
  })
})
