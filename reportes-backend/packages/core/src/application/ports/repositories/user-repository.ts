import type { User } from '../../../domain/entities/user'

export interface UserRepository {
  findById(id: string, orgId: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  findByOrg(orgId: string): Promise<User[]>
  save(user: User): Promise<void>
  delete(id: string, orgId: string): Promise<void>
}
