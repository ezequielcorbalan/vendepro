import { DomainError } from './domain-error'

export class QuotaExceededError extends DomainError {
  readonly code = 'QUOTA_EXCEEDED'
  readonly httpStatus = 429

  constructor(
    public readonly limit: number,
    public readonly used: number,
    public readonly resetAt: string,
  ) {
    super(`Quota mensual excedida: ${used}/${limit}. Se resetea el ${resetAt}.`)
    this.name = 'QuotaExceededError'
  }
}
