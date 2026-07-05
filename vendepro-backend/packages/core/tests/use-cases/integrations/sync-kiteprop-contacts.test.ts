import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SyncKitepropContactsUseCase } from '../../../src/application/use-cases/integrations/sync-kiteprop-contacts'
import { OrgIntegration } from '../../../src/domain/entities/org-integration'

const mockIntegrationRepo = {
  findByOrgAndProvider: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  findEnabledByProvider: vi.fn(),
}
const mockLinkRepo = {
  findContactId: vi.fn(),
  findContactIds: vi.fn().mockResolvedValue({}),
  save: vi.fn().mockResolvedValue(undefined),
}
const mockSyncLogRepo = {
  save: vi.fn().mockResolvedValue(undefined),
  listByOrg: vi.fn(),
}
const mockContactRepo = {
  findById: vi.fn(),
  findByOrg: vi.fn(),
  findByEmailOrPhone: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn(),
}
const mockUserRepo = { findFirstAdminByOrg: vi.fn().mockResolvedValue({ id: 'admin-1' }) }
const mockGateway = {
  testConnection: vi.fn(),
  fetchContacts: vi.fn(),
}
let idCounter = 0
const mockIds = { generate: vi.fn(() => `gen-${++idCounter}`) }
const decrypt = vi.fn(async () => 'kp_key')

function integration(overrides: Record<string, unknown> = {}) {
  return OrgIntegration.create({
    id: 'integ-1',
    org_id: 'org_mg',
    provider: 'kiteprop',
    credentials_encrypted: 'enc(kp_key)',
    enabled: true,
    last_sync_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  })
}

function kpContact(id: number, overrides: Record<string, unknown> = {}) {
  return {
    external_id: String(id),
    full_name: `Contacto ${id}`,
    email: `c${id}@mail.com`,
    phone: null,
    source: 'zonaprop',
    tags: ['whatsappbot'],
    category: 'Nuevo',
    created_at: '2026-07-02T10:00:00.000Z',
    ...overrides,
  }
}

