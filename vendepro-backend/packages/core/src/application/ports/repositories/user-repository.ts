import type { User } from '../../../domain/entities/user'

export interface UserRepository {
  findById(id: string, orgId: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  /** Solo usuarios activos (los borrados quedan fuera de listados y asignaciones). */
  findByOrg(orgId: string): Promise<User[]>
  /** Papelera: usuarios con borrado lógico. */
  findDeletedByOrg(orgId: string): Promise<User[]>
  save(user: User): Promise<void>
  /** Borrado lógico: active = 0 + deleted_at. */
  delete(id: string, orgId: string): Promise<void>
  /** Deshace el borrado lógico. */
  restore(id: string, orgId: string): Promise<void>
  updateRole(id: string, orgId: string, roleId: number, roleName: string): Promise<void>
  findFirstAdminByOrg(orgId: string): Promise<User | null>
  findProfileById(id: string): Promise<User | null>
  updateProfile(id: string, patch: Partial<{ full_name: string; email: string; photo_url: string | null; phone: string | null }>): Promise<void>
}
