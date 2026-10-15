import { describe, it, expect, vi } from 'vitest'
import { NotifyInboxUseCase } from '../../../src/application/use-cases/inbox/notify-inbox'
import { User } from '../../../src/domain/entities/user'

const usuario = (id: string, role: string, extra: any = {}) => User.create({
  id, org_id: 'org_mg', email: `${id}@test.com`, password_hash: 'x',
  full_name: id, role, active: 1, ...extra,
} as any)

function build(users: User[] = [
  usuario('admin-1', 'admin'),
  usuario('owner-1', 'owner'),
  usuario('agent-1', 'agent'),
  usuario('admin-baja', 'admin', { active: 0 }),
]) {
  const notifications = { save: vi.fn(), findByUserId: vi.fn(), markRead: vi.fn() }
  const repo = { findByOrg: vi.fn(async () => users) }
  let n = 0
  const uc = new NotifyInboxUseCase(notifications as any, repo as any, { generate: () => `n-${++n}` } as any)
  return { uc, notifications }
}

const destinatarios = (save: any) => save.mock.calls.map((c: any) => c[0].toObject().user_id)

describe('NotifyInboxUseCase.nuevoMensaje', () => {
  it('le avisa sólo al agente asignado', async () => {
    const { uc, notifications } = build()
    await uc.nuevoMensaje({ orgId: 'org_mg', conversationId: 'c1', assigneeId: 'agent-1', quien: 'Juan', texto: 'Hola' })
    expect(destinatarios(notifications.save)).toEqual(['agent-1'])
    const n = notifications.save.mock.calls[0][0].toObject()
    expect(n.title).toBe('Juan te escribió')
    expect(n.body).toBe('Hola')
    expect(n.link_url).toBe('/conversaciones?c=c1')
    expect(n.kind).toBe('system')
  })

  // En la cola nadie la está mirando: avisarle a quien reparte.
  it('sin asignar, les avisa a los admins activos', async () => {
    const { uc, notifications } = build()
    await uc.nuevoMensaje({ orgId: 'org_mg', conversationId: 'c1', assigneeId: null, quien: 'Juan', texto: 'Hola' })
    expect(destinatarios(notifications.save)).toEqual(['admin-1', 'owner-1'])
  })

  it('recorta un texto largo', async () => {
    const { uc, notifications } = build()
    await uc.nuevoMensaje({ orgId: 'org_mg', conversationId: 'c1', assigneeId: 'agent-1', quien: 'Juan', texto: 'a'.repeat(300) })
    expect(notifications.save.mock.calls[0][0].toObject().body).toHaveLength(121)
  })

  it('sin texto, dice qué mandó', async () => {
    const { uc, notifications } = build()
    await uc.nuevoMensaje({ orgId: 'org_mg', conversationId: 'c1', assigneeId: 'agent-1', quien: 'Juan', texto: null, tipoAdjunto: 'audio' })
    expect(notifications.save.mock.calls[0][0].toObject().body).toBe('Mandó un audio')
  })

  it('un aviso que falla no frena a los demás', async () => {
    const { uc, notifications } = build()
    notifications.save.mockRejectedValueOnce(new Error('D1 caído'))
    const enviados = await uc.nuevoMensaje({ orgId: 'org_mg', conversationId: 'c1', assigneeId: null, quien: 'Juan', texto: 'Hola' })
    expect(enviados).toBe(1)
  })
})

describe('NotifyInboxUseCase.sesionCaida', () => {
  it('avisa a los admins con el link para reconectar', async () => {
    const { uc, notifications } = build()
    await uc.sesionCaida({ orgId: 'org_mg', estado: 'FAILED' })
    expect(destinatarios(notifications.save)).toEqual(['admin-1', 'owner-1'])
    expect(notifications.save.mock.calls[0][0].toObject().link_url).toBe('/configuracion/conexiones/whatsapp')
  })

  // Reconectar pasa por STARTING y SCAN_QR_CODE: avisar ahí sería alarma falsa.
  it.each(['STARTING', 'SCAN_QR_CODE', 'WORKING'])('no avisa en %s', async (estado) => {
    const { uc, notifications } = build()
    expect(await uc.sesionCaida({ orgId: 'org_mg', estado })).toBe(0)
    expect(notifications.save).not.toHaveBeenCalled()
  })
})
