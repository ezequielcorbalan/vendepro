import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IngestInboundMessageUseCase } from '../../../src/application/use-cases/inbox/ingest-inbound-message'
import { Conversation } from '../../../src/domain/entities/conversation'
import { Message } from '../../../src/domain/entities/message'
import { Contact } from '../../../src/domain/entities/contact'
import { User } from '../../../src/domain/entities/user'

const admin = User.create({
  id: 'admin-1', org_id: 'org_mg', email: 'admin@test.com', password_hash: 'x',
  full_name: 'Marcela Genta', role: 'admin', active: 1,
} as any)

const contactoExistente = Contact.create({
  id: 'contact-1', org_id: 'org_mg', full_name: 'Juan Pérez', phone: '1155551234',
  email: null, contact_type: 'comprador', neighborhood: null, notes: null,
  source: 'manual', agent_id: 'admin-1',
})

function build(opts: {
  conversation?: Conversation | null
  existingMessage?: Message | null
  contact?: Contact | null
  firstAdmin?: User | null
} = {}) {
  let idSeq = 0
  const conversations = {
    findByExternalId: vi.fn(async () => opts.conversation ?? null),
    findById: vi.fn(),
    findByOrg: vi.fn(),
    save: vi.fn(),
  }
  const messages = {
    findByExternalId: vi.fn(async () => opts.existingMessage ?? null),
    findByConversation: vi.fn(),
    save: vi.fn(),
  }
  const contacts = {
    findByEmailOrPhone: vi.fn(async () => opts.contact ?? null),
    save: vi.fn(),
  }
  const users = {
    findFirstAdminByOrg: vi.fn(async () => (opts.firstAdmin === undefined ? admin : opts.firstAdmin)),
  }
  const uc = new IngestInboundMessageUseCase(
    conversations as any, messages as any, contacts as any, users as any,
    { generate: vi.fn(() => `gen-${++idSeq}`) } as any,
  )
  return { uc, conversations, messages, contacts, users }
}

const entrada = {
  orgId: 'org_mg',
  channel: 'whatsapp' as const,
  externalChatId: '5491155551234@c.us',
  externalMessageId: 'wamid.ABC',
  fromPhone: '5491155551234',
  fromName: 'Juan',
  content: 'Hola, vi el depto de Cabildo',
}

