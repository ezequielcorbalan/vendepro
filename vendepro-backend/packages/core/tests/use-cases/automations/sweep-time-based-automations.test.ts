import { describe, it, expect, vi } from 'vitest'
import { SweepTimeBasedAutomationsUseCase } from '../../../src/application/use-cases/automations/sweep-time-based-automations'

// El sweep solo lee id/org_id/trigger_type/trigger_config/dedupe_scope de la
// automatización, así que alcanza con objetos planos con esa forma.
const auto = (id: string, trigger: string, config: Record<string, unknown> = {}, orgId = 'org_mg', dedupeScope = 'once') =>
  ({ automation: { id, org_id: orgId, trigger_type: trigger, trigger_config: config, dedupe_scope: dedupeScope }, actions: [] }) as any

function makeDeps() {
  const automations = { findActiveTimeBased: vi.fn().mockResolvedValue([]) } as any
  const candidates = {
    findLeadsWithoutContact: vi.fn().mockResolvedValue([]),
    findLeadsWithoutActivity: vi.fn().mockResolvedValue([]),
    findPropertiesWithExpiringAuthorization: vi.fn().mockResolvedValue([]),
  } as any
  const contextBuilder = { execute: vi.fn().mockResolvedValue({ now: { date: 'x', iso: 'x' } }) } as any
  const runner = { execute: vi.fn().mockResolvedValue({ evaluated: 1, queued: 1, results: [] }) } as any
  return { automations, candidates, contextBuilder, runner }
}

describe('SweepTimeBasedAutomationsUseCase', () => {
  it('sin automatizaciones activas no consulta candidatos', async () => {
    const d = makeDeps()
    const uc = new SweepTimeBasedAutomationsUseCase(d.automations, d.candidates, d.contextBuilder, d.runner)
    const out = await uc.execute()
    expect(out).toEqual({ automations: 0, entities: 0, queued: 0 })
    expect(d.candidates.findLeadsWithoutContact).not.toHaveBeenCalled()
  })

  it('dispara el runner por cada lead sin contactar, con las horas de la config', async () => {
    const d = makeDeps()
    d.automations.findActiveTimeBased.mockResolvedValue([auto('a1', 'lead.sin_contacto_24h', { horas: 48 })])
    d.candidates.findLeadsWithoutContact.mockResolvedValue(['l1', 'l2'])

    const now = new Date('2026-09-10T12:00:00Z')
    const uc = new SweepTimeBasedAutomationsUseCase(d.automations, d.candidates, d.contextBuilder, d.runner)
    const out = await uc.execute({ now })

    // Scope 'once' → notRunSince null (una vez en la vida del lead).
    expect(d.candidates.findLeadsWithoutContact).toHaveBeenCalledWith('org_mg', 'a1', null, 48, now, 50)
    expect(d.runner.execute).toHaveBeenCalledTimes(2)
    expect(d.runner.execute).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 'org_mg',
      trigger: 'lead.sin_contacto_24h',
      entityType: 'lead',
      entityId: 'l1',
      now,
    }))
    expect(out).toEqual({ automations: 1, entities: 2, queued: 2 })
  })

  it('config ausente o inválida cae en los defaults del catálogo (24h / 7d / 7d)', async () => {
    const d = makeDeps()
    d.automations.findActiveTimeBased.mockResolvedValue([
      auto('a1', 'lead.sin_contacto_24h', {}),
      auto('a2', 'lead.sin_respuesta_7d', { dias: 'no-numero' }),
      auto('a3', 'property.publicacion_vencida', { dias_antes: -3 }),
    ])
    const uc = new SweepTimeBasedAutomationsUseCase(d.automations, d.candidates, d.contextBuilder, d.runner)
    await uc.execute()

    expect(d.candidates.findLeadsWithoutContact).toHaveBeenCalledWith('org_mg', 'a1', null, 24, expect.any(Date), 50)
    expect(d.candidates.findLeadsWithoutActivity).toHaveBeenCalledWith('org_mg', 'a2', null, 7, expect.any(Date), 50)
    expect(d.candidates.findPropertiesWithExpiringAuthorization).toHaveBeenCalledWith('org_mg', 'a3', null, 7, expect.any(Date), 50)
  })

  it('el trigger de propiedades dispara con entityType property', async () => {
    const d = makeDeps()
    d.automations.findActiveTimeBased.mockResolvedValue([auto('a1', 'property.publicacion_vencida', { dias_antes: 10 })])
    d.candidates.findPropertiesWithExpiringAuthorization.mockResolvedValue(['p1'])

    const uc = new SweepTimeBasedAutomationsUseCase(d.automations, d.candidates, d.contextBuilder, d.runner)
    await uc.execute()

    expect(d.runner.execute).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'property', entityId: 'p1' }))
  })

  it('una automatización que falla no frena a las demás (multi-org)', async () => {
    const d = makeDeps()
    d.automations.findActiveTimeBased.mockResolvedValue([
      auto('rota', 'lead.sin_contacto_24h', {}, 'org_a'),
      auto('sana', 'lead.sin_contacto_24h', {}, 'org_b'),
    ])
    d.candidates.findLeadsWithoutContact
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(['l9'])

    const uc = new SweepTimeBasedAutomationsUseCase(d.automations, d.candidates, d.contextBuilder, d.runner)
    const out = await uc.execute()

    expect(d.runner.execute).toHaveBeenCalledTimes(1)
    expect(d.runner.execute).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org_b', entityId: 'l9' }))
    expect(out.queued).toBe(1)
  })

  it('un trigger desconocido se ignora sin romper', async () => {
    const d = makeDeps()
    d.automations.findActiveTimeBased.mockResolvedValue([auto('a1', 'lead.inventado', {})])
    const uc = new SweepTimeBasedAutomationsUseCase(d.automations, d.candidates, d.contextBuilder, d.runner)
    const out = await uc.execute()
    expect(out).toEqual({ automations: 1, entities: 0, queued: 0 })
    expect(d.runner.execute).not.toHaveBeenCalled()
  })

  it('respeta el límite por automatización que se le pasa', async () => {
    const d = makeDeps()
    d.automations.findActiveTimeBased.mockResolvedValue([auto('a1', 'lead.sin_contacto_24h', {})])
    const uc = new SweepTimeBasedAutomationsUseCase(d.automations, d.candidates, d.contextBuilder, d.runner)
    await uc.execute({ limitPerAutomation: 5 })
    expect(d.candidates.findLeadsWithoutContact).toHaveBeenCalledWith('org_mg', 'a1', null, 24, expect.any(Date), 5)
  })

  it("scope 'daily' (y 'always') acota el pre-filtro al día UTC actual", async () => {
    const d = makeDeps()
    d.automations.findActiveTimeBased.mockResolvedValue([
      auto('a1', 'lead.sin_contacto_24h', {}, 'org_mg', 'daily'),
      auto('a2', 'lead.sin_respuesta_7d', {}, 'org_mg', 'always'),
    ])
    const now = new Date('2026-09-10T18:30:00Z')
    const uc = new SweepTimeBasedAutomationsUseCase(d.automations, d.candidates, d.contextBuilder, d.runner)
    await uc.execute({ now })

    expect(d.candidates.findLeadsWithoutContact)
      .toHaveBeenCalledWith('org_mg', 'a1', '2026-09-10T00:00:00.000Z', 24, now, 50)
    // 'always' no dedupea en el claim; el barrido lo limita a 1/día igual.
    expect(d.candidates.findLeadsWithoutActivity)
      .toHaveBeenCalledWith('org_mg', 'a2', '2026-09-10T00:00:00.000Z', 7, now, 50)
  })
})
