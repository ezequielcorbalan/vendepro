import type { UserRepository } from '../../ports/repositories/user-repository'
import type { AuthService } from '../../ports/services/auth-service'
import type { IdGenerator } from '../../ports/id-generator'
import { User } from '../../../domain/entities/user'
import { ValidationError } from '../../../domain/errors/validation-error'
import { ForbiddenError } from '../../../domain/errors/forbidden'
import { canManageAgents } from '../../../domain/rules/role-rules'

export interface CreateAgentInput {
  requestingUserRole: string
  org_id: string
  email: string
  password: string
  name: string
  role: string
  phone?: string | null
}

export class CreateAgentUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly authService: AuthService,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: CreateAgentInput): Promise<{ id: string }> {
    if (!canManageAgents(input.requestingUserRole as any)) {
      throw new ForbiddenError('No tienes permiso para crear agentes')
    }

    const existing = await this.userRepo.findByEmail(input.email)
    if (existing) throw new ValidationError('Ya existe un usuario con ese email')

    const passwordHash = await this.authService.hashPassword(input.password)
    const user = User.create({
      id: this.idGen.generate(),
      org_id: input.org_id,
      email: input.email,
      password_hash: passwordHash,
      full_name: input.name,
      role: input.role as any,
      phone: input.phone ?? null,
      photo_url: null,
      active: 1,
    })

    await this.userRepo.save(user)
    return { id: user.id }
  }
}
