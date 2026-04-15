import { DomainError } from './domain-error'

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED'
  readonly httpStatus = 401

  constructor(message = 'No autorizado') {
    super(message)
  }
}
