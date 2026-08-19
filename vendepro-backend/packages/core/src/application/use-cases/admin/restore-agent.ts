import type { UserRepository } from '../../ports/repositories/user-repository'
import { ForbiddenError } from '../../../domain/errors/forbidden'
import { NotFoundError } from '../../../domain/errors/not-found'
import { ValidationError } from '../../../domain/errors/validation-error'
import { canManageAgents } from '../../../domain/rules/role-rules'

export interface RestoreAgentInput {
  requestingUserRole: string
  agentId: string
  orgId: string
}

/** Saca un agente de la papelera y lo vuelve a habilitar (active = 1). */
export class RestoreAgentUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(input: RestoreAgentInput): Promise<void> {
    if (!canManageAgents(input.requestingUserRole)) {
      throw new ForbiddenError('No tienes permiso para restaurar agentes')
    }
    if (!input.agentId) {
      throw new ValidationError('id es requerido', { id: 'Requerido' })
    }

    const agent = await this.userRepo.findById(input.agentId, input.orgId)
    if (!agent) throw new NotFoundError('Agente', input.agentId)

    if (agent.active === 1) {
      throw new ValidationError('El agente no está en la papelera')
    }

    await this.userRepo.restore(input.agentId, input.orgId)
  }
}
