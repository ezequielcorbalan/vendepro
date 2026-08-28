import { DomainError } from './domain-error'

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND'
  readonly httpStatus = 404

  /**
   * Dos formas de uso, las dos ya presentes en el código:
   *   new NotFoundError('SoldProperty', id)   → 'SoldProperty con id "x" no encontrado'
   *   new NotFoundError('Contacto no encontrado')  → el mensaje tal cual
   *
   * `id` era obligatorio en el tipo pero 25 call sites lo omitían, así que esos
   * mensajes salían como `Contacto no encontrado con id "undefined" no encontrado`.
   */
  constructor(entity: string, id?: string) {
    super(id === undefined ? entity : `${entity} con id "${id}" no encontrado`)
  }
}
