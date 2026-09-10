import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  LogActivityActionExecutor,
  SendInternalEmailActionExecutor,
  AssignLeadActionExecutor,
  AddTagActionExecutor,
  SendWebhookActionExecutor,
  ChangeStageActionExecutor,
} from '../../src/services/automation-executors-crm'

/**
 * Fase 2 de los ejecutores. El contrato bajo test es el mismo de la fase 1:
 * un problema de datos devuelve `skipped` con motivo, la infraestructura rota
 * lanza (reintento), y el efecto queda descripto en `result`.
 */

let idSeq = 0
const ids = { generate: vi.fn(() => `id-${++idSeq}`) }

const CONTEXT = {
  lead: { id: 'L1', full_name: 'Ana Pérez', email: 'ana@mail.com', stage: 'nuevo' },
  agent: { id: 'U1', full_name: 'Marcela', email: 'agente@mg.com.ar' },
  org: { id: 'org_mg', name: 'MG Operaciones', logo_url: null, brand_color: null },
}

const run = (executor: any, config: Record<string, unknown>, context: Record<string, unknown> = CONTEXT) =>
  executor.execute({
    orgId: 'org_mg',
    config,
    rawConfig: config,
    context,
    automationId: 'auto-1',
    runId: 'run-1',
  })

beforeEach(() => {
  vi.clearAllMocks()
  idSeq = 0
})

// ── log_activity ──────────────────────────────────────────────

describe('LogActivityActionExecutor', () => {
  const activities = { save: vi.fn().mockResolvedValue(undefined) }
  const executor = () => new LogActivityActionExecutor(activities as any, ids as any)

  it('registra la actividad atribuida al agente del evento', async () => {
    activities.save.mockResolvedValue(undefined)
    const out = await run(executor(), { activity_type: 'seguimiento', notes: 'Alerta automática' })

    expect(out.status).toBe('success')
    const saved = activities.save.mock.calls[0]![0]
    expect(saved.agent_id).toBe('U1')
    expect(saved.lead_id).toBe('L1')
    expect(saved.description).toBe('Alerta automática')
  })

  it("normaliza tipos fuera del catálogo ('automatizacion' de recetas viejas) a 'seguimiento'", async () => {
    const out = await run(executor(), { activity_type: 'automatizacion', notes: 'x' })
    expect(out.status).toBe('success')
    expect(out.result.activity_type).toBe('seguimiento')
  })

  it('sin agente en el evento se saltea — activities.agent_id es NOT NULL', async () => {
    const out = await run(executor(), { activity_type: 'seguimiento', notes: 'x' }, { lead: CONTEXT.lead })
    expect(out).toEqual({ status: 'skipped', reason: 'no_recipient' })
  })
})

// ── send_internal_email ───────────────────────────────────────

describe('SendInternalEmailActionExecutor', () => {
  const SETTINGS = { from_email: 'hola@mg.com.ar', from_name: 'MG', reply_to: null, enabled: true }
  const email = { send: vi.fn().mockResolvedValue(undefined) }
  const settings = { findByOrg: vi.fn() }
  const users = { findByOrg: vi.fn().mockResolvedValue([]) }
  const executor = () => new SendInternalEmailActionExecutor(settings as any, users as any, email as any)
  const CONFIG = { subject: 'Aviso', body_html: '<p>Pasó algo</p>' }

  beforeEach(() => {
    settings.findByOrg.mockResolvedValue(SETTINGS)
    email.send.mockResolvedValue(undefined)
  })

  it('al agente asignado por default, envuelto en el template y sin link de baja', async () => {
    const out = await run(executor(), CONFIG)

    expect(out.status).toBe('success')
    const sent = email.send.mock.calls[0]![0]
    expect(sent.to.email).toBe('agente@mg.com.ar')
    expect(sent.html).toContain('<p>Pasó algo</p>')
    expect(sent.html).not.toContain('/u/') // interno: sin desuscripción
  })

  it('target admins: manda a cada admin activo con email', async () => {
    users.findByOrg.mockResolvedValue([
      { id: 'a1', role: 'admin', active: true, email: 'admin1@mg.com', full_name: 'A1' },
      { id: 'a2', role: 'owner', active: true, email: 'admin2@mg.com', full_name: 'A2' },
      { id: 'a3', role: 'admin', active: false, email: 'ex@mg.com', full_name: 'Ex' },
      { id: 'a4', role: 'agent', active: true, email: 'agente@mg.com', full_name: 'Ag' },
    ])
    const out = await run(executor(), { ...CONFIG, target: 'admins' })

    expect(out.status).toBe('success')
    expect(out.result.to).toEqual(['admin1@mg.com', 'admin2@mg.com'])
  })

  it('target fija sin email configurado se saltea', async () => {
    const out = await run(executor(), { ...CONFIG, target: 'fixed' })
    expect(out).toEqual({ status: 'skipped', reason: 'no_recipient' })
  })

  it('con el envío de la org apagado se saltea', async () => {
    settings.findByOrg.mockResolvedValue({ ...SETTINGS, enabled: false })
    const out = await run(executor(), CONFIG)
    expect(out).toEqual({ status: 'skipped', reason: 'email_disabled' })
  })
})

