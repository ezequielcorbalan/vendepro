import type { UserRepository } from '../../ports/repositories/user-repository'

export interface UpdateUserProfileInput {
  userId: string
  full_name?: string
  email?: string
  photo_url?: string | null
  phone?: string | null
}

export class UpdateUserProfileUseCase {
  constructor(private readonly repo: UserRepository) {}

  async execute(input: UpdateUserProfileInput): Promise<void> {
    const { userId, ...patch } = input
    await this.repo.updateProfile(userId, patch)
  }
}
