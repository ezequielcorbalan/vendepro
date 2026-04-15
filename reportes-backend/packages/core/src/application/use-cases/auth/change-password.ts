import type { UserRepository } from '../../ports/repositories/user-repository'
import type { AuthService } from '../../ports/services/auth-service'
import { UnauthorizedError } from '../../../domain/errors/unauthorized'
import { ValidationError } from '../../../domain/errors/validation-error'

export interface ChangePasswordInput {
  userId: string
  orgId: string
  currentPassword: string
  newPassword: string
}

export class ChangePasswordUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly authService: AuthService,
  ) {}

  async execute(input: ChangePasswordInput): Promise<void> {
    const user = await this.userRepo.findById(input.userId, input.orgId)
    if (!user) throw new UnauthorizedError('Usuario no encontrado')

    const valid = await this.authService.verifyPassword(input.currentPassword, user.password_hash)
    if (!valid) throw new UnauthorizedError('Contraseña actual incorrecta')

    if (input.newPassword.length < 6) throw new ValidationError('La nueva contraseña debe tener al menos 6 caracteres')

    const newHash = await this.authService.hashPassword(input.newPassword)
    user.updatePassword(newHash)
    await this.userRepo.save(user)
  }
}
