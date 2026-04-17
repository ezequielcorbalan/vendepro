import type { PasswordResetToken } from '../../../domain/entities/password-reset-token'

export interface PasswordResetTokenRepository {
  save(token: PasswordResetToken): Promise<void>
  findByToken(token: string): Promise<PasswordResetToken | null>
  markUsed(token: string): Promise<void>
  deleteExpired(now?: Date): Promise<number>
}
