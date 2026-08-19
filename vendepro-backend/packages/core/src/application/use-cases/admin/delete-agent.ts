import type { UserRepository } from '../../ports/repositories/user-repository'
import { ForbiddenError } from '../../../domain/errors/forbidden'
import { NotFoundError } from '../../../domain/errors/not-found'
import { ValidationError } from '../../../domain/errors/validation-error'
import { canManageAgents } from '../../../domain/rules/role-rules'

export interface DeleteAgentInput {
  requestingUserId: string
  requestingUserRole: string
  agentId: string
  orgId: string
}

/**
 * Borrado lógico de un agente (va a la papelera, se puede restaurar).
 * Nunca borra físicamente: el usuario sigue referenciado por leads,
 * tasaciones, eventos e historial de etapas.
 */
export class DeleteAgentUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(input: DeleteAgentInput): Promise<void> {
    if (!canManageAgents(input.requestingUserRole)) {
      throw new ForbiddenError('No tienes permiso para eliminar agentes')
    }
    if (!input.agentId) {
      throw new ValidationError('id es requerido', { id: 'Requerido' })
    }
    if (input.agentId === input.requestingUserId) {
      throw new ValidationError('No podés eliminarte a vos mismo')
    }

    const agent = await this.userRepo.findById(input.agentId, input.orgId)
    if (!agent) throw new NotFoundError('Agente', input.agentId)

    if (agent.role === 'owner' && input.requestingUserRole !== 'owner') {
      throw new ForbiddenError('Solo el owner puede eliminar a un owner')
    }

    await this.userRepo.delete(input.agentId, input.orgId)
  }
}
