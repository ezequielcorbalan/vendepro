import type { ApiTokenRepository } from '../../ports/repositories/api-token-repository'
import type { ApiTokenProps } from '../../../domain/entities/api-token'

export type ApiTokenListItem = Omit<ApiTokenProps, never>

export class ListApiTokensUseCase {
  constructor(private readonly repo: ApiTokenRepository) {}

  /** Devuelve la metadata de los tokens de la org. El valor del token nunca se almacena ni se expone. */
  async execute(orgId: string): Promise<ApiTokenListItem[]> {
    const tokens = await this.repo.findByOrg(orgId)
    return tokens.map((t) => t.toObject())
  }
}
