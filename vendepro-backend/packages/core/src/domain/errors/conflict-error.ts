// packages/core/src/domain/errors/conflict-error.ts
import { DomainError } from './domain-error'

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT_ERROR'
  readonly httpStatus = 409

  constructor(message: string) {
    super(message)
  }
}
