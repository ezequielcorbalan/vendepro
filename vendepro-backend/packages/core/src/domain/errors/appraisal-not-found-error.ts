import { DomainError } from './domain-error'

export class AppraisalNotFoundError extends DomainError {
  readonly code = 'APPRAISAL_NOT_FOUND'
  readonly httpStatus = 404

  constructor(id: string) {
    super(`Tasación no encontrada: ${id}`)
    this.name = 'AppraisalNotFoundError'
  }
}
