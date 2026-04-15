import { ValidationError } from '../errors/validation-error'

export class Email {
  private constructor(readonly value: string) {}

  static create(value: string): Email {
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new ValidationError(`Email inválido: "${value}"`)
    }
    return new Email(value.toLowerCase().trim())
  }

  toString(): string {
    return this.value
  }

  equals(other: Email): boolean {
    return this.value === other.value
  }
}
