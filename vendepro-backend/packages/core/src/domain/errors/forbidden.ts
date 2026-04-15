import { DomainError } from './domain-error'

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN'
  readonly httpStatus = 403

  constructor(message = 'Sin permisos para esta operación') {
    super(message)
  }
}
