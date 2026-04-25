import { DomainError } from './domain-error'

export class RenderTimeoutError extends DomainError {
  readonly code = 'RENDER_TIMEOUT'
  readonly httpStatus = 503

  constructor() {
    super('Browser rendering timeout (>30s)')
    this.name = 'RenderTimeoutError'
  }
}
