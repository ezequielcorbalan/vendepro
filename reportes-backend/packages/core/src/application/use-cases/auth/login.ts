import type { UserRepository } from '../../ports/repositories/user-repository'
import type { AuthService } from '../../ports/services/auth-service'
import { UnauthorizedError } from '../../../domain/errors/unauthorized'

export interface LoginInput {
  email: string
  password: string
}

export interface LoginOutput {
  token: string
  user: {
    id: string
    email: string
    name: string
    role: string
    org_id: string
  }
}

export class LoginUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly authService: AuthService,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const user = await this.userRepo.findByEmail(input.email)
    if (!user) throw new UnauthorizedError('Credenciales inválidas')

    const valid = await this.authService.verifyPassword(input.password, user.password_hash)
    if (!valid) throw new UnauthorizedError('Credenciales inválidas')

    const token = await this.authService.createToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      org_id: user.org_id,
    })

    return {
      token,
      user: { id: user.id, email: user.email, name: user.full_name, role: user.role, org_id: user.org_id },
    }
  }
}
