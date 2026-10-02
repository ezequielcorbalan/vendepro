import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AssignLeadUseCase } from '../../../src/application/use-cases/leads/assign-lead'
import { Lead } from '../../../src/domain/entities/lead'
import { User } from '../../../src/domain/entities/user'
import { NotFoundError } from '../../../src/domain/errors/not-found'
import { ForbiddenError } from '../../../src/domain/errors/forbidden'
import { ValidationError } from '../../../src/domain/errors/validation-error'

const makeLead = (assignedTo: string | null = 'agent-1') => Lead.create({
  id: 'lead-1', org_id: 'org_mg', full_name: 'Juan Pérez', phone: '1134567890',
  email: null, source: 'manual', source_detail: null, property_address: null,
  neighborhood: 'Palermo', property_type: 'departamento', operation: 'venta',
  stage: 'nuevo', assigned_to: assignedTo, notes: null, estimated_value: null,
  budget: null, timing: null, personas_trabajo: null, mascotas: null,
  next_step: null, next_step_date: null, lost_reason: null, first_contact_at: null,
  contact_id: 'contact-1',
})

const makeUser = (id: string, overrides: Partial<{ full_name: string; email: string; active: number }> = {}) =>
  User.create({
    id, org_id: 'org_mg', email: overrides.email ?? `${id}@test.com`,
    password_hash: 'x', full_name: overrides.full_name ?? `Agente ${id}`,
    role: 'agent', active: overrides.active ?? 1,
  } as any)

function build(overrides: {
  lead?: Lead | null
  users?: Record<string, User | null>
  email?: ConstructorParameters<typeof AssignLeadUseCase>[5]
} = {}) {
  const lead = overrides.lead === undefined ? makeLead() : overrides.lead
  const users: Record<string, User | null> = overrides.users ?? {
    'agent-2': makeUser('agent-2', { full_name: 'Lucía Ruiz', email: 'lucia@test.com' }),
    'admin-1': makeUser('admin-1', { full_name: 'Marcela Genta' }),
  }
  const leads = { findById: vi.fn(async () => lead), save: vi.fn() }
  const userRepo = { findById: vi.fn(async (id: string) => users[id] ?? null) }
  const notifications = { save: vi.fn() }
  const activities = { save: vi.fn() }
  const ids = { generate: vi.fn(() => 'generated-id') }
  const uc = new AssignLeadUseCase(
    leads as any, userRepo as any, notifications as any, activities as any,
    ids as any, overrides.email, 'https://app.vendepro.com.ar',
  )
  return { uc, leads, userRepo, notifications, activities, lead }
}

const input = {
  leadId: 'lead-1', orgId: 'org_mg', toAgentId: 'agent-2',
  actorId: 'admin-1', actorRole: 'admin', note: 'Llamalo hoy',
}

