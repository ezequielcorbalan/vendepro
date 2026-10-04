import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  GetConversationThreadUseCase,
  AssignConversationUseCase,
  SetConversationLabelsUseCase,
  ToggleConversationStatusUseCase,
} from '../../../src/application/use-cases/inbox/manage-conversation'
import { Conversation } from '../../../src/domain/entities/conversation'
import { User } from '../../../src/domain/entities/user'
import { NotFoundError } from '../../../src/domain/errors/not-found'
import { ValidationError } from '../../../src/domain/errors/validation-error'

const conv = (overrides: Partial<Parameters<typeof Conversation.create>[0]> = {}) =>
  Conversation.create({
    id: 'conv-1', org_id: 'org_mg', channel: 'whatsapp', contact_id: 'c1', lead_id: null,
    external_id: '549115@c.us', assignee_id: null, last_activity_at: null, window_expires_at: null,
    ...overrides,
  })

const agente = (active = 1) => User.create({
  id: 'agent-2', org_id: 'org_mg', email: 'a@test.com', password_hash: 'x',
  full_name: 'Lucía', role: 'agent', active,
} as any)

const repos = (c: Conversation | null, u: User | null = agente()) => ({
  conversations: { findById: vi.fn(async () => c), save: vi.fn() },
  messages: { findByConversation: vi.fn(async () => []) },
  users: { findById: vi.fn(async () => u) },
})

describe('GetConversationThreadUseCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('devuelve la conversación', async () => {
    const r = repos(conv())
    const uc = new GetConversationThreadUseCase(r.conversations as any, r.messages as any)
    expect((await uc.getConversation('conv-1', 'org_mg')).id).toBe('conv-1')
  })

  it('falla si no existe', async () => {
    const r = repos(null)
    const uc = new GetConversationThreadUseCase(r.conversations as any, r.messages as any)
    await expect(uc.getConversation('conv-1', 'org_mg')).rejects.toBeInstanceOf(NotFoundError)
  })

  // Pedir el hilo de una conversación de otra org no puede devolver mensajes.
  it('no devuelve mensajes de una conversación que no existe en la org', async () => {
    const r = repos(null)
    const uc = new GetConversationThreadUseCase(r.conversations as any, r.messages as any)
    await expect(uc.getMessages('conv-1', 'otra_org')).rejects.toBeInstanceOf(NotFoundError)
    expect(r.messages.findByConversation).not.toHaveBeenCalled()
  })
})

describe('AssignConversationUseCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('asigna el agente', async () => {
    const r = repos(conv())
    const resultado = await new AssignConversationUseCase(r.conversations as any, r.users as any)
      .execute('conv-1', 'org_mg', 'agent-2')
    expect(resultado.assignee_id).toBe('agent-2')
    expect(r.conversations.save).toHaveBeenCalledOnce()
  })

  it('con null la devuelve a la cola sin dueño', async () => {
    const r = repos(conv({ assignee_id: 'agent-2' }))
    const resultado = await new AssignConversationUseCase(r.conversations as any, r.users as any)
      .execute('conv-1', 'org_mg', null)
    expect(resultado.assignee_id).toBeNull()
    // No hace falta validar un agente que no se está asignando.
    expect(r.users.findById).not.toHaveBeenCalled()
  })

  it('rechaza un agente de otra organización', async () => {
    const r = repos(conv(), null)
    await expect(new AssignConversationUseCase(r.conversations as any, r.users as any)
      .execute('conv-1', 'org_mg', 'agent-9')).rejects.toBeInstanceOf(NotFoundError)
    expect(r.conversations.save).not.toHaveBeenCalled()
  })

  it('rechaza un agente dado de baja', async () => {
    const r = repos(conv(), agente(0))
    await expect(new AssignConversationUseCase(r.conversations as any, r.users as any)
      .execute('conv-1', 'org_mg', 'agent-2')).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('SetConversationLabelsUseCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reemplaza la lista completa', async () => {
    const r = repos(conv({ labels: ['escalado'] }))
    const resultado = await new SetConversationLabelsUseCase(r.conversations as any)
      .execute('conv-1', 'org_mg', ['bot_pausado'])
    expect(resultado.labels).toEqual(['bot_pausado'])
    expect(resultado.botPausado).toBe(true)
  })

  // Así es como el bot vuelve a hablar: manda la lista sin la etiqueta.
  it('una lista vacía despausa el bot', async () => {
    const r = repos(conv({ labels: ['bot_pausado'] }))
    const resultado = await new SetConversationLabelsUseCase(r.conversations as any)
      .execute('conv-1', 'org_mg', [])
    expect(resultado.labels).toEqual([])
    expect(resultado.botPausado).toBe(false)
  })

  it('no guarda etiquetas repetidas ni vacías', async () => {
    const r = repos(conv())
    const resultado = await new SetConversationLabelsUseCase(r.conversations as any)
      .execute('conv-1', 'org_mg', ['escalado', 'escalado', '  ', 'urgente'])
    expect(resultado.labels).toEqual(['escalado', 'urgente'])
  })
})

describe('ToggleConversationStatusUseCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('alterna abierta → resuelta', async () => {
    const r = repos(conv({ status: 'open' }))
    expect((await new ToggleConversationStatusUseCase(r.conversations as any).execute('conv-1', 'org_mg')).status)
      .toBe('resolved')
  })

  it('alterna resuelta → abierta', async () => {
    const r = repos(conv({ status: 'resolved' }))
    expect((await new ToggleConversationStatusUseCase(r.conversations as any).execute('conv-1', 'org_mg')).status)
      .toBe('open')
  })

  it('con un estado explícito lo fija', async () => {
    const r = repos(conv({ status: 'open' }))
    expect((await new ToggleConversationStatusUseCase(r.conversations as any).execute('conv-1', 'org_mg', 'pending')).status)
      .toBe('pending')
  })

  it('rechaza un estado que no existe', async () => {
    const r = repos(conv())
    await expect(new ToggleConversationStatusUseCase(r.conversations as any)
      .execute('conv-1', 'org_mg', 'archivada' as any)).rejects.toBeInstanceOf(ValidationError)
  })
})
