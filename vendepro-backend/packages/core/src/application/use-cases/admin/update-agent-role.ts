import type { UserRepository } from '../../ports/repositories/user-repository'
import { ForbiddenError } from '../../../domain/errors/forbidden'
import { NotFoundError } from '../../../domain/errors/not-found'
import { canManageAgents } from '../../../domain/rules/role-rules'

export interface UpdateAgentRoleInput {
  requestingUserRole: string
  agentId: string
  orgId: string
  roleId: number
  roleName: string
}

export class UpdateAgentRoleUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(input: UpdateAgentRoleInput): Promise<void> {
    if (!canManageAgents(input.requestingUserRole)) {
      throw new ForbiddenError('No tienes permiso para cambiar roles')
    }
    if (input.roleName === 'owner' && input.requestingUserRole !== 'owner') {
      throw new ForbiddenError('Solo el owner puede asignar el rol owner')
    }
    const user = await this.userRepo.findById(input.agentId, input.orgId)
    if (!user) throw new NotFoundError('Agente', input.agentId)
    await this.userRepo.updateRole(input.agentId, input.orgId, input.roleId, input.roleName)
  }
}
