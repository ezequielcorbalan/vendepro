import { ValidationError } from '../errors/validation-error'

export const EVENT_TYPES = ['llamada', 'reunion', 'visita_captacion', 'visita_comprador', 'tasacion', 'seguimiento', 'admin', 'firma', 'otro'] as const
export type EventTypeValue = typeof EVENT_TYPES[number]

export class EventType {
  private constructor(readonly value: EventTypeValue) {}

  static create(value: string): EventType {
    if (!EVENT_TYPES.includes(value as EventTypeValue)) {
      throw new ValidationError(`Tipo de evento inválido: "${value}". Permitidos: ${EVENT_TYPES.join(', ')}`)
    }
    return new EventType(value as EventTypeValue)
  }

  toString(): string {
    return this.value
  }
}
