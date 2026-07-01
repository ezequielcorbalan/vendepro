import type { ApiTokenRepository } from '../../ports/repositories/api-token-repository'
import { ValidationError } from '../../../domain/errors/validation-error'

export interface RevokeApiTokenInput {
  id: string
  orgId: string
}

export class RevokeApiTokenUseCase {
  constructor(private readonly repo: ApiTokenRepository) {}

  async execute(input: RevokeApiTokenInput): Promise<{ success: true }> {
    if (!input.id) throw new ValidationError('id de token requerido')
    await this.repo.revoke(input.id, input.orgId)
    return { success: true }
  }
}
