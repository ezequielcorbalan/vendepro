import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { AIService } from '../../ports/services/ai-service'
import type { Block } from '../../../domain/value-objects/block-schemas'
import { NotFoundError } from '../../../domain/errors/not-found'
import { UnauthorizedError } from '../../../domain/errors/unauthorized'
import { ValidationError } from '../../../domain/errors/validation-error'
import { canEditLanding, type Actor } from '../../../domain/rules/landing-rules'

export type EditScope = 'block' | 'global'

export interface EditBlockWithAIInput {
  actor: Actor
  orgId: string
  landingId: string
  prompt: string
  scope: EditScope
  blockId?: string
}

export type AIProposal =
  | { kind: 'block'; blockId: string; blockType: string; data: Record<string, unknown> }
  | { kind: 'global'; blocks: Block[] }

export type AIProposalResult =
  | { status: 'ok'; proposal: AIProposal }
  | { status: 'error'; reason: 'schema_mismatch' | 'provider_error' | 'timeout'; detail?: string }

const MAX_PROMPT_CHARS = 500

export class EditBlockWithAIUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly ai: AIService,
  ) {}

  async execute(input: EditBlockWithAIInput): Promise<AIProposalResult> {
    if (input.prompt.length > MAX_PROMPT_CHARS) {
      throw new ValidationError(`El prompt no puede superar los ${MAX_PROMPT_CHARS} caracteres.`)
    }

    const landing = await this.landings.findById(input.landingId, input.orgId)
    if (!landing) throw new NotFoundError('Landing', input.landingId)
    if (!canEditLanding(input.actor, { agent_id: landing.agent_id, status: landing.status })) {
      throw new UnauthorizedError('No tenés permisos para editar esta landing')
    }

    if (input.scope === 'block') {
      if (!input.blockId) throw new ValidationError('scope=block requiere blockId')
      const block = landing.blocks.find(b => b.id === input.blockId)
      if (!block) throw new NotFoundError('Block', input.blockId)

      const res = await this.ai.editLandingBlock({
        blockType: block.type,
        blockData: block.data as Record<string, unknown>,
        prompt: input.prompt,
        brandVoice: landing.brand_voice,
      })

      if (res.status === 'error') return res
      return { status: 'ok', proposal: { kind: 'block', blockId: block.id, blockType: block.type, data: res.data } }
    }

    const res = await this.ai.editLandingGlobal({
      blocks: landing.blocks,
      prompt: input.prompt,
      brandVoice: landing.brand_voice,
    })
    if (res.status === 'error') return res
    return { status: 'ok', proposal: { kind: 'global', blocks: res.blocks } }
  }
}
