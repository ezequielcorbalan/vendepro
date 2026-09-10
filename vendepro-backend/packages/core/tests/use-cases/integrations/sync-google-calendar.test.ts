import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SyncGoogleCalendarUseCase } from '../../../src/application/use-cases/integrations/sync-google-calendar'
import { UserIntegration } from '../../../src/domain/entities/user-integration'
import { CalendarEvent } from '../../../src/domain/entities/calendar-event'

/**
 * La sincronización incremental es la que corre en cada notificación de
 * Google. Acá se fija su contrato con un gateway de mentira, porque contra
 * Google de verdad sólo se puede probar desplegado.
 */

const PROVIDER = 'google_calendar'

function makeIntegration(config: Record<string, unknown> = {}) {
  const integration = UserIntegration.create({
    id: 'int1', org_id: 'org1', user_id: 'agente1', provider: PROVIDER,
    credentials_encrypted: 'cifrado', enabled: true,
  })
  integration.setConfig(config)
  return integration
}

function makeGoogleEvent(over: Partial<{
  id: string; summary: string; status: string; start: string; end: string
}> = {}) {
  return {
    id: over.id ?? 'g1',
    summary: over.summary ?? 'Visita Lavalle 2060',
    description: null,
    start: over.start ?? '2026-09-20T14:00:00.000Z',
    end: over.end ?? '2026-09-20T15:00:00.000Z',
    all_day: false,
    html_link: null,
    status: over.status ?? 'confirmed',
  }
}

function makeCrmEvent(googleEventId: string, over: Partial<{ completed: number; title: string }> = {}) {
  return CalendarEvent.create({
    id: 'evt-crm', org_id: 'org1', agent_id: 'agente1',
    title: over.title ?? 'Título viejo', event_type: 'visita_comprador',
    start_at: '2026-09-01T10:00:00.000Z', end_at: '2026-09-01T11:00:00.000Z',
    all_day: 0, description: null, lead_id: 'lead-corregido-a-mano',
    contact_id: null, property_id: null, appraisal_id: null, reservation_id: null,
    color: null, completed: over.completed ?? 0, google_event_id: googleEventId,
  })
}

function makeDeps(over: {
  integration?: UserIntegration | null
  crmEvents?: CalendarEvent[]
  pages?: any[]
} = {}) {
  const pages = over.pages ?? [{ events: [], next_sync_token: 'tok-2', sync_token_expired: false }]
  let call = 0

  // `??` no sirve acá: `null` es un caso a propósito (cuenta sin conectar),
  // no "no me pasaron nada".
  const integration = 'integration' in over ? over.integration : makeIntegration()

  const integrationRepo = {
    findByUserAndProvider: vi.fn().mockResolvedValue(integration),
    findByGoogleChannelId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  }
  const calendarRepo = {
    findById: vi.fn(),
    findByOrg: vi.fn().mockResolvedValue(over.crmEvents ?? []),
    save: vi.fn(),
    delete: vi.fn(),
    setGoogleMeta: vi.fn(),
    findByOrgAndDate: vi.fn(),
  }
  const gateway = {
    exchangeCode: vi.fn(), refreshAccessToken: vi.fn(), revokeToken: vi.fn(),
    listEvents: vi.fn(), createEvent: vi.fn(), updateEvent: vi.fn(), deleteEvent: vi.fn(),
    watchEvents: vi.fn(), stopChannel: vi.fn(),
    listChanges: vi.fn().mockImplementation(() => Promise.resolve(pages[Math.min(call++, pages.length - 1)])),
  }
  const leadRepo = {
    findById: vi.fn(), findByOrg: vi.fn(), save: vi.fn(), delete: vi.fn(),
    searchByName: vi.fn().mockResolvedValue([]),
    findPendingFollowups: vi.fn(), exportAllWithAssignedName: vi.fn(),
  }
  const contactRepo = {
    findById: vi.fn(), findByOrg: vi.fn(), save: vi.fn(), delete: vi.fn(),
    searchByName: vi.fn().mockResolvedValue([]),
  }

  const useCase = new SyncGoogleCalendarUseCase(
    integrationRepo as any, calendarRepo as any, leadRepo as any, contactRepo as any,
    gateway as any, { generate: () => 'nuevo-id' },
    async (p: string) => p, async (c: string) => c,
  )
  return { useCase, integrationRepo, calendarRepo, gateway, leadRepo, contactRepo }
}

