import { ValidationError } from '../errors/validation-error'

export const PROPERTY_STAGES = ['captacion', 'publicada', 'con_ofertas', 'reservada', 'vendida', 'suspendida', 'perdida'] as const
export type PropertyStageValue = typeof PROPERTY_STAGES[number]

const VALID_TRANSITIONS: Record<PropertyStageValue, PropertyStageValue[]> = {
  captacion:   ['publicada', 'suspendida', 'perdida'],
  publicada:   ['con_ofertas', 'reservada', 'suspendida', 'perdida'],
  con_ofertas: ['reservada', 'publicada', 'suspendida', 'perdida'],
  reservada:   ['vendida', 'publicada', 'suspendida', 'perdida'],
  vendida:     [],
  suspendida:  ['captacion', 'publicada'],
  perdida:     [],
}

export class PropertyStage {
  private constructor(readonly value: PropertyStageValue) {}

  static create(value: string): PropertyStage {
    if (!PROPERTY_STAGES.includes(value as PropertyStageValue)) {
      throw new ValidationError(`Stage comercial inválido: "${value}"`)
    }
    return new PropertyStage(value as PropertyStageValue)
  }

  canTransitionTo(next: PropertyStageValue): boolean {
    return VALID_TRANSITIONS[this.value].includes(next)
  }

  transitionTo(next: PropertyStageValue): PropertyStage {
    if (!this.canTransitionTo(next)) {
      throw new ValidationError(`Transición inválida de "${this.value}" a "${next}"`)
    }
    return new PropertyStage(next)
  }

  toString(): string {
    return this.value
  }
}
