import type { UserRepository } from '../../ports/repositories/user-repository'
import type { User } from '../../../domain/entities/user'
import { ForbiddenError } from '../../../domain/errors/forbidden'
import { canManageOrg } from '../../../domain/rules/role-rules'

export class GetAgentsUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(orgId: string, requestingUserRole: string): Promise<User[]> {
    if (!canManageOrg(requestingUserRole as any)) {
      throw new ForbiddenError('No tienes permiso para ver todos los agentes')
    }
    return this.userRepo.findByOrg(orgId)
  }
}
