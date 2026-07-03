import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateWebhookUseCase } from '../../../src/application/use-cases/webhooks/create-webhook'
import { ListWebhooksUseCase } from '../../../src/application/use-cases/webhooks/list-webhooks'
import { UpdateWebhookUseCase } from '../../../src/application/use-cases/webhooks/update-webhook'
import { DeleteWebhookUseCase } from '../../../src/application/use-cases/webhooks/delete-webhook'
import { Webhook } from '../../../src/domain/entities/webhook'
import { ValidationError } from '../../../src/domain/errors/validation-error'
import { NotFoundError } from '../../../src/domain/errors/not-found'

const mockRepo = {
  save: vi.fn().mockResolvedValue(undefined),
  findById: vi.fn(),
  findByOrg: vi.fn(),
  findActiveByEvent: vi.fn(),
  delete: vi.fn().mockResolvedValue(undefined),
  touchLastTriggered: vi.fn(),
}

let idSeq = 0
const mockIds = { generate: vi.fn(() => `id-${++idSeq}`) }

function makeWebhook(overrides: Partial<Parameters<typeof Webhook.create>[0]> = {}) {
  return Webhook.create({
    id: 'wh-1', org_id: 'org_mg', name: 'n8n prod', url: 'https://n8n.example.com/hook',
    secret: 'whsec_abc', events: ['lead.created'], is_active: true, last_triggered_at: null,
    ...overrides,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  idSeq = 0
  mockRepo.save.mockResolvedValue(undefined)
  mockRepo.delete.mockResolvedValue(undefined)
})

describe('CreateWebhookUseCase', () => {
  it('crea el webhook activo con secret whsec_ generado', async () => {
    const uc = new CreateWebhookUseCase(mockRepo, mockIds)
    const result = await uc.execute({
      orgId: 'org_mg', name: 'n8n', url: 'https://n8n.example.com/hook',
      events: ['lead.created', 'lead.stage_changed'],
    })
    expect(mockRepo.save).toHaveBeenCalledTimes(1)
    expect(result.secret.startsWith('whsec_')).toBe(true)
    expect(result.is_active).toBe(true)
    expect(result.events).toEqual(['lead.created', 'lead.stage_changed'])
  })

  it('rechaza URL inválida', async () => {
    const uc = new CreateWebhookUseCase(mockRepo, mockIds)
    await expect(uc.execute({ orgId: 'org_mg', url: 'ftp://nope', events: ['lead.created'] }))
      .rejects.toThrow(ValidationError)
  })

  it('rechaza eventos desconocidos', async () => {
    const uc = new CreateWebhookUseCase(mockRepo, mockIds)
    await expect(uc.execute({ orgId: 'org_mg', url: 'https://ok.com/h', events: ['lead.deleted'] }))
      .rejects.toThrow(ValidationError)
  })

  it('rechaza sin eventos', async () => {
    const uc = new CreateWebhookUseCase(mockRepo, mockIds)
    await expect(uc.execute({ orgId: 'org_mg', url: 'https://ok.com/h', events: [] }))
      .rejects.toThrow(ValidationError)
  })
})

describe('ListWebhooksUseCase', () => {
  it('devuelve los webhooks de la org como objetos planos', async () => {
    mockRepo.findByOrg.mockResolvedValue([makeWebhook()])
    const uc = new ListWebhooksUseCase(mockRepo)
    const result = await uc.execute('org_mg')
    expect(mockRepo.findByOrg).toHaveBeenCalledWith('org_mg')
    expect(result).toHaveLength(1)
    expect(result[0].url).toBe('https://n8n.example.com/hook')
  })
})

describe('UpdateWebhookUseCase', () => {
  it('actualiza is_active y persiste', async () => {
    mockRepo.findById.mockResolvedValue(makeWebhook())
    const uc = new UpdateWebhookUseCase(mockRepo)
    const result = await uc.execute({ id: 'wh-1', orgId: 'org_mg', is_active: false })
    expect(result.is_active).toBe(false)
    expect(mockRepo.save).toHaveBeenCalledTimes(1)
  })

  it('actualiza eventos válidos', async () => {
    mockRepo.findById.mockResolvedValue(makeWebhook())
    const uc = new UpdateWebhookUseCase(mockRepo)
    const result = await uc.execute({ id: 'wh-1', orgId: 'org_mg', events: ['appraisal.created'] })
    expect(result.events).toEqual(['appraisal.created'])
  })

  it('falla si el webhook no existe', async () => {
    mockRepo.findById.mockResolvedValue(null)
    const uc = new UpdateWebhookUseCase(mockRepo)
    await expect(uc.execute({ id: 'wh-x', orgId: 'org_mg', is_active: false }))
      .rejects.toThrow(NotFoundError)
  })
})

describe('DeleteWebhookUseCase', () => {
  it('elimina por id + orgId', async () => {
    const uc = new DeleteWebhookUseCase(mockRepo)
    const result = await uc.execute({ id: 'wh-1', orgId: 'org_mg' })
    expect(mockRepo.delete).toHaveBeenCalledWith('wh-1', 'org_mg')
    expect(result).toEqual({ success: true })
  })

  it('rechaza id vacío', async () => {
    const uc = new DeleteWebhookUseCase(mockRepo)
    await expect(uc.execute({ id: '', orgId: 'org_mg' })).rejects.toThrow(ValidationError)
  })
})
