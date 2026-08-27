import { describe, it, expect } from 'vitest'
import { Automation } from '../../src/domain/entities/automation'
import { AutomationAction, MAX_DELAY_MINUTES } from '../../src/domain/entities/automation-action'
import { AutomationRun, AutomationRunAction } from '../../src/domain/entities/automation-run'
import { AutomationJob, MAX_JOB_ATTEMPTS } from '../../src/domain/entities/automation-job'
import { ValidationError } from '../../src/domain/errors/validation-error'

const base = {
  id: 'auto-1',
  org_id: 'org_mg',
  name: 'Bienvenida al lead',
  description: null,
  template_key: null,
  is_system: false,
  trigger_type: 'lead.created' as const,
  is_active: true,
  created_by: 'user-1',
}

describe('Automation', () => {
  it('el dedupe_scope cae a daily ante un valor desconocido o ausente', () => {
    expect(Automation.create(base).dedupe_scope).toBe('daily')
    expect(Automation.create({ ...base, dedupe_scope: 'once' }).dedupe_scope).toBe('once')
    expect(Automation.create({ ...base, dedupe_scope: 'siempre' }).dedupe_scope).toBe('daily')
  })

  it('exige nombre y trigger conocido', () => {
    expect(() => Automation.create({ ...base, name: 'x' })).toThrow(ValidationError)
    expect(() => Automation.create({ ...base, trigger_type: 'lead.inventado' as any })).toThrow(ValidationError)
  })

  it('exige org_id salvo que sea receta de sistema', () => {
    expect(() => Automation.create({ ...base, org_id: null })).toThrow(ValidationError)
    expect(() => Automation.create({ ...base, org_id: null, is_system: true })).not.toThrow()
  })

  it('acepta trigger_config como objeto o como JSON string', () => {
    const a = Automation.create({ ...base, trigger_type: 'lead.stage_changed', trigger_config: { to_stage: 'captado' } })
    const b = Automation.create({ ...base, trigger_type: 'lead.stage_changed', trigger_config: '{"to_stage":"captado"}' })
    expect(a.trigger_config).toEqual({ to_stage: 'captado' })
    expect(b.trigger_config).toEqual({ to_stage: 'captado' })
  })

  it('rechaza trigger_config que no sea JSON válido', () => {
    expect(() => Automation.create({ ...base, trigger_config: '{roto' })).toThrow(ValidationError)
  })

  it('exige los campos requeridos del trigger, salvo to_stage', () => {
    // `dias` es requerido en lead.sin_respuesta_7d.
    expect(() => Automation.create({ ...base, trigger_type: 'lead.sin_respuesta_7d', trigger_config: {} })).toThrow(ValidationError)
    // `to_stage` vacío es válido: significa "cualquier etapa".
    expect(() => Automation.create({ ...base, trigger_type: 'lead.stage_changed', trigger_config: {} })).not.toThrow()
  })

  it('matchesEvent filtra por to_stage y from_stage', () => {
    const a = Automation.create({ ...base, trigger_type: 'lead.stage_changed', trigger_config: { to_stage: 'captado' } })
    expect(a.matchesEvent({ to_stage: 'captado' })).toBe(true)
    expect(a.matchesEvent({ to_stage: 'contactado' })).toBe(false)

    const b = Automation.create({ ...base, trigger_type: 'lead.stage_changed', trigger_config: { to_stage: 'captado', from_stage: 'presentada' } })
    expect(b.matchesEvent({ to_stage: 'captado', from_stage: 'presentada' })).toBe(true)
    expect(b.matchesEvent({ to_stage: 'captado', from_stage: 'seguimiento' })).toBe(false)
  })

  it('expone la entidad del trigger y si es por tiempo', () => {
    expect(Automation.create(base).entity_type).toBe('lead')
    expect(Automation.create(base).is_time_based).toBe(false)
    const timed = Automation.create({ ...base, trigger_type: 'lead.sin_contacto_24h', trigger_config: { horas: 24 } })
    expect(timed.is_time_based).toBe(true)
    expect(timed.thresholdOr('horas', 48)).toBe(24)
    expect(timed.thresholdOr('inexistente', 48)).toBe(48)
  })

  it('no deja editar una receta del catálogo', () => {
    const system = Automation.create({ ...base, org_id: null, is_system: true, template_key: 'lead_bienvenida' })
    expect(() => system.update({ name: 'Mía' })).toThrow(ValidationError)
  })

  it('instantiateForOrg copia la receta como automatización propia y activa', () => {
    const system = Automation.create({ ...base, org_id: null, is_system: true, template_key: 'lead_bienvenida' })
    const copy = system.instantiateForOrg({ id: 'auto-copia', orgId: 'org_mg', createdBy: 'user-9' })

    expect(copy.id).toBe('auto-copia')
    expect(copy.org_id).toBe('org_mg')
    expect(copy.is_system).toBe(false)
    expect(copy.is_active).toBe(true)
    expect(copy.template_key).toBe('lead_bienvenida')
    expect(copy.created_by).toBe('user-9')
  })
})

