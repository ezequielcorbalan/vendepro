import { describe, it, expect } from 'vitest'
import { Notification } from '../../src/domain/entities/notification'
import { ValidationError } from '../../src/domain/errors/validation-error'

const base = {
  id: 'notif-1',
  org_id: 'org_mg',
  user_id: 'user-1',
  kind: 'lead_assigned' as const,
  title: 'Nuevo lead asignado',
  body: 'Se te asignó el lead de Juan Pérez',
  link_url: '/leads/lead-1',
  read: false,
}

describe('Notification entity', () => {
  it('creates notification with kind lead_assigned', () => {
    const n = Notification.create(base)
    expect(n.kind).toBe('lead_assigned')
    expect(n.title).toBe('Nuevo lead asignado')
    expect(n.read).toBe(false)
    expect(n.created_at).toBeDefined()
  })

  it('creates notification with kind task_overdue', () => {
    const n = Notification.create({ ...base, kind: 'task_overdue' })
    expect(n.kind).toBe('task_overdue')
  })

  it('creates notification with kind reservation_update', () => {
    const n = Notification.create({ ...base, kind: 'reservation_update' })
    expect(n.kind).toBe('reservation_update')
  })

  it('creates notification with kind system', () => {
    const n = Notification.create({ ...base, kind: 'system' })
    expect(n.kind).toBe('system')
  })

  it('rejects empty title', () => {
    expect(() => Notification.create({ ...base, title: '' })).toThrow(ValidationError)
  })

  it('rejects whitespace-only title', () => {
    expect(() => Notification.create({ ...base, title: '   ' })).toThrow(ValidationError)
  })

  it('rejects unknown kind', () => {
    expect(() => Notification.create({ ...base, kind: 'not_a_kind' as any })).toThrow(ValidationError)
  })

  it('markRead() returns new instance with read=true, original unchanged', () => {
    const original = Notification.create(base)
    const updated = original.markRead()
    expect(updated).not.toBe(original)
    expect(updated.read).toBe(true)
    expect(original.read).toBe(false)
  })

  it('toObject round-trips', () => {
    const n = Notification.create(base)
    const obj = n.toObject()
    expect(obj.id).toBe(base.id)
    expect(obj.org_id).toBe(base.org_id)
    expect(obj.user_id).toBe(base.user_id)
    expect(obj.kind).toBe(base.kind)
    expect(obj.title).toBe(base.title)
    expect(obj.body).toBe(base.body)
    expect(obj.link_url).toBe(base.link_url)
    expect(obj.read).toBe(false)
    expect(obj.created_at).toBeDefined()
  })
})
