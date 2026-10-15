import { describe, it, expect, vi, beforeAll } from 'vitest'
import { InboxHub } from '../../src/realtime/inbox-hub'

beforeAll(() => {
  // Globales del runtime de Workers que Node no tiene.
  ;(globalThis as any).WebSocketRequestResponsePair = class { constructor(public req: string, public res: string) {} }
})

function socket(userId: string, veTodo: boolean) {
  return { deserializeAttachment: () => ({ userId, veTodo }), send: vi.fn() }
}

function hub(sockets: any[]) {
  const state = {
    setWebSocketAutoResponse: vi.fn(),
    getWebSockets: () => sockets,
    acceptWebSocket: vi.fn(),
  }
  return new InboxHub(state as any, {})
}

describe('InboxHub', () => {
  it('reparte una conversación según permisos', async () => {
    const admin = socket('admin-1', true)
    const duenio = socket('agent-1', false)
    const otro = socket('agent-2', false)
    const h = hub([admin, duenio, otro])

    const res = await h.fetch(new Request('https://hub/publicar', {
      method: 'POST',
      body: JSON.stringify({ tipo: 'conversacion', conversationId: 'c1', assigneeId: 'agent-1' }),
    }))

    expect(await res.json()).toEqual({ entregados: 2 })
    expect(admin.send).toHaveBeenCalledWith(expect.stringContaining('"conversationId":"c1"'))
    expect(duenio.send).toHaveBeenCalled()
    expect(otro.send).not.toHaveBeenCalled()
  })

  it('un aviso de campana va sólo a sus destinatarios', () => {
    const a = socket('agent-1', false)
    const b = socket('admin-1', true)
    expect(hub([a, b]).repartir({ tipo: 'aviso', userIds: ['agent-1'] })).toBe(1)
    expect(b.send).not.toHaveBeenCalled()
  })

  it('una conexión rota no frena al resto', () => {
    const rota = { deserializeAttachment: () => ({ userId: 'a', veTodo: true }), send: vi.fn(() => { throw new Error('cerrado') }) }
    const sana = socket('b', true)
    expect(hub([rota, sana]).repartir({ tipo: 'conversacion', conversationId: 'c', assigneeId: null })).toBe(1)
  })

  it('rechaza un evento inválido y un /conectar sin WebSocket', async () => {
    const h = hub([])
    expect((await h.fetch(new Request('https://hub/publicar', { method: 'POST', body: '{"tipo":"otra"}' }))).status).toBe(400)
    expect((await h.fetch(new Request('https://hub/conectar'))).status).toBe(426)
  })
})