// ── assign_lead ───────────────────────────────────────────────

function makeLead(id: string, assignedTo: string | null, stage = 'nuevo') {
  return {
    id,
    assigned_to: assignedTo,
    stage,
    update: vi.fn(function (this: any, data: any) { this.assigned_to = data.assigned_to }),
  }
}

describe('AssignLeadActionExecutor', () => {
  const leads = { findById: vi.fn(), findByOrg: vi.fn().mockResolvedValue([]), save: vi.fn().mockResolvedValue(undefined) }
  const users = { findByOrg: vi.fn().mockResolvedValue([]) }
  const executor = () => new AssignLeadActionExecutor(leads as any, users as any)

  const AGENTS = [
    { id: 'u-a', role: 'agent', active: true },
    { id: 'u-b', role: 'agent', active: true },
    { id: 'u-inactivo', role: 'agent', active: false },
    { id: 'u-otro-rol', role: 'viewer', active: true },
  ]

  beforeEach(() => {
    leads.save.mockResolvedValue(undefined)
    leads.findByOrg.mockResolvedValue([])
    users.findByOrg.mockResolvedValue(AGENTS)
  })

  it('reparte al agente activo con menos leads abiertos', async () => {
    const lead = makeLead('L1', null)
    leads.findById.mockResolvedValue(lead)
    // u-a tiene 2 abiertos y 1 cerrado; u-b tiene 1 abierto → le toca a u-b.
    leads.findByOrg.mockResolvedValue([
      makeLead('x1', 'u-a'), makeLead('x2', 'u-a'), makeLead('x3', 'u-a', 'perdido'),
      makeLead('x4', 'u-b'),
    ])

    const out = await run(executor(), { mode: 'round_robin' })

    expect(out).toMatchObject({ status: 'success', result: { assigned_to: 'u-b' } })
    expect(leads.save).toHaveBeenCalledWith(lead)
  })

  it('no pisa una asignación existente salvo opt-out explícito', async () => {
    leads.findById.mockResolvedValue(makeLead('L1', 'u-a'))
    const out = await run(executor(), { mode: 'round_robin' })
    expect(out).toEqual({ status: 'skipped', reason: 'already_assigned' })

    const lead = makeLead('L1', 'u-a')
    leads.findById.mockResolvedValue(lead)
    const forced = await run(executor(), { mode: 'specific_user', user_id: 'u-b', only_if_unassigned: false })
    expect(forced.status).toBe('success')
    expect(lead.assigned_to).toBe('u-b')
  })

  it('agente específico inactivo o inexistente se saltea', async () => {
    leads.findById.mockResolvedValue(makeLead('L1', null))
    const out = await run(executor(), { mode: 'specific_user', user_id: 'u-inactivo' })
    expect(out).toEqual({ status: 'skipped', reason: 'no_recipient' })
  })

  it('sin lead en el evento se saltea', async () => {
    const out = await run(executor(), { mode: 'round_robin' }, { org: CONTEXT.org })
    expect(out).toEqual({ status: 'skipped', reason: 'no_lead' })
  })
})

// ── add_tag ───────────────────────────────────────────────────

describe('AddTagActionExecutor', () => {
  const tags = {
    findByName: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    addToLead: vi.fn().mockResolvedValue(undefined),
  }
  const executor = () => new AddTagActionExecutor(tags as any, ids as any)

  beforeEach(() => {
    tags.findByName.mockResolvedValue(null)
    tags.save.mockResolvedValue(undefined)
    tags.addToLead.mockResolvedValue(undefined)
  })

  it('reusa la etiqueta existente y crea la que falta', async () => {
    tags.findByName.mockImplementation(async (_org: string, name: string) =>
      name === 'inversor' ? { id: 'tag-inv', name } : null,
    )

    const out = await run(executor(), { tags: ['inversor', 'urgente'] })

    expect(out.status).toBe('success')
    expect(tags.save).toHaveBeenCalledTimes(1) // sólo 'urgente' se creó
    expect(tags.addToLead).toHaveBeenCalledWith('L1', 'tag-inv', 'org_mg')
    expect(out.result.tags).toEqual(['inversor', 'urgente'])
  })

  it('sin lead o sin etiquetas configuradas se saltea', async () => {
    expect(await run(executor(), { tags: ['x'] }, { org: CONTEXT.org }))
      .toEqual({ status: 'skipped', reason: 'no_lead' })
    expect(await run(executor(), { tags: [] }))
      .toEqual({ status: 'skipped', reason: 'empty_content' })
  })
})

