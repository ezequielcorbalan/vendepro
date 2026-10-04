import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
import { Conversation, Message } from '@vendepro/core'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1ConversationRepository } from '../../src/repositories/d1-conversation-repository'
import { D1MessageRepository } from '../../src/repositories/d1-message-repository'

describe('Inbox — conversaciones y mensajes en D1', () => {
  let env: TestEnv
  let orgId: string
  let agentId: string

  beforeAll(async () => { env = await createTestDB() })
  afterAll(async () => { await closeTestDB(env) })

  beforeEach(async () => {
    const org = await seedOrg(env.DB)
    orgId = org.id
    agentId = (await seedUser(env.DB, orgId)).id
  })

  const nuevaConversacion = (overrides: Partial<Parameters<typeof Conversation.create>[0]> = {}) =>
    Conversation.create({
      id: nextId('conv'),
      org_id: orgId,
      channel: 'whatsapp',
      contact_id: null,
      lead_id: null,
      external_id: '5491155551234@c.us',
      assignee_id: null,
      last_activity_at: new Date().toISOString(),
      window_expires_at: null,
      ...overrides,
    })

  it('guarda y recupera una conversación', async () => {
    const repo = new D1ConversationRepository(env.DB)
    const conv = nuevaConversacion({ assignee_id: agentId })
    await repo.save(conv)

    const leida = await repo.findById(conv.id, orgId)
    expect(leida?.external_id).toBe('5491155551234@c.us')
    expect(leida?.assignee_id).toBe(agentId)
    expect(leida?.status).toBe('open')
  })

  it('la encuentra por el chat del proveedor', async () => {
    const repo = new D1ConversationRepository(env.DB)
    await repo.save(nuevaConversacion())

    const encontrada = await repo.findByExternalId(orgId, 'whatsapp', '5491155551234@c.us')
    expect(encontrada).not.toBeNull()
    // Otro canal con el mismo id es otra conversación.
    expect(await repo.findByExternalId(orgId, 'instagram', '5491155551234@c.us')).toBeNull()
    expect(await repo.findByExternalId(orgId, 'whatsapp', 'otro@c.us')).toBeNull()
  })

  it('actualiza en vez de duplicar al volver a guardar', async () => {
    const repo = new D1ConversationRepository(env.DB)
    const conv = nuevaConversacion()
    await repo.save(conv)

    conv.assignTo(agentId)
    conv.setStatus('resolved')
    conv.setLabels(['bot_pausado', 'bot_pausado', 'escalado'])
    await repo.save(conv)

    const leida = await repo.findById(conv.id, orgId)
    expect(leida?.assignee_id).toBe(agentId)
    expect(leida?.status).toBe('resolved')
    // Las etiquetas van y vuelven como JSON, sin repetidos.
    expect(leida?.labels).toEqual(['bot_pausado', 'escalado'])
    expect(leida?.botPausado).toBe(true)
  })

  it('la bandeja filtra por estado y por sin asignar', async () => {
    const repo = new D1ConversationRepository(env.DB)
    await repo.save(nuevaConversacion({ external_id: 'a@c.us', assignee_id: agentId }))
    const resuelta = nuevaConversacion({ external_id: 'b@c.us' })
    resuelta.setStatus('resolved')
    await repo.save(resuelta)
    await repo.save(nuevaConversacion({ external_id: 'c@c.us' }))

    expect((await repo.findByOrg(orgId, { status: 'open' })).length).toBe(2)
    expect((await repo.findByOrg(orgId, { unassigned: true })).length).toBe(2)
    expect((await repo.findByOrg(orgId, { assignee_id: agentId })).length).toBe(1)
  })

  it('ordena la bandeja por actividad reciente', async () => {
    const repo = new D1ConversationRepository(env.DB)
    const vieja = new Date(Date.now() - 86400000).toISOString()
    await repo.save(nuevaConversacion({ external_id: 'vieja@c.us', last_activity_at: vieja }))
    await repo.save(nuevaConversacion({ external_id: 'nueva@c.us', last_activity_at: new Date().toISOString() }))

    const bandeja = await repo.findByOrg(orgId)
    expect(bandeja[0]?.external_id).toBe('nueva@c.us')
  })

  it('no mezcla organizaciones', async () => {
    const repo = new D1ConversationRepository(env.DB)
    await repo.save(nuevaConversacion())
    const otra = await seedOrg(env.DB)
    expect(await repo.findByOrg(otra.id)).toEqual([])
  })

  it('guarda mensajes y los devuelve en orden, con el nombre del agente', async () => {
    const convRepo = new D1ConversationRepository(env.DB)
    const msgRepo = new D1MessageRepository(env.DB)
    const conv = nuevaConversacion()
    await convRepo.save(conv)

    await msgRepo.save(Message.create({
      id: nextId('msg'), org_id: orgId, conversation_id: conv.id, direction: 'in',
      sender_type: 'contact', sender_id: null, content: 'Hola', external_id: 'wamid.1',
      created_at: '2026-10-03T10:00:00.000Z',
    }))
    await msgRepo.save(Message.create({
      id: nextId('msg'), org_id: orgId, conversation_id: conv.id, direction: 'out',
      sender_type: 'agent', sender_id: agentId, content: 'Buen día', external_id: null,
      created_at: '2026-10-03T10:05:00.000Z',
    }))

    const hilo = await msgRepo.findByConversation(conv.id, orgId)
    expect(hilo.map(m => m.content)).toEqual(['Hola', 'Buen día'])
    expect(hilo[0]?.messageType).toBe(0)
    expect(hilo[1]?.messageType).toBe(1)
    expect(hilo[1]?.toObject().sender_name).toBe('Test User')
  })

  it('encuentra un mensaje por el id del proveedor — la clave de la idempotencia', async () => {
    const convRepo = new D1ConversationRepository(env.DB)
    const msgRepo = new D1MessageRepository(env.DB)
    const conv = nuevaConversacion()
    await convRepo.save(conv)
    await msgRepo.save(Message.create({
      id: nextId('msg'), org_id: orgId, conversation_id: conv.id, direction: 'in',
      sender_type: 'contact', sender_id: null, content: 'Hola', external_id: 'wamid.ABC',
    }))

    expect(await msgRepo.findByExternalId(orgId, 'wamid.ABC')).not.toBeNull()
    expect(await msgRepo.findByExternalId(orgId, 'wamid.OTRO')).toBeNull()
  })

  it('guarda los adjuntos de un audio sin texto', async () => {
    const convRepo = new D1ConversationRepository(env.DB)
    const msgRepo = new D1MessageRepository(env.DB)
    const conv = nuevaConversacion()
    await convRepo.save(conv)
    await msgRepo.save(Message.create({
      id: nextId('msg'), org_id: orgId, conversation_id: conv.id, direction: 'in',
      sender_type: 'contact', sender_id: null, content: null, external_id: 'wamid.AUDIO',
      attachments: [{ type: 'audio', url: 'https://x/a.ogg', mime: 'audio/ogg' }],
    }))

    const [msg] = await msgRepo.findByConversation(conv.id, orgId)
    expect(msg?.attachments[0]?.type).toBe('audio')
    expect(msg?.content).toBeNull()
  })

  it('la conversación trae el último mensaje para la lista', async () => {
    const convRepo = new D1ConversationRepository(env.DB)
    const msgRepo = new D1MessageRepository(env.DB)
    const conv = nuevaConversacion()
    await convRepo.save(conv)
    await msgRepo.save(Message.create({
      id: nextId('msg'), org_id: orgId, conversation_id: conv.id, direction: 'in',
      sender_type: 'contact', sender_id: null, content: 'Primero', external_id: 'w1',
      created_at: '2026-10-03T10:00:00.000Z',
    }))
    await msgRepo.save(Message.create({
      id: nextId('msg'), org_id: orgId, conversation_id: conv.id, direction: 'in',
      sender_type: 'contact', sender_id: null, content: 'Último', external_id: 'w2',
      created_at: '2026-10-03T11:00:00.000Z',
    }))

    const [fila] = await convRepo.findByOrg(orgId)
    expect(fila?.toObject().last_message).toBe('Último')
  })
})
