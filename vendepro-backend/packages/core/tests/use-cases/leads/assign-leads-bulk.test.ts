import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AssignLeadUseCase } from '../../../src/application/use-cases/leads/assign-lead'
import { Lead } from '../../../src/domain/entities/lead'
import { User } from '../../../src/domain/entities/user'
import { ValidationError } from '../../../src/domain/errors/validation-error'

const makeLead = (id: string, assignedTo: string | null) => Lead.create({
  id, org_id: 'org_mg', full_name: `Lead ${id}`, phone: null,
  email: null, source: 'manual', source_detail: null, property_address: null,
  neighborhood: null, property_type: null, operation: 'venta',
  stage: 'nuevo', assigned_to: assignedTo, notes: null, estimated_value: null,
  budget: null, timing: null, personas_trabajo: null, mascotas: null,
  next_step: null, next_step_date: null, lost_reason: null, first_contact_at: null,
  contact_id: null,
})

const makeUser = (id: string, full_name: string, active = 1) =>
  User.create({ id, org_id: 'org_mg', email: `${id}@test.com`, password_hash: 'x', full_name, role: 'agent', active } as any)

function build(leads: Record<string, Lead | null>) {
  const users: Record<string, User> = {
    'agent-2': makeUser('agent-2', 'Lucía Ruiz'),
    'admin-1': makeUser('admin-1', 'Marcela Genta'),
  }
  const leadRepo = { findById: vi.fn(async (id: string) => leads[id] ?? null), save: vi.fn() }
  const notifications = { save: vi.fn() }
  const activities = { save: vi.fn() }
  const email = {
    service: { send: vi.fn() },
    settings: { findByOrg: vi.fn(async () => ({ from_email: 'hola@mg.com', from_name: 'MG', reply_to: null })) },
  }
  const uc = new AssignLeadUseCase(
    leadRepo as any,
    { findById: vi.fn(async (id: string) => users[id] ?? null) } as any,
    notifications as any,
    activities as any,
    { generate: vi.fn(() => 'gen-id') } as any,
    email as any,
    'https://app.vendepro.com.ar',
  )
  return { uc, leadRepo, notifications, activities, email }
}

const base = { orgId: 'org_mg', toAgentId: 'agent-2', actorId: 'admin-1', actorRole: 'admin' }

