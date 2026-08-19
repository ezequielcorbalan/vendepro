import type { UserRepository } from '../../ports/repositories/user-repository'
import type { AuthService } from '../../ports/services/auth-service'
import { User } from '../../../domain/entities/user'
import { ForbiddenError } from '../../../domain/errors/forbidden'
import { NotFoundError } from '../../../domain/errors/not-found'
import { ValidationError } from '../../../domain/errors/validation-error'
import { canManageAgents } from '../../../domain/rules/role-rules'

export interface UpdateAgentInput {
  requestingUserRole: string
  agentId: string
  orgId: string
  full_name?: string
  email?: string
  phone?: string | null
  /** Opcional: si viene vacío o ausente, la contraseña queda como está. */
  password?: string
}

/**
 * Edición de un agente desde el panel de administración: nombre, email,
 * teléfono y reseteo de contraseña. El rol se cambia por UpdateAgentRoleUseCase.
 */
export class UpdateAgentUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly authService: AuthService,
  ) {}

  async execute(input: UpdateAgentInput): Promise<void> {
    if (!canManageAgents(input.requestingUserRole)) {
      throw new ForbiddenError('No tienes permiso para editar agentes')
    }

    const user = await this.userRepo.findById(input.agentId, input.orgId)
    if (!user) throw new NotFoundError('Agente', input.agentId)

    // Sin esto, un admin podría cambiarle la contraseña al owner y quedarse
    // con la cuenta de mayor privilegio.
    if (user.role === 'owner' && input.requestingUserRole !== 'owner') {
      throw new ForbiddenError('Solo el owner puede editar al owner')
    }

    const current = user.toObject()

    let password_hash = current.password_hash
    if (input.password) {
      if (input.password.length < 6) {
        throw new ValidationError('La contraseña debe tener al menos 6 caracteres', {
          password: 'Mínimo 6 caracteres',
        })
      }
      password_hash = await this.authService.hashPassword(input.password)
    }

    const email = input.email ? input.email.toLowerCase().trim() : current.email
    if (email !== current.email) {
      const existing = await this.userRepo.findByEmail(email)
      if (existing && existing.id !== user.id) {
        throw new ValidationError('Ya existe un usuario con ese email', { email: 'En uso' })
      }
    }

    // User.create revalida email y nombre antes de tocar la base.
    const updated = User.create({
      ...current,
      email,
      full_name: input.full_name?.trim() || current.full_name,
      phone: input.phone !== undefined ? (input.phone || null) : current.phone,
      password_hash,
    })

    await this.userRepo.save(updated)
  }
}
