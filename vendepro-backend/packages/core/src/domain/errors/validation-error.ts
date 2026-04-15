import { DomainError } from './domain-error'

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR'
  readonly httpStatus = 400
  readonly fields: Record<string, string>

  constructor(message: string, fields: Record<string, string> = {}) {
    super(message)
    this.fields = fields
  }
}
