import { ValidationError } from '../errors/validation-error'

export const PROPERTY_STAGES = [
  'propuesta', 'captada', 'documentacion', 'publicada', 'reservada',
  'suspendida', 'vencida',
  'vendida', 'perdida', 'invalida', 'archivada',
] as const
export type PropertyStageValue = typeof PROPERTY_STAGES[number]

const VALID_TRANSITIONS: Record<PropertyStageValue, PropertyStageValue[]> = {
  propuesta:     ['captada', 'invalida'],
  captada:       ['documentacion', 'publicada', 'perdida', 'invalida', 'suspendida'],
  documentacion: ['publicada', 'perdida', 'invalida', 'suspendida'],
  publicada:     ['reservada', 'perdida', 'vencida', 'suspendida'],
  reservada:     ['vendida', 'publicada', 'perdida', 'vencida', 'suspendida'],
  suspendida:    ['publicada', 'reservada', 'archivada'],
  vencida:       ['publicada', 'archivada'],
  vendida:       ['archivada'],
  perdida:       ['archivada'],
  invalida:      ['archivada'],
  archivada:     [],
}

const TERMINAL: PropertyStageValue[] = ['vendida', 'perdida', 'invalida', 'archivada']

export class PropertyStage {
  private constructor(readonly value: PropertyStageValue) {}

  static create(value: string): PropertyStage {
    if (!PROPERTY_STAGES.includes(value as PropertyStageValue)) {
      throw new ValidationError(`Stage comercial inválido: "${value}". Permitidos: ${PROPERTY_STAGES.join(', ')}`)
    }
    return new PropertyStage(value as PropertyStageValue)
  }

  canTransitionTo(next: PropertyStageValue): boolean {
    return VALID_TRANSITIONS[this.value].includes(next)
  }

  transitionTo(next: PropertyStageValue): PropertyStage {
    if (!this.canTransitionTo(next)) {
      const allowed = VALID_TRANSITIONS[this.value]
      throw new ValidationError(
        `Transición inválida de "${this.value}" a "${next}". Permitidas: ${allowed.length ? allowed.join(', ') : 'ninguna'}`
      )
    }
    return new PropertyStage(next)
  }

  isFinal(): boolean {
    return TERMINAL.includes(this.value)
  }

  equals(other: PropertyStage): boolean {
    return this.value === other.value
  }

  toString(): string {
    return this.value
  }
}
