import type { ApiTokenRepository } from '../../ports/repositories/api-token-repository'
import { ValidationError } from '../../../domain/errors/validation-error'

export interface DeleteApiTokenInput {
  id: string
  orgId: string
}

// Borrado definitivo: el registro desaparece de la lista y el JWT deja de
// autenticar (la validación exige un registro activo en api_tokens).
export class DeleteApiTokenUseCase {
  constructor(private readonly repo: ApiTokenRepository) {}

  async execute(input: DeleteApiTokenInput): Promise<{ success: true }> {
    if (!input.id) throw new ValidationError('id de token requerido')
    await this.repo.delete(input.id, input.orgId)
    return { success: true }
  }
}
