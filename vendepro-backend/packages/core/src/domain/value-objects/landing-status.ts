import { ValidationError } from '../errors/validation-error'

export const LANDING_STATUSES = ['draft', 'pending_review', 'published', 'archived'] as const
export type LandingStatusValue = typeof LANDING_STATUSES[number]

const TRANSITIONS: Record<LandingStatusValue, LandingStatusValue[]> = {
  draft:          ['pending_review', 'archived'],
  pending_review: ['published', 'draft'],           // published = admin aprueba; draft = admin rechaza
  published:      ['archived', 'draft'],            // draft = volver a editar
  archived:       ['draft'],                        // unarchive
}

export class LandingStatus {
  private constructor(readonly value: LandingStatusValue) {}

  static create(value: string): LandingStatus {
    if (!LANDING_STATUSES.includes(value as LandingStatusValue)) {
      throw new ValidationError(`Status inválido: "${value}". Permitidos: ${LANDING_STATUSES.join(', ')}`)
    }
    return new LandingStatus(value as LandingStatusValue)
  }

  canTransitionTo(next: LandingStatusValue): boolean {
    return TRANSITIONS[this.value].includes(next)
  }

  transitionTo(next: LandingStatusValue): LandingStatus {
    if (!this.canTransitionTo(next)) {
      throw new ValidationError(
        `Transición inválida de "${this.value}" a "${next}". Permitidas: ${TRANSITIONS[this.value].join(', ') || 'ninguna'}`
      )
    }
    return new LandingStatus(next)
  }

  isPublic(): boolean { return this.value === 'published' }
  equals(other: LandingStatus): boolean { return this.value === other.value }
  toString(): string { return this.value }
}