describe('AutomationAction', () => {
  const actionBase = {
    id: 'act-1',
    automation_id: 'auto-1',
    org_id: 'org_mg',
    order_index: 0,
    action_type: 'send_email' as const,
    delay_minutes: 0,
  }

  it('exige los campos requeridos de la acción', () => {
    expect(() => AutomationAction.create({ ...actionBase, action_config: {} })).toThrow(ValidationError)
    expect(() =>
      AutomationAction.create({ ...actionBase, action_config: { subject: 'Hola', body_html: '<p>x</p>' } }),
    ).not.toThrow()
  })

  it('rechaza una acción desconocida', () => {
    expect(() => AutomationAction.create({ ...actionBase, action_type: 'enviar_paloma' as any })).toThrow(ValidationError)
  })

  it('acota el delay a un rango razonable', () => {
    const cfg = { subject: 'Hola', body_html: '<p>x</p>' }
    expect(() => AutomationAction.create({ ...actionBase, action_config: cfg, delay_minutes: -1 })).toThrow(ValidationError)
    expect(() => AutomationAction.create({ ...actionBase, action_config: cfg, delay_minutes: MAX_DELAY_MINUTES + 1 })).toThrow(ValidationError)
    expect(AutomationAction.create({ ...actionBase, action_config: cfg, delay_minutes: 1440 }).delay_minutes).toBe(1440)
  })

  it('calcula run_at desde el momento del disparo', () => {
    const action = AutomationAction.create({
      ...actionBase,
      action_config: { subject: 'Hola', body_html: '<p>x</p>' },
      delay_minutes: 4320,
    })
    expect(action.is_immediate).toBe(false)
    expect(action.runAtFrom(new Date('2026-08-27T10:00:00.000Z'))).toBe('2026-08-30T10:00:00.000Z')
  })

  it('configBool interpreta lo que manda el editor', () => {
    const action = AutomationAction.create({
      ...actionBase,
      action_config: { subject: 'x', body_html: '<p>x</p>', include_unsubscribe: 'false', reply_to_agent: 1 },
    })
    expect(action.configBool('include_unsubscribe', true)).toBe(false)
    expect(action.configBool('reply_to_agent', false)).toBe(true)
    expect(action.configBool('inexistente', true)).toBe(true)
  })
})

