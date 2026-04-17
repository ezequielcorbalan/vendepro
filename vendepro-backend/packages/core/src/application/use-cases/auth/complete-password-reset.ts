import type { UserRepository } from '../../ports/repositories/user-repository'
import type { PasswordResetTokenRepository } from '../../ports/repositories/password-reset-token-repository'
import type { AuthService } from '../../ports/services/auth-service'
import { ValidationError } from '../../../domain/errors/validation-error'

export interface CompletePasswordResetInput {
  token: string
  newPassword: string
}

export class CompletePasswordResetUseCase {
  constructor(
    private readonly tokenRepo: PasswordResetTokenRepository,
    private readonly userRepo: UserRepository,
    private readonly authService: AuthService,
  ) {}

  async execute(input: CompletePasswordResetInput): Promise<void> {
    if (!input.newPassword || input.newPassword.length < 8) {
      throw new ValidationError('La contraseña debe tener al menos 8 caracteres')
    }

    const tokenEntity = await this.tokenRepo.findByToken(input.token)
    if (!tokenEntity) throw new ValidationError('Token inválido')
    if (!tokenEntity.canBeUsed()) throw new ValidationError('Token inválido o expirado')

    const user = await this.userRepo.findById(tokenEntity.user_id, tokenEntity.org_id)
    if (!user) throw new ValidationError('Token inválido')

    const newHash = await this.authService.hashPassword(input.newPassword)
    user.updatePassword(newHash)
    await this.userRepo.save(user)

    await this.tokenRepo.markUsed(tokenEntity.token)
  }
}
