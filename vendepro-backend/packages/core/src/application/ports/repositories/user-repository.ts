import type { User } from '../../../domain/entities/user'

export interface UserRepository {
  findById(id: string, orgId: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  findByOrg(orgId: string): Promise<User[]>
  save(user: User): Promise<void>
  delete(id: string, orgId: string): Promise<void>
  updateRole(id: string, orgId: string, roleId: number, roleName: string): Promise<void>
  findFirstAdminByOrg(orgId: string): Promise<User | null>
  findProfileById(id: string): Promise<User | null>
  updateProfile(id: string, patch: Partial<{ full_name: string; email: string; photo_url: string | null; phone: string | null }>): Promise<void>
}