describe('AssignLeadUseCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('cambia el agente y guarda el lead', async () => {
    const { uc, leads } = build()
    const result = await uc.execute(input)

    expect(result.fromAgentId).toBe('agent-1')
    expect(result.toAgentId).toBe('agent-2')
    expect(result.unchanged).toBe(false)
    expect(leads.save).toHaveBeenCalledOnce()
    expect(leads.save.mock.calls[0][0].assigned_to).toBe('agent-2')
  })

  it('le avisa al agente que recibe, con el link y la instrucción', async () => {
    const { uc, notifications } = build()
    const result = await uc.execute(input)

    expect(result.notified).toBe(true)
    const notif = notifications.save.mock.calls[0][0].toObject()
    expect(notif.user_id).toBe('agent-2')
    expect(notif.kind).toBe('lead_assigned')
    expect(notif.title).toContain('Marcela Genta')
    expect(notif.title).toContain('Juan Pérez')
    expect(notif.body).toBe('Llamalo hoy')
    expect(notif.link_url).toBe('https://app.vendepro.com.ar/leads/lead-1')
  })

  it('deja constancia en la actividad del lead', async () => {
    const { uc, activities } = build()
    await uc.execute(input)

    const act = activities.save.mock.calls[0][0].toObject()
    expect(act.agent_id).toBe('admin-1')
    expect(act.lead_id).toBe('lead-1')
    expect(act.contact_id).toBe('contact-1')
    expect(act.description).toContain('Lucía Ruiz')
    expect(act.description).toContain('Llamalo hoy')
  })

  it('no hace nada si el lead ya era de ese agente', async () => {
    const { uc, leads, notifications, activities } = build({ lead: makeLead('agent-2') })
    const result = await uc.execute(input)

    expect(result.unchanged).toBe(true)
    expect(result.notified).toBe(false)
    expect(leads.save).not.toHaveBeenCalled()
    expect(notifications.save).not.toHaveBeenCalled()
    expect(activities.save).not.toHaveBeenCalled()
  })

  it('un agente puede pasar un lead propio', async () => {
    const { uc } = build({
      users: {
        'agent-2': makeUser('agent-2'),
        'agent-1': makeUser('agent-1'),
      },
    })
    await expect(uc.execute({ ...input, actorId: 'agent-1', actorRole: 'agent' })).resolves.toMatchObject({ unchanged: false })
  })

  it('un agente NO puede repartir leads ajenos', async () => {
    const { uc, leads } = build()
    await expect(uc.execute({ ...input, actorId: 'agent-9', actorRole: 'agent' }))
      .rejects.toBeInstanceOf(ForbiddenError)
    expect(leads.save).not.toHaveBeenCalled()
  })

  it('falla si el lead no existe', async () => {
    const { uc } = build({ lead: null })
    await expect(uc.execute(input)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('falla si el agente destino no es de la org', async () => {
    const { uc } = build({ users: { 'admin-1': makeUser('admin-1') } })
    await expect(uc.execute(input)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('falla si el agente destino está dado de baja', async () => {
    const { uc, leads } = build({
      users: { 'agent-2': makeUser('agent-2', { active: 0 }), 'admin-1': makeUser('admin-1') },
    })
    await expect(uc.execute(input)).rejects.toBeInstanceOf(ValidationError)
    expect(leads.save).not.toHaveBeenCalled()
  })

  // El aviso es best-effort: delegar no puede fallar porque el mail no salga.
  it('delega igual si el email no está configurado', async () => {
    const { uc, leads } = build()
    const result = await uc.execute(input)
    expect(result.emailed).toBe(false)
    expect(result.emailSkipped).toBe('email_no_configurado')
    expect(leads.save).toHaveBeenCalledOnce()
  })

  it('manda el mail cuando hay remitente configurado', async () => {
    const send = vi.fn()
    const { uc } = build({
      email: {
        service: { send } as any,
        settings: { findByOrg: vi.fn(async () => ({ from_email: 'hola@mg.com', from_name: 'MG', reply_to: null })) } as any,
      },
    })
    const result = await uc.execute(input)

    expect(result.emailed).toBe(true)
    const sent = send.mock.calls[0][0]
    expect(sent.to.email).toBe('lucia@test.com')
    expect(sent.subject).toContain('Juan Pérez')
    expect(sent.html).toContain('Llamalo hoy')
    expect(sent.html).toContain('https://app.vendepro.com.ar/leads/lead-1')
  })

  it('si el provider falla, el lead igual queda delegado', async () => {
    const { uc, leads } = build({
      email: {
        service: { send: vi.fn(async () => { throw new Error('dominio sin verificar') }) } as any,
        settings: { findByOrg: vi.fn(async () => ({ from_email: 'hola@mg.com', from_name: 'MG', reply_to: null })) } as any,
      },
    })
    const result = await uc.execute(input)

    expect(result.emailed).toBe(false)
    expect(result.emailSkipped).toBe('dominio sin verificar')
    expect(result.notified).toBe(true)
    expect(leads.save).toHaveBeenCalledOnce()
  })
})