describe('AssignLeadUseCase.executeMany', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reparte varios leads de una', async () => {
    const { uc, leadRepo } = build({ l1: makeLead('l1', null), l2: makeLead('l2', 'agent-3'), l3: makeLead('l3', null) })
    const r = await uc.executeMany({ ...base, leadIds: ['l1', 'l2', 'l3'] })

    expect(r.assigned).toEqual(['l1', 'l2', 'l3'])
    expect(r.failed).toEqual([])
    expect(leadRepo.save).toHaveBeenCalledTimes(3)
    expect(leadRepo.save.mock.calls.every(c => c[0].assigned_to === 'agent-2')).toBe(true)
  })

  // Cinco campanazos seguidos se leen como ruido, no como trabajo que llegó.
  it('avisa una sola vez por tanda, no una por lead', async () => {
    const { uc, notifications, email } = build({ l1: makeLead('l1', null), l2: makeLead('l2', null), l3: makeLead('l3', null) })
    const r = await uc.executeMany({ ...base, leadIds: ['l1', 'l2', 'l3'], note: 'Son de Belgrano' })

    expect(notifications.save).toHaveBeenCalledOnce()
    expect(email.service.send).toHaveBeenCalledOnce()
    const notif = notifications.save.mock.calls[0][0].toObject()
    expect(notif.title).toBe('Marcela Genta te delegó 3 leads')
    expect(notif.body).toBe('Son de Belgrano')
    // Varios leads: el link va a la lista filtrada, no a una ficha.
    expect(notif.link_url).toBe('https://app.vendepro.com.ar/leads?agent=agent-2')
    expect(r.notified).toBe(true)
    expect(r.emailed).toBe(true)
  })

  it('con un solo lead el aviso es el mismo que delegando desde la ficha', async () => {
    const { uc, notifications } = build({ l1: makeLead('l1', null) })
    await uc.executeMany({ ...base, leadIds: ['l1'] })

    const notif = notifications.save.mock.calls[0][0].toObject()
    expect(notif.title).toBe('Marcela Genta te delegó un lead: Lead l1')
    expect(notif.link_url).toBe('https://app.vendepro.com.ar/leads/l1')
  })

  // La constancia sí va por lead: es donde después se la busca.
  it('deja una constancia en cada lead', async () => {
    const { uc, activities } = build({ l1: makeLead('l1', null), l2: makeLead('l2', null) })
    await uc.executeMany({ ...base, leadIds: ['l1', 'l2'] })

    expect(activities.save).toHaveBeenCalledTimes(2)
    const ids = activities.save.mock.calls.map(c => c[0].toObject().lead_id)
    expect(ids).toEqual(['l1', 'l2'])
    expect(activities.save.mock.calls[0][0].toObject().description).toContain('Lucía Ruiz')
  })

  // Que un lead sea de otro no es razón para no repartir los otros veinte.
  it('un lead ajeno no corta la tanda de un agente', async () => {
    const { uc, leadRepo } = build({ l1: makeLead('l1', 'agent-9'), l2: makeLead('l2', 'agent-1') })
    const r = await uc.executeMany({ ...base, actorId: 'agent-1', actorRole: 'agent', leadIds: ['l1', 'l2'] })

    expect(r.assigned).toEqual(['l2'])
    expect(r.failed).toEqual([{ leadId: 'l1', reason: 'sin_permiso' }])
    expect(leadRepo.save).toHaveBeenCalledOnce()
  })

  it('reporta los leads que no existen sin romper el resto', async () => {
    const { uc } = build({ l1: makeLead('l1', null), fantasma: null })
    const r = await uc.executeMany({ ...base, leadIds: ['l1', 'fantasma'] })

    expect(r.assigned).toEqual(['l1'])
    expect(r.failed).toEqual([{ leadId: 'fantasma', reason: 'no_encontrado' }])
  })

  it('los que ya eran de ese agente quedan como unchanged', async () => {
    const { uc, leadRepo } = build({ l1: makeLead('l1', 'agent-2'), l2: makeLead('l2', null) })
    const r = await uc.executeMany({ ...base, leadIds: ['l1', 'l2'] })

    expect(r.unchanged).toEqual(['l1'])
    expect(r.assigned).toEqual(['l2'])
    expect(leadRepo.save).toHaveBeenCalledOnce()
  })

  it('si no cambió ninguno, no avisa nada', async () => {
    const { uc, notifications, email } = build({ l1: makeLead('l1', 'agent-2') })
    const r = await uc.executeMany({ ...base, leadIds: ['l1'] })

    expect(r.assigned).toEqual([])
    expect(r.notified).toBe(false)
    expect(notifications.save).not.toHaveBeenCalled()
    expect(email.service.send).not.toHaveBeenCalled()
  })

  it('ignora ids repetidos', async () => {
    const { uc, leadRepo } = build({ l1: makeLead('l1', null) })
    const r = await uc.executeMany({ ...base, leadIds: ['l1', 'l1', 'l1'] })

    expect(r.assigned).toEqual(['l1'])
    expect(leadRepo.save).toHaveBeenCalledOnce()
  })

  it('rechaza una tanda vacía', async () => {
    const { uc } = build({})
    await expect(uc.executeMany({ ...base, leadIds: [] })).rejects.toBeInstanceOf(ValidationError)
  })

  it('rechaza tandas desmedidas', async () => {
    const { uc } = build({})
    const muchos = Array.from({ length: 101 }, (_, i) => `l${i}`)
    await expect(uc.executeMany({ ...base, leadIds: muchos })).rejects.toBeInstanceOf(ValidationError)
  })

  it('el mail en lote lista los leads y usa el asunto plural', async () => {
    const { uc, email } = build({ l1: makeLead('l1', null), l2: makeLead('l2', null) })
    await uc.executeMany({ ...base, leadIds: ['l1', 'l2'] })

    const sent = email.service.send.mock.calls[0][0]
    expect(sent.subject).toBe('Te delegaron 2 leads')
    expect(sent.html).toContain('Lead l1')
    expect(sent.html).toContain('Lead l2')
    expect(sent.to.email).toBe('agent-2@test.com')
  })

  it('un agente dado de baja corta la tanda entera, sin mover nada', async () => {
    const { uc, leadRepo } = build({ l1: makeLead('l1', null) })
    await expect(uc.executeMany({ ...base, toAgentId: 'fantasma', leadIds: ['l1'] })).rejects.toThrow()
    expect(leadRepo.save).not.toHaveBeenCalled()
  })
})
