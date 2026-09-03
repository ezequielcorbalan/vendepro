import type { AgentProfileRepository } from '../../ports/repositories/agent-profile-repository'
import { AgentProfile, type AgentProfilePatch } from '../../../domain/entities/agent-profile'
import { AgentSlug, slugifyName } from '../../../domain/value-objects/agent-slug'
import { ValidationError } from '../../../domain/errors/validation-error'

export interface UpdateAgentProfileInput {
  orgId: string
  userId: string
  /** Se usa para derivar el slug la primera vez. */
  fullName: string
  patch: AgentProfilePatch
}

/** Mismo rango que valida el bloque agent-credentials (block-schemas.ts) — se replica acá
 * porque el patch llega directo de un PUT autenticado y el dominio no lo acota. */
const MIN_YEARS_EXPERIENCE = 0
const MAX_YEARS_EXPERIENCE = 70

function assertValidYearsExperience(value: number | null | undefined): void {
  if (value === undefined || value === null) return
  if (!Number.isInteger(value) || value < MIN_YEARS_EXPERIENCE || value > MAX_YEARS_EXPERIENCE) {
    throw new ValidationError(
      `Años de experiencia inválido: debe ser un entero entre ${MIN_YEARS_EXPERIENCE} y ${MAX_YEARS_EXPERIENCE}`,
    )
  }
}

export class UpdateAgentProfileUseCase {
  constructor(private readonly repo: AgentProfileRepository) {}

  async execute(input: UpdateAgentProfileInput): Promise<AgentProfile> {
    assertValidYearsExperience(input.patch.years_experience)

    const existing = await this.repo.findByUserId(input.userId)

    if (input.patch.slug !== undefined) {
      AgentSlug.create(input.patch.slug)
      const taken = await this.repo.existsSlug(input.orgId, input.patch.slug, input.userId)
      if (taken) throw new ValidationError(`El slug "${input.patch.slug}" ya está en uso en tu inmobiliaria`)
    }

    if (existing) {
      const updated = existing.update(input.patch)
      await this.repo.save(updated)
      return updated
    }

    const slug = input.patch.slug ?? slugifyName(input.fullName)
    AgentSlug.create(slug)
    if (input.patch.slug === undefined) {
      const taken = await this.repo.existsSlug(input.orgId, slug, input.userId)
      if (taken) throw new ValidationError(`El slug "${slug}" ya está en uso. Elegí otro.`)
    }

    const created = AgentProfile.create({ ...input.patch, user_id: input.userId, org_id: input.orgId, slug })
    await this.repo.save(created)
    return created
  }
}