// ── send_webhook ──────────────────────────────────────────────

describe('SendWebhookActionExecutor', () => {
  const sender = { send: vi.fn() }
  const executor = () => new SendWebhookActionExecutor(sender as any)

  it('postea el contexto firmado y reporta el status', async () => {
    sender.send.mockResolvedValue({ ok: true, status: 200, error: null })

    const out = await run(executor(), { url: 'https://n8n.mg.com/hook', secret: 's3cr3t' })

    expect(out).toMatchObject({ status: 'success', result: { http_status: 200 } })
    const [url, secret, body] = sender.send.mock.calls[0]!
    expect(url).toBe('https://n8n.mg.com/hook')
    expect(secret).toBe('s3cr3t')
    const payload = JSON.parse(body)
    expect(payload.event).toBe('automation.action')
    expect(payload.context.lead.id).toBe('L1')
    expect(payload.context.__depth).toBeUndefined() // interno del motor, no sale
  })

  it('una URL inválida se saltea; un HTTP no-2xx lanza para reintentar', async () => {
    expect(await run(executor(), { url: 'ftp://x' })).toEqual({ status: 'skipped', reason: 'invalid_url' })

    sender.send.mockResolvedValue({ ok: false, status: 500, error: 'HTTP 500' })
    await expect(run(executor(), { url: 'https://n8n.mg.com/hook' })).rejects.toThrow('webhook 500')
  })
})

// ── change_stage ──────────────────────────────────────────────

describe('ChangeStageActionExecutor', () => {
  const advanceLead = { execute: vi.fn() }
  const updateProperty = { execute: vi.fn() }
  const chain = vi.fn().mockResolvedValue(undefined)
  const executor = () => new ChangeStageActionExecutor(advanceLead as any, updateProperty as any, chain)

  beforeEach(() => {
    advanceLead.execute.mockResolvedValue({ fromStage: 'nuevo', syncedPropertyId: null, syncedPropertyStage: null })
    updateProperty.execute.mockResolvedValue({ fromStage: 'propuesta', syncedLeadId: null, leadSync: null })
    chain.mockResolvedValue(undefined)
  })

  it('mueve el lead y re-dispara lead.stage_changed a depth+1', async () => {
    const out = await run(executor(), { to_stage: 'contactado' }, { ...CONTEXT, __depth: 0 })

    expect(out).toMatchObject({ status: 'success', result: { from: 'nuevo', to: 'contactado' } })
    expect(advanceLead.execute).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: 'L1', newStage: 'contactado', changedBy: 'U1' }),
    )
    expect(chain).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: 'lead.stage_changed', depth: 1, stage: { from: 'nuevo', to: 'contactado' } }),
    )
  })

  it('con una propiedad en el contexto (y sin lead) usa la máquina de propiedades', async () => {
    const context = { property: { id: 'P1' }, agent: CONTEXT.agent, org: CONTEXT.org }
    const out = await run(executor(), { to_stage: 'publicada' }, context)

    expect(out.status).toBe('success')
    expect(updateProperty.execute).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId: 'P1', newStage: 'publicada' }),
    )
    expect(chain).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'property.stage_changed' }))
  })

  it('una transición inválida queda skipped con el motivo, sin reintentos', async () => {
    const { ValidationError } = await import('@vendepro/core')
    advanceLead.execute.mockRejectedValue(new ValidationError('Transición inválida: nuevo → captado'))

    const out = await run(executor(), { to_stage: 'captado' })

    expect(out.status).toBe('skipped')
    expect(out.reason).toContain('invalid_transition')
  })

  it('si el encadenamiento falla, la acción igual es success — la etapa ya cambió', async () => {
    chain.mockRejectedValue(new Error('motor caído'))
    const out = await run(executor(), { to_stage: 'contactado' })
    expect(out.status).toBe('success')
  })
})
