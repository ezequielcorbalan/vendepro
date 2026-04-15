import { DomainError } from './domain-error'

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND'
  readonly httpStatus = 404

  constructor(entity: string, id: string) {
    super(`${entity} con id "${id}" no encontrado`)
  }
}
