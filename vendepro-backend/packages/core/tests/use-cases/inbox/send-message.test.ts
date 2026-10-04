import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SendMessageUseCase } from '../../../src/application/use-cases/inbox/send-message'
import { Conversation } from '../../../src/domain/entities/conversation'
import { NotFoundError } from '../../../src/domain/errors/not-found'
import { ValidationError } from '../../../src/domain/errors/validation-error'

const conversacion = (overrides: Partial<Parameters<typeof Conversation.create>[0]> = {}) =>
  Conversation.create({
    id: 'conv-1', org_id: 'org_mg', channel: 'whatsapp', contact_id: 'contact-1',
    lead_id: null, external_id: '5491155551234@c.us', assignee_id: 'agent-2',
    last_activity_at: new Date().toISOString(),
    // Ventana abierta por defecto.
    window_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    ...overrides,
  })

function build(opts: { conv?: Conversation | null; enforcesWindow?: boolean; sendFails?: boolean } = {}) {
  const conversations = {
    findById: vi.fn(async () => (opts.conv === undefined ? conversacion() : opts.conv)),
    save: vi.fn(),
  }
  const messages = { save: vi.fn() }
  const gateway = {
    enforcesWindow: opts.enforcesWindow ?? false,
    sendText: vi.fn(async () => {
      if (opts.sendFails) throw new Error('WAHA respondió 500')
      return { externalId: 'wamid.OUT1' }
    }),
  }
  const uc = new SendMessageUseCase(conversations as any, messages as any, gateway as any, { generate: () => 'msg-new' } as any)
  return { uc, conversations, messages, gateway }
}

const entrada = { conversationId: 'conv-1', orgId: 'org_mg', text: 'Hola, te paso el link', senderType: 'agent' as const, senderId: 'agent-2' }

describe('SendMessageUseCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('manda por el canal de la conversación y lo registra', async () => {
    const { uc, messages, gateway } = build()
    const r = await uc.execute(entrada)

    expect(gateway.sendText).toHaveBeenCalledWith({
      channel: 'whatsapp', chatId: '5491155551234@c.us', text: 'Hola, te paso el link',
    })
    const msg = messages.save.mock.calls[0][0].toObject()
    expect(msg.direction).toBe('out')
    expect(msg.sender_type).toBe('agent')
    expect(msg.sender_id).toBe('agent-2')
    expect(msg.external_id).toBe('wamid.OUT1')
    expect(r.externalId).toBe('wamid.OUT1')
    // El bot lee este número para saber que el mensaje es nuestro.
    expect(messages.save.mock.calls[0][0].messageType).toBe(1)
  })

  // Un mensaje en pantalla que el cliente nunca recibió es la peor falla
  // posible en una herramienta de atención.
  it('si el proveedor falla, no deja el mensaje escrito en el hilo', async () => {
    const { uc, messages, conversations } = build({ sendFails: true })
    await expect(uc.execute(entrada)).rejects.toThrow('WAHA respondió 500')
    expect(messages.save).not.toHaveBeenCalled()
    expect(conversations.save).not.toHaveBeenCalled()
  })

  it('mueve la actividad pero no extiende la ventana', async () => {
    const vence = new Date(Date.now() + 3600_000).toISOString()
    const { uc, conversations } = build({ conv: conversacion({ window_expires_at: vence }) })
    await uc.execute(entrada)

    const conv = conversations.save.mock.calls[0][0].toObject()
    expect(conv.window_expires_at).toBe(vence)
    expect(new Date(conv.last_activity_at).getTime()).toBeGreaterThan(Date.now() - 5000)
  })

  // Con la Cloud API, mandar texto libre fuera de ventana es un mensaje
  // perdido del lado de Meta, sin aviso para el agente.
  it('con un proveedor que impone la ventana, se niega a mandar texto libre vencida', async () => {
    const vencida = new Date(Date.now() - 3600_000).toISOString()
    const { uc, gateway } = build({ enforcesWindow: true, conv: conversacion({ window_expires_at: vencida }) })

    await expect(uc.execute(entrada)).rejects.toBeInstanceOf(ValidationError)
    expect(gateway.sendText).not.toHaveBeenCalled()
  })

  // Hoy el proveedor es WhatsApp Web, que no conoce la ventana.
  it('con un proveedor que no la impone, manda igual', async () => {
    const vencida = new Date(Date.now() - 3600_000).toISOString()
    const { uc, gateway } = build({ enforcesWindow: false, conv: conversacion({ window_expires_at: vencida }) })

    await expect(uc.execute(entrada)).resolves.toMatchObject({ messageId: 'msg-new' })
    expect(gateway.sendText).toHaveBeenCalledOnce()
  })

  it('el bot también manda por acá', async () => {
    const { uc, messages } = build()
    await uc.execute({ ...entrada, senderType: 'bot', senderId: null })
    expect(messages.save.mock.calls[0][0].toObject().sender_type).toBe('bot')
  })

  it('rechaza un mensaje vacío sin llamar al proveedor', async () => {
    const { uc, gateway } = build()
    await expect(uc.execute({ ...entrada, text: '   ' })).rejects.toBeInstanceOf(ValidationError)
    expect(gateway.sendText).not.toHaveBeenCalled()
  })

  it('falla si la conversación no existe', async () => {
    const { uc } = build({ conv: null })
    await expect(uc.execute(entrada)).rejects.toBeInstanceOf(NotFoundError)
  })
})
