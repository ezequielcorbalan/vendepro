import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  SweepTimeBasedAutomationsUseCase,
  SWEEP_CANDIDATES_LIMIT,
} from '../../../src/application/use-cases/automations/sweep-time-based-automations'
import { Automation } from '../../../src/domain/entities/automation'
import type { AutomationWithActions } from '../../../src/application/ports/repositories/automation-repository'

const mockAutomations = {
  findById: vi.fn(),
  findByOrg: vi.fn(),
  findActiveByTrigger: vi.fn(),
  findSystemCatalog: vi.fn(),
  findSystemByTemplateKey: vi.fn(),
  findActivatedTemplateKeys: vi.fn(),
  findActiveTimeBased: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
  setActive: vi.fn(),
}

const mockCandidates = {
  leadsSinContacto: vi.fn().mockResolvedValue([]),
  leadsSinRespuesta: vi.fn().mockResolvedValue([]),
  propiedadesPorVencer: vi.fn().mockResolvedValue([]),
}

const dispatch = vi.fn().mockResolvedValue(null)

// 10-sep-2026 12:30 UTC — fija para poder asertar los cortes exactos.
const NOW = new Date('2026-09-10T12:30:00.000Z')

function makeTimeBased(overrides: {
  id?: string
  orgId?: string | null
  trigger_type?: string
  trigger_config?: Record<string, unknown>
  dedupe_scope?: string
} = {}): AutomationWithActions {
  const automation = Automation.create({
    id: overrides.id ?? 'auto-sla',
    org_id: overrides.orgId === undefined ? 'org_mg' : overrides.orgId,
    name: 'Alerta: lead sin contactar',
    description: null,
    template_key: null,
    is_system: overrides.orgId === null,
    trigger_type: (overrides.trigger_type ?? 'lead.sin_contacto_24h') as any,
    trigger_config: overrides.trigger_config ?? { horas: 24 },
    conditions: [],
    dedupe_scope: overrides.dedupe_scope ?? 'once',
    is_active: true,
    created_by: null,
  })
  return { automation, actions: [] }
}

function useCase() {
  return new SweepTimeBasedAutomationsUseCase(mockAutomations as any, mockCandidates as any, dispatch)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAutomations.findActiveTimeBased.mockResolvedValue([])
  mockCandidates.leadsSinContacto.mockResolvedValue([])
  mockCandidates.leadsSinRespuesta.mockResolvedValue([])
  mockCandidates.propiedadesPorVencer.mockResolvedValue([])
  dispatch.mockResolvedValue(null)
})

describe('SweepTimeBasedAutomationsUseCase', () => {
  it('sin automatizaciones activas no consulta candidatos ni despacha', async () => {
    const out = await useCase().execute({ now: NOW })
    expect(out).toEqual({ automations: 0, dispatched: 0 })
    expect(mockCandidates.leadsSinContacto).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('despacha un evento por candidato con el trigger y la entidad correctos', async () => {
    mockAutomations.findActiveTimeBased.mockResolvedValue([makeTimeBased()])
    mockCandidates.leadsSinContacto.mockResolvedValue(['lead-1', 'lead-2'])

    const out = await useCase().execute({ now: NOW })

    expect(out).toEqual({ automations: 1, dispatched: 2 })
    expect(dispatch).toHaveBeenCalledTimes(2)
    expect(dispatch).toHaveBeenCalledWith({
      orgId: 'org_mg',
      trigger: 'lead.sin_contacto_24h',
      entityType: 'lead',
      entityId: 'lead-1',
    })
  })

  it('calcula el corte desde el umbral configurado (horas)', async () => {
    mockAutomations.findActiveTimeBased.mockResolvedValue([
      makeTimeBased({ trigger_config: { horas: 48 } }),
    ])

    await useCase().execute({ now: NOW })

    // NOW - 48h = 2026-09-08 12:30:00, en formato SQLite (UTC, sin 'T').
    expect(mockCandidates.leadsSinContacto).toHaveBeenCalledWith({
      orgId: 'org_mg',
      automationId: 'auto-sla',
      notRunSince: null, // scope 'once' → excluir si corrió alguna vez
      limit: SWEEP_CANDIDATES_LIMIT,
      createdBefore: '2026-09-08 12:30:00',
    })
  })

  it('usa el default del catálogo cuando el umbral está vacío o roto', async () => {
    mockAutomations.findActiveTimeBased.mockResolvedValue([
      makeTimeBased({ trigger_type: 'lead.sin_respuesta_7d', trigger_config: { dias: 'x' } }),
    ])

    await useCase().execute({ now: NOW })

    // default 7 días → 2026-09-03 12:30:00
    expect(mockCandidates.leadsSinRespuesta).toHaveBeenCalledWith(
      expect.objectContaining({ inactiveSince: '2026-09-03 12:30:00' }),
    )
  })

  it("scope 'daily' acota el filtro anti-re-disparo al día UTC en curso", async () => {
    mockAutomations.findActiveTimeBased.mockResolvedValue([
      makeTimeBased({ dedupe_scope: 'daily' }),
    ])

    await useCase().execute({ now: NOW })

    expect(mockCandidates.leadsSinContacto).toHaveBeenCalledWith(
      expect.objectContaining({ notRunSince: '2026-09-10' }),
    )
  })

  it("scope 'always' también recibe el piso diario (única guarda contra el tick)", async () => {
    mockAutomations.findActiveTimeBased.mockResolvedValue([
      makeTimeBased({ dedupe_scope: 'always' }),
    ])

    await useCase().execute({ now: NOW })

    expect(mockCandidates.leadsSinContacto).toHaveBeenCalledWith(
      expect.objectContaining({ notRunSince: '2026-09-10' }),
    )
  })

  it('propiedades por vencer: pasa la ventana en días con el día de hoy', async () => {
    mockAutomations.findActiveTimeBased.mockResolvedValue([
      makeTimeBased({
        id: 'auto-vence',
        trigger_type: 'property.publicacion_vencida',
        trigger_config: { dias_antes: 10 },
      }),
    ])
    mockCandidates.propiedadesPorVencer.mockResolvedValue(['prop-1'])

    const out = await useCase().execute({ now: NOW })

    expect(mockCandidates.propiedadesPorVencer).toHaveBeenCalledWith(
      expect.objectContaining({ hoy: '2026-09-10', diasAntes: 10 }),
    )
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: 'property.publicacion_vencida', entityType: 'property', entityId: 'prop-1' }),
    )
    expect(out.dispatched).toBe(1)
  })

  it('una automatización que falla no frena a las demás', async () => {
    mockAutomations.findActiveTimeBased.mockResolvedValue([
      makeTimeBased({ id: 'auto-rota' }),
      makeTimeBased({ id: 'auto-sana', trigger_type: 'lead.sin_respuesta_7d', trigger_config: { dias: 7 } }),
    ])
    mockCandidates.leadsSinContacto.mockRejectedValue(new Error('boom'))
    mockCandidates.leadsSinRespuesta.mockResolvedValue(['lead-9'])

    const out = await useCase().execute({ now: NOW })

    expect(out).toEqual({ automations: 2, dispatched: 1 })
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'lead-9' }))
  })
})
