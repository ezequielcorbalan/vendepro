import { DomainError } from './domain-error'

export class RenderFailedError extends DomainError {
  readonly code = 'RENDER_FAILED'
  readonly httpStatus = 500

  constructor(message: string) {
    super(`Browser rendering failed: ${message}`)
    this.name = 'RenderFailedError'
  }
}
