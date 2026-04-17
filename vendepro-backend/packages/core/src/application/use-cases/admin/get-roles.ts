import type { RoleRepository } from '../../ports/repositories/role-repository'
import type { Role } from '../../../domain/entities/role'
import { UnauthorizedError } from '../../../domain/errors/unauthorized'

export class GetRolesUseCase {
  constructor(private readonly repo: RoleRepository) {}

  async execute(requestingUserRole: string): Promise<Role[]> {
    if (requestingUserRole !== 'admin' && requestingUserRole !== 'owner') {
      throw new UnauthorizedError('Solo admin puede listar roles')
    }
    return await this.repo.findAll()
  }
}
