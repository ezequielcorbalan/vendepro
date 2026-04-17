import type { UserRepository } from '../../ports/repositories/user-repository'
import type { RoleRepository } from '../../ports/repositories/role-repository'
import { ForbiddenError } from '../../../domain/errors/forbidden'
import { NotFoundError } from '../../../domain/errors/not-found'
import { ValidationError } from '../../../domain/errors/validation-error'
import { canManageAgents } from '../../../domain/rules/role-rules'

export interface UpdateAgentRoleInput {
  requestingUserRole: string
  agentId: string
  orgId: string
  roleId: number
}

export class UpdateAgentRoleUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly roleRepo: RoleRepository,
  ) {}

  async execute(input: UpdateAgentRoleInput): Promise<void> {
    if (!canManageAgents(input.requestingUserRole)) {
      throw new ForbiddenError('No tienes permiso para cambiar roles')
    }

    const role = await this.roleRepo.findById(input.roleId)
    if (!role) throw new ValidationError('Rol no encontrado', { roleId: 'Inválido' })

    if (role.name === 'owner' && input.requestingUserRole !== 'owner') {
      throw new ForbiddenError('Solo el owner puede asignar el rol owner')
    }

    const user = await this.userRepo.findById(input.agentId, input.orgId)
    if (!user) throw new NotFoundError('Agente', input.agentId)

    await this.userRepo.updateRole(input.agentId, input.orgId, role.id, role.name)
  }
}
