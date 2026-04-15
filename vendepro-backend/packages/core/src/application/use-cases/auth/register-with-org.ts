import type { OrganizationRepository } from '../../ports/repositories/organization-repository'
import type { UserRepository } from '../../ports/repositories/user-repository'
import type { AuthService } from '../../ports/services/auth-service'
import type { IdGenerator } from '../../ports/id-generator'
import { Organization } from '../../../domain/entities/organization'
import { User } from '../../../domain/entities/user'
import { ConflictError } from '../../../domain/errors/conflict-error'
import { ValidationError } from '../../../domain/errors/validation-error'

export interface RegisterWithOrgInput {
  org_name: string
  org_slug: string
  admin_name: string
  email: string
  password: string
  logo_url?: string | null
  brand_color?: string | null
}

export interface RegisterWithOrgOutput {
  token: string
  user: { id: string; email: string; name: string; role: string; org_id: string }
  org: { id: string; name: string; slug: string }
}

export class RegisterWithOrgUseCase {
  constructor(
    private readonly orgRepo: OrganizationRepository,
    private readonly userRepo: UserRepository,
    private readonly authService: AuthService,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: RegisterWithOrgInput): Promise<RegisterWithOrgOutput> {
    if (input.password.length < 8) {
      throw new ValidationError('La contraseña debe tener al menos 8 caracteres')
    }

    const slug = this.sanitizeSlug(input.org_slug)

    const existingOrg = await this.orgRepo.findBySlug(slug)
    if (existingOrg) throw new ConflictError('El nombre de inmobiliaria ya está en uso')

    const existingUser = await this.userRepo.findByEmail(input.email)
    if (existingUser) throw new ConflictError('Ya existe una cuenta con ese email')

    const orgId = 'org_' + this.idGen.generate()
    const userId = this.idGen.generate()

    const org = Organization.create({
      id: orgId,
      name: input.org_name.trim(),
      slug,
      logo_url: input.logo_url ?? null,
      brand_color: input.brand_color ?? '#ff007c',
      brand_accent_color: null,
      canva_template_id: null,
      canva_report_template_id: null,
      owner_id: userId,
    })

    const passwordHash = await this.authService.hashPassword(input.password)
    const user = User.create({
      id: userId,
      email: input.email,
      password_hash: passwordHash,
      full_name: input.admin_name.trim(),
      role: 'admin',
      org_id: orgId,
      phone: null,
      photo_url: null,
      active: 1,
    })

    await this.orgRepo.save(org)
    await this.userRepo.save(user)

    const token = await this.authService.createToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      org_id: user.org_id,
    })

    return {
      token,
      user: { id: user.id, email: user.email, name: user.full_name, role: user.role, org_id: user.org_id! },
      org: { id: org.id, name: org.name, slug: org.slug },
    }
  }

  private sanitizeSlug(raw: string): string {
    return raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }
}
