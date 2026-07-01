import type { ApiTokenRepository } from '../../ports/repositories/api-token-repository'
import type { IdGenerator } from '../../ports/id-generator'
import type { AuthService } from '../../ports/services/auth-service'
import { ApiToken } from '../../../domain/entities/api-token'

export interface CreateApiTokenInput {
  orgId: string
  name: string
  scopes?: string[]
  createdBy?: string | null
}

export interface CreateApiTokenResult {
  id: string
  name: string
  scopes: string[]
  prefix: string | null
  created_at: string
  /** El JWT en claro. Sólo se devuelve acá, en la creación — nunca se guarda ni se vuelve a mostrar. */
  token: string
}

const DEFAULT_SCOPES = ['leads:write']

/** Enmascara el token para poder identificarlo en la UI sin exponerlo. */
function maskToken(token: string): string {
  if (token.length <= 16) return `${token.slice(0, 4)}…`
  return `${token.slice(0, 12)}…${token.slice(-4)}`
}

export class CreateApiTokenUseCase {
  constructor(
    private readonly repo: ApiTokenRepository,
    private readonly ids: IdGenerator,
    private readonly authService: AuthService,
  ) {}

  async execute(input: CreateApiTokenInput): Promise<CreateApiTokenResult> {
    const id = this.ids.generate()
    const scopes = input.scopes && input.scopes.length > 0 ? input.scopes : DEFAULT_SCOPES

    // JWT de integración sin expiración. La revocación se hace vía DB (is_active).
    const token = await this.authService.createToken(
      { typ: 'integration', org_id: input.orgId, tid: id, scopes },
      { expiresIn: null },
    )

    const entity = ApiToken.create({
      id,
      org_id: input.orgId,
      name: input.name,
      scopes,
      prefix: maskToken(token),
      created_by: input.createdBy ?? null,
      is_active: true,
      last_used_at: null,
      revoked_at: null,
    })

    await this.repo.save(entity)

    return {
      id: entity.id,
      name: entity.name,
      scopes: entity.scopes,
      prefix: entity.prefix,
      created_at: entity.created_at,
      token,
    }
  }
}