describe('IngestInboundMessageUseCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('abre la conversación y guarda el mensaje', async () => {
    const { uc, conversations, messages } = build()
    const r = await uc.execute(entrada)

    expect(r.conversationCreated).toBe(true)
    expect(r.duplicate).toBe(false)
    const conv = conversations.save.mock.calls[0][0].toObject()
    expect(conv.external_id).toBe('5491155551234@c.us')
    expect(conv.status).toBe('open')
    const msg = messages.save.mock.calls[0][0].toObject()
    expect(msg.direction).toBe('in')
    expect(msg.sender_type).toBe('contact')
    expect(msg.content).toBe('Hola, vi el depto de Cabildo')
  })

  // El proveedor reenvía el webhook si no recibe un 200 a tiempo. Sin esto el
  // agente ve el mensaje dos veces y el bot responde dos veces.
  it('no guarda dos veces el mismo mensaje del proveedor', async () => {
    const yaGuardado = Message.create({
      id: 'msg-1', org_id: 'org_mg', conversation_id: 'conv-1', direction: 'in',
      sender_type: 'contact', sender_id: null, content: 'Hola', external_id: 'wamid.ABC',
    })
    const { uc, conversations, messages } = build({ existingMessage: yaGuardado })
    const r = await uc.execute(entrada)

    expect(r.duplicate).toBe(true)
    expect(r.conversationId).toBe('conv-1')
    expect(messages.save).not.toHaveBeenCalled()
    expect(conversations.save).not.toHaveBeenCalled()
  })

  it('reusa la conversación que ya existe para ese chat', async () => {
    const existente = Conversation.create({
      id: 'conv-9', org_id: 'org_mg', channel: 'whatsapp', contact_id: 'contact-1',
      lead_id: null, external_id: '5491155551234@c.us', assignee_id: 'agent-2',
      last_activity_at: null, window_expires_at: null,
    })
    const { uc, conversations } = build({ conversation: existente })
    const r = await uc.execute(entrada)

    expect(r.conversationCreated).toBe(false)
    expect(r.conversationId).toBe('conv-9')
    // No le toca el agente: la conversación ya tiene dueño.
    expect(conversations.save.mock.calls[0][0].toObject().assignee_id).toBe('agent-2')
  })

  it('ata la conversación al contacto que ya está en el CRM', async () => {
    const { uc, conversations, contacts } = build({ contact: contactoExistente })
    const r = await uc.execute(entrada)

    expect(r.contactId).toBe('contact-1')
    expect(contacts.save).not.toHaveBeenCalled()
    expect(conversations.save.mock.calls[0][0].toObject().contact_id).toBe('contact-1')
  })

  // El teléfono llega como jid de WhatsApp y en el CRM está escrito a mano.
  it('busca el contacto por el teléfono normalizado', async () => {
    const { uc, contacts } = build({ contact: contactoExistente })
    await uc.execute(entrada)
    expect(contacts.findByEmailOrPhone).toHaveBeenCalledWith('org_mg', null, '1155551234')
  })

  it('crea el contacto si el número es desconocido, a nombre del admin', async () => {
    const { uc, contacts } = build({ contact: null })
    const r = await uc.execute(entrada)

    const creado = contacts.save.mock.calls[0][0].toObject()
    expect(creado.full_name).toBe('Juan')
    expect(creado.phone).toBe('1155551234')
    expect(creado.source).toBe('whatsapp')
    // Lo que entra es de la inmobiliaria hasta que alguien lo delega.
    expect(creado.agent_id).toBe('admin-1')
    expect(r.contactId).toBe(creado.id)
  })

  it('sin nombre de perfil usa el teléfono como nombre', async () => {
    const { uc, contacts } = build({ contact: null })
    await uc.execute({ ...entrada, fromName: null })
    expect(contacts.save.mock.calls[0][0].toObject().full_name).toBe('1155551234')
  })

  // Mejor una conversación sin atar que un contacto con dueño inventado.
  it('si la org no tiene admin, no inventa el contacto', async () => {
    const { uc, contacts, conversations } = build({ contact: null, firstAdmin: null })
    const r = await uc.execute(entrada)

    expect(contacts.save).not.toHaveBeenCalled()
    expect(r.contactId).toBeNull()
    expect(conversations.save.mock.calls[0][0].toObject().contact_id).toBeNull()
  })

  it('abre la ventana de 24h desde el mensaje del cliente', async () => {
    const { uc, conversations } = build()
    await uc.execute({ ...entrada, sentAt: '2026-10-03T10:00:00.000Z' })

    const conv = conversations.save.mock.calls[0][0].toObject()
    expect(conv.last_activity_at).toBe('2026-10-03T10:00:00.000Z')
    expect(conv.window_expires_at).toBe('2026-10-04T10:00:00.000Z')
  })

  // Si el cliente vuelve a escribir, alguien tiene que mirarla de nuevo.
  it('reabre una conversación que estaba resuelta', async () => {
    const resuelta = Conversation.create({
      id: 'conv-5', org_id: 'org_mg', channel: 'whatsapp', contact_id: 'contact-1',
      lead_id: null, external_id: '5491155551234@c.us', status: 'resolved',
      assignee_id: null, last_activity_at: null, window_expires_at: null,
    })
    const { uc, conversations } = build({ conversation: resuelta })
    await uc.execute(entrada)

    expect(conversations.save.mock.calls[0][0].toObject().status).toBe('open')
  })

  it('acepta un audio sin texto', async () => {
    const { uc, messages } = build()
    await uc.execute({ ...entrada, content: null, attachments: [{ type: 'audio', url: 'https://x/a.ogg' }] })

    const msg = messages.save.mock.calls[0][0].toObject()
    expect(msg.content).toBeNull()
    expect(msg.attachments).toHaveLength(1)
  })

  it('sin id de mensaje igual ingresa (no todos los proveedores lo mandan)', async () => {
    const { uc, messages } = build()
    const r = await uc.execute({ ...entrada, externalMessageId: null })
    expect(r.duplicate).toBe(false)
    expect(messages.findByExternalId).not.toHaveBeenCalled()
    expect(messages.save).toHaveBeenCalledOnce()
  })
})
