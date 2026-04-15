import type { UserRepository } from '../../ports/repositories/user-repository'
import type { AuthService } from '../../ports/services/auth-service'
import type { IdGenerator } from '../../ports/id-generator'
import { User } from '../../../domain/entities/user'
import { ValidationError } from '../../../domain/errors/validation-error'

export interface CreateUserInput {
  email: string
  password: string
  name: string
  role: string
  org_id: string
  phone?: string | null
  photo_url?: string | null
}

export class CreateUserUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly authService: AuthService,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: CreateUserInput): Promise<{ id: string }> {
    const existing = await this.userRepo.findByEmail(input.email)
    if (existing) throw new ValidationError('Ya existe un usuario con ese email')

    const passwordHash = await this.authService.hashPassword(input.password)
    const user = User.create({
      id: this.idGen.generate(),
      email: input.email,
      password_hash: passwordHash,
      full_name: input.name,
      role: input.role as any,
      org_id: input.org_id,
      phone: input.phone ?? null,
      photo_url: input.photo_url ?? null,
      active: 1,
    })

    await this.userRepo.save(user)
    return { id: user.id }
  }
}