// Las credenciales cifradas se leen con el decryptor de mentira de arriba.
const CREDS = JSON.stringify({
  refresh_token: 'r', access_token: 'a',
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
})

beforeEach(() => vi.clearAllMocks())

describe('SyncGoogleCalendarUseCase', () => {
  it('no hace nada si la cuenta no está conectada', async () => {
    const { useCase, gateway } = makeDeps({ integration: null })
    const r = await useCase.execute({ orgId: 'org1', userId: 'agente1' })
    expect(r.connected).toBe(false)
    expect(r.reason).toBe('not_connected')
    expect(gateway.listChanges).not.toHaveBeenCalled()
  })

  it('pide sólo los cambios cuando ya tiene syncToken', async () => {
    const integration = makeIntegration({ sync_token: 'tok-1' })
    integration.update({ credentials_encrypted: CREDS })
    const { useCase, gateway } = makeDeps({ integration })

    await useCase.execute({ orgId: 'org1', userId: 'agente1' })

    expect(gateway.listChanges.mock.calls[0]![1].syncToken).toBe('tok-1')
  })

  it('guarda el syncToken nuevo para la próxima vez', async () => {
    const integration = makeIntegration({ sync_token: 'tok-1' })
    integration.update({ credentials_encrypted: CREDS })
    const { useCase, integrationRepo } = makeDeps({ integration })

    await useCase.execute({ orgId: 'org1', userId: 'agente1' })

    const guardada = integrationRepo.save.mock.calls[0]![0] as UserIntegration
    expect(guardada.getConfig().sync_token).toBe('tok-2')
  })

  it('resincroniza la ventana entera cuando Google invalida el token', async () => {
    // 410 GONE: no es un error a propagar, es "empezá de nuevo".
    const integration = makeIntegration({ sync_token: 'viejo' })
    integration.update({ credentials_encrypted: CREDS })
    const { useCase, gateway } = makeDeps({
      integration,
      pages: [
        { events: [], next_sync_token: null, sync_token_expired: true },
        { events: [makeGoogleEvent()], next_sync_token: 'tok-nuevo', sync_token_expired: false },
      ],
    })

    const r = await useCase.execute({ orgId: 'org1', userId: 'agente1' })

    expect(r.resynced).toBe(true)
    expect(r.imported).toBe(1)
    // El segundo intento va sin token y con ventana.
    expect(gateway.listChanges.mock.calls[1]![1].syncToken).toBeNull()
    expect(gateway.listChanges.mock.calls[1]![1].timeMin).toBeTruthy()
  })

  it('importa un evento nuevo, tipificado por el título', async () => {
    const integration = makeIntegration()
    integration.update({ credentials_encrypted: CREDS })
    const { useCase, calendarRepo } = makeDeps({
      integration,
      pages: [{ events: [makeGoogleEvent({ summary: 'Tasación Recoleta' })], next_sync_token: 't', sync_token_expired: false }],
    })

    const r = await useCase.execute({ orgId: 'org1', userId: 'agente1' })

    expect(r.imported).toBe(1)
    const guardado = calendarRepo.save.mock.calls[0]![0] as CalendarEvent
    expect(guardado.event_type).toBe('tasacion')
    expect(guardado.google_event_id).toBe('g1')
  })

  it('actualiza el evento que ya existía sin pisar el vínculo corregido a mano', async () => {
    // La heurística adivina el lead; si alguien lo corrigió en el CRM, esa
    // corrección vale más que volver a adivinar.
    const integration = makeIntegration()
    integration.update({ credentials_encrypted: CREDS })
    const existente = makeCrmEvent('g1')
    const { useCase, calendarRepo } = makeDeps({
      integration,
      crmEvents: [existente],
      pages: [{ events: [makeGoogleEvent({ summary: 'Visita reprogramada', start: '2026-09-25T16:00:00.000Z', end: '2026-09-25T17:00:00.000Z' })], next_sync_token: 't', sync_token_expired: false }],
    })

    const r = await useCase.execute({ orgId: 'org1', userId: 'agente1' })

    expect(r.updated).toBe(1)
    expect(r.imported).toBe(0)
    const guardado = calendarRepo.save.mock.calls[0]![0] as CalendarEvent
    expect(guardado.title).toBe('Visita reprogramada')
    expect(guardado.start_at).toBe('2026-09-25T16:00:00.000Z')
    expect(guardado.lead_id).toBe('lead-corregido-a-mano')
  })

  it('no reimporta lo que el propio CRM había espejado en Google', async () => {
    // El eco: sin esto, cada evento que el CRM empuja a Google vuelve como
    // evento nuevo y se duplica.
    const integration = makeIntegration()
    integration.update({ credentials_encrypted: CREDS })
    const { useCase, calendarRepo } = makeDeps({
      integration,
      crmEvents: [makeCrmEvent('g1')],
      pages: [{ events: [makeGoogleEvent({ id: 'g1' })], next_sync_token: 't', sync_token_expired: false }],
    })

    const r = await useCase.execute({ orgId: 'org1', userId: 'agente1' })
    expect(r.imported).toBe(0)
    expect(calendarRepo.save).toHaveBeenCalledTimes(1) // el update, no un alta
  })

  it('borra del CRM lo que se canceló en Google', async () => {
    const integration = makeIntegration()
    integration.update({ credentials_encrypted: CREDS })
    const { useCase, calendarRepo } = makeDeps({
      integration,
      crmEvents: [makeCrmEvent('g1')],
      pages: [{ events: [makeGoogleEvent({ status: 'cancelled' })], next_sync_token: 't', sync_token_expired: false }],
    })

    const r = await useCase.execute({ orgId: 'org1', userId: 'agente1' })
    expect(r.removed).toBe(1)
    expect(calendarRepo.delete).toHaveBeenCalledWith('evt-crm', 'org1')
  })

  it('NO borra un evento ya completado aunque se cancele en Google', async () => {
    // Tiene actividad comercial derivada encima: el trabajo pasó, borrarlo se
    // llevaría puesta la métrica.
    const integration = makeIntegration()
    integration.update({ credentials_encrypted: CREDS })
    const { useCase, calendarRepo } = makeDeps({
      integration,
      crmEvents: [makeCrmEvent('g1', { completed: 1 })],
      pages: [{ events: [makeGoogleEvent({ status: 'cancelled' })], next_sync_token: 't', sync_token_expired: false }],
    })

    const r = await useCase.execute({ orgId: 'org1', userId: 'agente1' })
    expect(r.removed).toBe(0)
    expect(r.skipped).toBe(1)
    expect(calendarRepo.delete).not.toHaveBeenCalled()
  })

  it('vincula al lead nombrado en el título', async () => {
    const integration = makeIntegration()
    integration.update({ credentials_encrypted: CREDS })
    const deps = makeDeps({
      integration,
      pages: [{ events: [makeGoogleEvent({ summary: 'Visita con Micaela Catania' })], next_sync_token: 't', sync_token_expired: false }],
    })
    deps.leadRepo.searchByName.mockResolvedValue([{ id: 'lead-9', full_name: 'Micaela Catania' }])

    const r = await deps.useCase.execute({ orgId: 'org1', userId: 'agente1' })

    expect(r.linked).toBe(1)
    expect((deps.calendarRepo.save.mock.calls[0]![0] as CalendarEvent).lead_id).toBe('lead-9')
  })

  it('la actividad se atribuye al dueño del calendario', async () => {
    const integration = makeIntegration()
    integration.update({ credentials_encrypted: CREDS })
    const { useCase, calendarRepo } = makeDeps({
      integration,
      pages: [{ events: [makeGoogleEvent()], next_sync_token: 't', sync_token_expired: false }],
    })

    await useCase.execute({ orgId: 'org1', userId: 'agente1' })
    expect((calendarRepo.save.mock.calls[0]![0] as CalendarEvent).agent_id).toBe('agente1')
  })
})
