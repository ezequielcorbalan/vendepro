import type { OrganizationRepository } from '../../ports/repositories/organization-repository'
import type { UserRepository } from '../../ports/repositories/user-repository'
import type { ContactRepository } from '../../ports/repositories/contact-repository'
import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { UnauthorizedError } from '../../../domain/errors/unauthorized'
import { ValidationError } from '../../../domain/errors/validation-error'
import { CreateLeadWithContactUseCase } from '../leads/create-lead-with-contact'

export interface CreatePublicLeadInput {
  apiKey: string
  full_name: string
  phone?: string | null
  email?: string | null
  source_detail?: string | null
  operation?: string
  notes?: string | null
}

export interface CreatePublicLeadResult {
  id: string
  contact_id: string
  success: true
}

export class CreatePublicLeadUseCase {
  constructor(
    private readonly organizationRepo: OrganizationRepository,
    private readonly userRepo: UserRepository,
    private readonly contactRepo: ContactRepository,
    private readonly leadRepo: LeadRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreatePublicLeadInput): Promise<CreatePublicLeadResult> {
    const org = await this.organizationRepo.findByApiKey(input.apiKey)
    if (!org) throw new UnauthorizedError('API key inválida')

    if (!input.full_name?.trim()) {
      throw new ValidationError('full_name es requerido')
    }

    const admin = await this.userRepo.findFirstAdminByOrg(org.id)
    if (!admin) {
      throw new ValidationError('Organización sin administrador configurado')
    }

    const createLeadWithContact = new CreateLeadWithContactUseCase(
      this.leadRepo,
      this.contactRepo,
      this.ids,
    )

    const result = await createLeadWithContact.execute({
      org_id: org.id,
      assigned_to: admin.id,
      full_name: input.full_name.trim(),
      phone: input.phone ?? null,
      email: input.email ?? null,
      source: 'web',
      source_detail: input.source_detail ?? null,
      operation: input.operation ?? 'otro',
      notes: input.notes ?? null,
      contact_data: {
        full_name: input.full_name.trim(),
        phone: input.phone ?? null,
        email: input.email ?? null,
        agent_id: admin.id,
        contact_type: 'otro',
        source: 'web',
      },
    })

    return { id: result.id, contact_id: result.contact_id, success: true }
  }
}
