import { describe, it, expect } from 'vitest'
import { buildMessageCreatedPayload, telefonoE164DesdeChat } from '../../../src/domain/rules/inbox-webhook-payload'

/**
 * Estos tests son el contrato con el bot de n8n. Si uno falla, NO se arregla
 * cambiando el test: se está por romper un nodo del bot en producción.
 */

const entrante = (overrides: any = {}) => buildMessageCreatedPayload({
  conversation: { id: 'conv-1', channel: 'whatsapp', externalId: '5491155551234@c.us', status: 'open', labels: [] },
  message: {
    id: 'msg-1', content: 'Hola, vi el depto', direction: 'in', senderType: 'contact',
    createdAt: '2026-10-15T10:00:00.000Z', attachments: [],
  },
  senderName: 'Juan Pérez',
  ...overrides,
})

describe('buildMessageCreatedPayload — la forma que documenta el brief', () => {
  it('va plano: event y los campos al mismo nivel', () => {
    const p = entrante()
    expect(p.event).toBe('message_created')
    expect(Object.keys(p)).toEqual(expect.arrayContaining([
      'event', 'conversation', 'sender', 'content', 'contact_inbox', 'message_type', 'attachments', 'private',
    ]))
  })

  // n8n ya mete el cuerpo del request bajo `body`. Un `body` nuestro adentro
  // obligaría al bot a leer $json.body.body.conversation.
  it('NO anida un body propio', () => {
    expect(entrante()).not.toHaveProperty('body')
  })

  it('message_type 0 para lo que manda el cliente', () => {
    expect(entrante().message_type).toBe(0)
  })

  it('message_type 1 para lo que manda un agente o el bot', () => {
    const agente = entrante({ message: { id: 'm', content: 'Hola', direction: 'out', senderType: 'agent', createdAt: '2026-10-15T10:00:00.000Z' } })
    const bot = entrante({ message: { id: 'm', content: 'Hola', direction: 'out', senderType: 'bot', createdAt: '2026-10-15T10:00:00.000Z' } })
    expect(agente.message_type).toBe(1)
    expect(bot.message_type).toBe(1)
  })
})

describe('los tres bugs que rompían el bot en silencio', () => {
  // Bug 1 del análisis: el nodo de audios lee `file_type`, no `type`.
  it('los adjuntos van como file_type, con los valores de Chatwoot', () => {
    const p = entrante({
      message: {
        id: 'm', content: null, direction: 'in', senderType: 'contact', createdAt: '2026-10-15T10:00:00.000Z',
        attachments: [
          { type: 'audio', url: 'https://x/a.ogg' },
          { type: 'ptt', url: 'https://x/b.ogg' },
          { type: 'image', url: 'https://x/c.jpg' },
          { type: 'document', url: 'https://x/d.pdf' },
        ],
      },
    })
    expect(p.attachments.map(a => a.file_type)).toEqual(['audio', 'audio', 'image', 'file'])
    expect(p.attachments[0]).toEqual({ file_type: 'audio', data_url: 'https://x/a.ogg' })
    expect(p.attachments[0]).not.toHaveProperty('type')
  })

  // Bug 2: el anti-doble-contacto y el ruteo comparan contra "+549…".
  it('el teléfono va en E.164, con el +', () => {
    expect(entrante().sender.phone_number).toBe('+5491155551234')
  })

  // Bug 4 (encontrado al anticipar): el brief espera "549…", no el jid.
  it('el source_id va en dígitos, sin el @c.us', () => {
    expect(entrante().contact_inbox.source_id).toBe('5491155551234')
  })

  it('en un saliente, el teléfono sigue siendo el del CLIENTE', () => {
    const p = entrante({ message: { id: 'm', content: 'Te paso el link', direction: 'out', senderType: 'agent', createdAt: '2026-10-15T10:00:00.000Z' } })
    expect(p.sender.phone_number).toBe('+5491155551234')
  })
})

describe('lo agregado (no rompe a nadie, ayuda al bot)', () => {
  // Sin esto, un mensaje de agente y uno del bot llegan iguales a n8n y el bot
  // no puede saber si tiene que pausarse.
  it('distingue al contacto, al agente y al bot', () => {
    const tipo = (senderType: any) => entrante({
      message: { id: 'm', content: 'x', direction: senderType === 'contact' ? 'in' : 'out', senderType, createdAt: '2026-10-15T10:00:00.000Z' },
    }).sender.type
    expect(tipo('contact')).toBe('contact')
    expect(tipo('agent')).toBe('user')
    expect(tipo('bot')).toBe('agent_bot')
  })

  it('trae estado y etiquetas de la conversación, para chequear la pausa sin otra llamada', () => {
    const p = entrante({ conversation: { id: 'c', channel: 'whatsapp', externalId: '549115@c.us', status: 'open', labels: ['bot_pausado'] } })
    expect(p.conversation.labels).toEqual(['bot_pausado'])
    expect(p.conversation.status).toBe('open')
  })

  it('trae el id del mensaje y la fecha', () => {
    expect(entrante().id).toBe('msg-1')
    expect(entrante().created_at).toBe('2026-10-15T10:00:00.000Z')
  })
})

describe('Instagram', () => {
  it('no inventa un teléfono y usa el IGSID como source_id', () => {
    const p = entrante({ conversation: { id: 'c', channel: 'instagram', externalId: '17841400000000', status: 'open' } })
    expect(p.sender.phone_number).toBeNull()
    expect(p.contact_inbox.source_id).toBe('17841400000000')
  })
})

describe('telefonoE164DesdeChat', () => {
  it('saca el + desde el jid de WhatsApp', () => {
    expect(telefonoE164DesdeChat('whatsapp', '5491155551234@c.us')).toBe('+5491155551234')
    expect(telefonoE164DesdeChat('whatsapp', '5491155551234')).toBe('+5491155551234')
  })
  it('en Meta no hay teléfono', () => {
    expect(telefonoE164DesdeChat('instagram', '1784')).toBeNull()
  })
})
