import { ValidationError } from '../errors/validation-error'

export const LEAD_STAGES = ['nuevo', 'asignado', 'contactado', 'calificado', 'en_tasacion', 'presentada', 'seguimiento', 'captado', 'perdido'] as const
export type LeadStageValue = typeof LEAD_STAGES[number]

// Valid forward and lateral transitions
const VALID_TRANSITIONS: Record<LeadStageValue, LeadStageValue[]> = {
  nuevo:       ['asignado', 'contactado', 'perdido'],
  asignado:    ['contactado', 'perdido'],
  contactado:  ['calificado', 'seguimiento', 'perdido'],
  calificado:  ['en_tasacion', 'seguimiento', 'perdido'],
  en_tasacion: ['presentada', 'seguimiento', 'perdido'],
  presentada:  ['seguimiento', 'captado', 'perdido'],
  seguimiento: ['calificado', 'en_tasacion', 'presentada', 'captado', 'perdido'],
  captado:     [],
  perdido:     [],
}

export class LeadStage {
  private constructor(readonly value: LeadStageValue) {}

  static create(value: string): LeadStage {
    if (!LEAD_STAGES.includes(value as LeadStageValue)) {
      throw new ValidationError(`Stage inválido: "${value}". Permitidos: ${LEAD_STAGES.join(', ')}`)
    }
    return new LeadStage(value as LeadStageValue)
  }

  canTransitionTo(next: LeadStageValue): boolean {
    return VALID_TRANSITIONS[this.value].includes(next)
  }

  transitionTo(next: LeadStageValue): LeadStage {
    if (!this.canTransitionTo(next)) {
      throw new ValidationError(
        `Transición inválida de "${this.value}" a "${next}". Permitidas: ${VALID_TRANSITIONS[this.value].join(', ') || 'ninguna'}`
      )
    }
    return new LeadStage(next)
  }

  isFinal(): boolean {
    return this.value === 'captado' || this.value === 'perdido'
  }

  equals(other: LeadStage): boolean {
    return this.value === other.value
  }

  toString(): string {
    return this.value
  }
}