function page(contacts: any[], currentPage = 1, lastPage = 1, total?: number) {
  return { data: contacts, current_page: currentPage, last_page: lastPage, total: total ?? contacts.length }
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
    mockLinkRepo.findContactIds.mockResolvedValue({})
    mockLinkRepo.save.mockResolvedValue(undefined)
    mockSyncLogRepo.save.mockResolvedValue(undefined)
    mockContactRepo.findByEmailOrPhone.mockResolvedValue(null)
    mockContactRepo.save.mockResolvedValue(undefined)
    mockUserRepo.findFirstAdminByOrg.mockResolvedValue({ id: 'admin-1' })
    decrypt.mockResolvedValue('kp_key')
  })

  it('crea contactos nuevos con source kiteprop, dueño admin y link externo', async () => {
    mockGateway.fetchContacts.mockResolvedValue(page([kpContact(100), kpContact(200)]))
    const result = await makeUc().execute({ orgId: 'org_mg', mode: 'manual' })

    expect(result).toMatchObject({ ok: true, created: 2, skipped: 0, done: true })
    expect(mockContactRepo.save).toHaveBeenCalledTimes(2)
    const saved = mockContactRepo.save.mock.calls[0][0]
    expect(saved.source).toBe('kiteprop')
    expect(saved.agent_id).toBe('admin-1')
    expect(saved.notes).toContain('KiteProp')
    expect(saved.notes).toContain('zonaprop')
    expect(mockLinkRepo.save).toHaveBeenCalledWith('org_mg', 'kiteprop', '100', expect.any(String))
  })

  it('skip por link existente: ni busca por email ni crea', async () => {
    mockGateway.fetchContacts.mockResolvedValue(page([kpContact(100)]))
    mockLinkRepo.findContactIds.mockResolvedValue({ '100': 'contact-ya' })

    const result = await makeUc().execute({ orgId: 'org_mg', mode: 'manual' })

    expect(result.created).toBe(0)
    expect(result.skipped).toBe(1)
    expect(mockContactRepo.findByEmailOrPhone).not.toHaveBeenCalled()
    expect(mockContactRepo.save).not.toHaveBeenCalled()
  })

  it('match por email/teléfono: solo crea el link, no duplica el contacto', async () => {
    mockGateway.fetchContacts.mockResolvedValue(page([kpContact(100)]))
    mockContactRepo.findByEmailOrPhone.mockResolvedValue({ id: 'contact-existente' })

    const result = await makeUc().execute({ orgId: 'org_mg', mode: 'manual' })

    expect(result.created).toBe(0)
    expect(result.skipped).toBe(1)
    expect(mockContactRepo.save).not.toHaveBeenCalled()
    expect(mockLinkRepo.save).toHaveBeenCalledWith('org_mg', 'kiteprop', '100', 'contact-existente')
  })

  it('pagina hasta last_page y actualiza last_sync_at al terminar', async () => {
    mockGateway.fetchContacts
      .mockResolvedValueOnce(page([kpContact(1)], 1, 2, 2))
      .mockResolvedValueOnce(page([kpContact(2)], 2, 2, 2))

    const result = await makeUc().execute({ orgId: 'org_mg', mode: 'auto' })

    expect(mockGateway.fetchContacts).toHaveBeenCalledTimes(2)
    expect(result.done).toBe(true)
    expect(result.created).toBe(2)
    const savedIntegration: OrgIntegration = mockIntegrationRepo.save.mock.calls[0][0]
    expect(savedIntegration.last_sync_at).not.toBe('2026-07-01T00:00:00.000Z')
  })

  it('auto/manual usa dateFrom del last_sync_at (por día)', async () => {
    mockGateway.fetchContacts.mockResolvedValue(page([]))
    await makeUc().execute({ orgId: 'org_mg', mode: 'auto' })

    expect(mockGateway.fetchContacts).toHaveBeenCalledWith('kp_key', {
      page: 1, limit: 25, dateFrom: '2026-07-01',
    })
  })

  it('backfill: sin dateFrom, chunked con nextPage persistido en config_json', async () => {
    // 3 páginas totales pero maxPages 2 → corta y deja backfill_next_page
    mockGateway.fetchContacts
      .mockResolvedValueOnce(page([kpContact(1)], 1, 3, 60))
      .mockResolvedValueOnce(page([kpContact(2)], 2, 3, 60))

    const result = await makeUc().execute({ orgId: 'org_mg', mode: 'backfill', maxPages: 2 })

    expect(mockGateway.fetchContacts.mock.calls[0][1]).toEqual({ page: 1, limit: 25, dateFrom: undefined })
    expect(result.done).toBe(false)
    expect(result.nextPage).toBe(3)
    const savedIntegration: OrgIntegration = mockIntegrationRepo.save.mock.calls[0][0]
    expect(savedIntegration.getConfig().backfill_next_page).toBe(3)
    // backfill no toca last_sync_at
    expect(savedIntegration.last_sync_at).toBe('2026-07-01T00:00:00.000Z')
  })

  it('backfill reanuda desde config_json.backfill_next_page y marca done al final', async () => {
    mockIntegrationRepo.findByOrgAndProvider.mockResolvedValue(
      integration({ config_json: JSON.stringify({ backfill_next_page: 3 }) }),
    )
    mockGateway.fetchContacts.mockResolvedValue(page([kpContact(50)], 3, 3, 60))

    const result = await makeUc().execute({ orgId: 'org_mg', mode: 'backfill' })

    expect(mockGateway.fetchContacts.mock.calls[0][1].page).toBe(3)
    expect(result.done).toBe(true)
    const savedIntegration: OrgIntegration = mockIntegrationRepo.save.mock.calls[0][0]
    expect(savedIntegration.getConfig().backfill_done).toBe(true)
  })

  it('decrypt null → error claro y log de status error', async () => {
    decrypt.mockResolvedValue(null)
    const result = await makeUc().execute({ orgId: 'org_mg', mode: 'auto' })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('desencriptar')
    expect(mockSyncLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', kind: 'auto' }))
    expect(mockGateway.fetchContacts).not.toHaveBeenCalled()
  })

  it('integración deshabilitada no sincroniza', async () => {
    mockIntegrationRepo.findByOrgAndProvider.mockResolvedValue(integration({ enabled: false }))
    const result = await makeUc().execute({ orgId: 'org_mg', mode: 'auto' })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('deshabilitada')
  })

  it('un contacto inválido no aborta la página (status partial con error)', async () => {
    mockGateway.fetchContacts.mockResolvedValue(page([
      kpContact(1, { email: 'no-es-email' }), // Contact.create lanza por regex
      kpContact(2),
    ]))

    const result = await makeUc().execute({ orgId: 'org_mg', mode: 'manual' })

    expect(result.created).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.error).toBeTruthy()
    expect(mockSyncLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'partial' }))
  })

  it('error del gateway (429/timeout) corta la corrida sin avanzar last_sync_at', async () => {
    mockGateway.fetchContacts
      .mockResolvedValueOnce(page([kpContact(1)], 1, 3, 60))
      .mockRejectedValueOnce(new Error('KiteProp MCP: HTTP 429'))

    const result = await makeUc().execute({ orgId: 'org_mg', mode: 'auto' })

    expect(result.ok).toBe(true) // parcial, no fatal
    expect(result.done).toBe(false)
    expect(result.error).toContain('429')
    const savedIntegration: OrgIntegration = mockIntegrationRepo.save.mock.calls[0][0]
    expect(savedIntegration.last_sync_at).toBe('2026-07-01T00:00:00.000Z') // NO avanza
    expect(mockSyncLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'partial' }))
  })

  it('escribe el sync log con conteos', async () => {
    mockGateway.fetchContacts.mockResolvedValue(page([kpContact(1), kpContact(2)]))
    mockLinkRepo.findContactIds.mockResolvedValue({ '2': 'ya-existe' })

    await makeUc().execute({ orgId: 'org_mg', mode: 'manual' })

    expect(mockSyncLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      org_id: 'org_mg',
      integration_id: 'integ-1',
      kind: 'manual',
      status: 'ok',
      contacts_created: 1,
      contacts_skipped: 1,
    }))
  })
})
