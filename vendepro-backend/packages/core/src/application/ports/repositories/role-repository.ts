import type { Role } from '../../../domain/entities/role'

export interface RoleRepository {
  findAll(): Promise<Role[]>
  findById(id: number): Promise<Role | null>
}
