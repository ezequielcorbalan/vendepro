import type { UserRepository } from '../../ports/repositories/user-repository'
import type { User } from '../../../domain/entities/user'

export class GetUserProfileUseCase {
  constructor(private readonly repo: UserRepository) {}

  async execute(userId: string): Promise<User | null> {
    return await this.repo.findProfileById(userId)
  }
}