describe('AutomationRun', () => {
  const runBase = {
    id: 'run-1',
    org_id: 'org_mg',
    automation_id: 'auto-1',
    trigger_event: 'lead.created',
    entity_type: 'lead' as const,
    entity_id: 'lead-1',
    payload: null,
    depth: 0,
    dedupe_key: null,
  }

  it('sin entidad no hay dedupe_key: no se puede deduplicar', () => {
    expect(AutomationRun.dedupeKey({ automationId: 'a', entityId: null, triggerEvent: 'e' })).toBeNull()
  })

  it("scope 'daily' (default) cambia de clave al pasar el día", () => {
    const key = (at: string) => AutomationRun.dedupeKey({ automationId: 'a', entityId: 'l1', triggerEvent: 'e', at: new Date(at) })
    expect(key('2026-08-27T08:00:00Z')).toBe(key('2026-08-27T23:59:00Z'))
    expect(key('2026-08-28T00:01:00Z')).not.toBe(key('2026-08-27T08:00:00Z'))
  })

  it("scope 'once' da la misma clave siempre: nadie se re-inscribe en una bienvenida", () => {
    const key = (at: string) => AutomationRun.dedupeKey({ automationId: 'a', entityId: 'l1', triggerEvent: 'e', scope: 'once', at: new Date(at) })
    expect(key('2026-08-27T08:00:00Z')).toBe(key('2027-01-15T08:00:00Z'))
    expect(key('2026-08-27T08:00:00Z')).toBe('a:l1:e')
  })

  it("scope 'always' no genera clave: se ejecuta en cada disparo", () => {
    expect(AutomationRun.dedupeKey({ automationId: 'a', entityId: 'l1', triggerEvent: 'e', scope: 'always' })).toBeNull()
  })

  it('canChain depende de la profundidad', () => {
    expect(AutomationRun.create({ ...runBase, depth: 0 }).canChain).toBe(true)
    expect(AutomationRun.create({ ...runBase, depth: 1 }).canChain).toBe(false)
  })

  it('settle resuelve success, partial y failed', () => {
    const run = () => AutomationRun.create(runBase)

    const ok = run()
    ok.settle([{ status: 'success' }, { status: 'skipped' }])
    expect(ok.status).toBe('success')

    const partial = run()
    partial.settle([{ status: 'success' }, { status: 'failed' }])
    expect(partial.status).toBe('partial')

    const failed = run()
    failed.settle([{ status: 'failed' }, { status: 'failed' }])
    expect(failed.status).toBe('failed')
  })

  it('settle deja el run abierto si alguna acción sigue pendiente', () => {
    const run = AutomationRun.create(runBase)
    run.settle([{ status: 'success' }, { status: 'pending' }])
    expect(run.status).toBe('pending')
    expect(run.finished_at).toBeNull()
  })
})

describe('AutomationJob', () => {
  const jobBase = {
    id: 'job-1',
    org_id: 'org_mg',
    run_id: 'run-1',
    run_action_id: 'ra-1',
    automation_id: 'auto-1',
    action_id: 'act-1',
    action_type: 'send_email',
    context: {},
    action_config: {},
    run_at: '2026-08-27T10:00:00.000Z',
  }

  it('isDue compara contra run_at y sólo aplica a pendientes', () => {
    const job = AutomationJob.create(jobBase)
    expect(job.isDue(new Date('2026-08-27T09:59:00Z'))).toBe(false)
    expect(job.isDue(new Date('2026-08-27T10:00:00Z'))).toBe(true)
    job.markRunning()
    expect(job.isDue(new Date('2026-08-27T11:00:00Z'))).toBe(false)
  })

  it('el backoff crece entre intentos y se corta al máximo', () => {
    const job = AutomationJob.create(jobBase)
    const now = new Date('2026-08-27T10:00:00.000Z')

    job.markRunning(now)
    job.markAttemptFailed('err', now)
    expect(job.run_at).toBe('2026-08-27T10:05:00.000Z')

    job.markRunning(now)
    job.markAttemptFailed('err', now)
    expect(job.run_at).toBe('2026-08-27T10:25:00.000Z')

    job.markRunning(now)
    expect(job.attempts).toBe(MAX_JOB_ATTEMPTS)
    job.markAttemptFailed('err', now)
    expect(job.status).toBe('failed')
  })

  it('cancel deja constancia del motivo', () => {
    const job = AutomationJob.create(jobBase)
    job.cancel('automation_disabled')
    expect(job.status).toBe('cancelled')
    expect(job.last_error).toBe('automation_disabled')
  })
})

describe('AutomationRunAction', () => {
  it('recorta errores largos para no reventar la fila', () => {
    const action = AutomationRunAction.create({
      id: 'ra-1', run_id: 'run-1', org_id: 'org_mg', action_id: 'act-1', action_type: 'send_email',
    })
    action.markFailed('x'.repeat(5000))
    expect(action.error).toHaveLength(2000)
    expect(action.executed_at).not.toBeNull()
  })
})
