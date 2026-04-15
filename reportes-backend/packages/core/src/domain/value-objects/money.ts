import { ValidationError } from '../errors/validation-error'

export type Currency = 'USD' | 'ARS'

export class Money {
  private constructor(
    readonly amount: number,
    readonly currency: Currency,
  ) {}

  static create(amount: number, currency: string): Money {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new ValidationError('El monto debe ser un número positivo')
    }
    if (currency !== 'USD' && currency !== 'ARS') {
      throw new ValidationError(`Moneda inválida: "${currency}". Usar USD o ARS`)
    }
    return new Money(amount, currency as Currency)
  }

  format(): string {
    return this.currency === 'USD'
      ? `USD ${this.amount.toLocaleString('es-AR')}`
      : `$ ${this.amount.toLocaleString('es-AR')}`
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency
  }
}
