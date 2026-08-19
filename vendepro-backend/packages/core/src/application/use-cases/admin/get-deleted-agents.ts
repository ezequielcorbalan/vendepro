import type { UserRepository } from '../../ports/repositories/user-repository'
import type { User } from '../../../domain/entities/user'
import { ForbiddenError } from '../../../domain/errors/forbidden'
import { canManageAgents } from '../../../domain/rules/role-rules'

/** Papelera de agentes: los borrados lógicamente, para poder restaurarlos. */
export class GetDeletedAgentsUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(orgId: string, requestingUserRole: string): Promise<User[]> {
    if (!canManageAgents(requestingUserRole)) {
      throw new ForbiddenError('No tienes permiso para ver la papelera de agentes')
    }
    return this.userRepo.findDeletedByOrg(orgId)
  }
}
