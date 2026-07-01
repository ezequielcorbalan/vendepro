import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { ContactRepository } from '../../ports/repositories/contact-repository'
import type { UserRepository } from '../../ports/repositories/user-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { ValidationError } from '../../../domain/errors/validation-error'
import { CreateLeadWithContactUseCase } from '../leads/create-lead-with-contact'

export interface ImportLeadItem {
  full_name: string
  phone?: string | null
  email?: string | null
  source_detail?: string | null
  operation?: string
  notes?: string | null
}

export interface ImportLeadsInput {
  orgId: string
  leads: ImportLeadItem[]
}

export interface ImportLeadResult {
  index: number
  ok: boolean
  id?: string
  contact_id?: string
  error?: string
}

export interface ImportLeadsResult {
  ok: boolean
  created: number
  failed: number
  results: ImportLeadResult[]
}

export const MAX_IMPORT_BATCH = 100

/**
 * Importa leads desde una integración externa (API /v1/leads).
 * Los leads entran SIN asignar (assigned_to null), en stage `nuevo`, para la cola
 * de nuevos. El contacto asociado sí necesita dueño (modelo de datos), así que se
 * asigna al admin de la org. Procesa por item: un lead inválido no aborta el lote.
 */
export class ImportLeadsUseCase {
  constructor(
    private readonly leadRepo: LeadRepository,
    private readonly contactRepo: ContactRepository,
    private readonly userRepo: UserRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: ImportLeadsInput): Promise<ImportLeadsResult> {
    if (!Array.isArray(input.leads) || input.leads.length === 0) {
      throw new ValidationError('Se requiere al menos un lead')
    }
    if (input.leads.length > MAX_IMPORT_BATCH) {
      throw new ValidationError(`Máximo ${MAX_IMPORT_BATCH} leads por request`)
    }

    const admin = await this.userRepo.findFirstAdminByOrg(input.orgId)
    if (!admin) {
      throw new ValidationError('Organización sin administrador configurado')
    }

    const createLeadWithContact = new CreateLeadWithContactUseCase(
      this.leadRepo,
      this.contactRepo,
      this.ids,
    )

    const results: ImportLeadResult[] = []

    for (const [index, lead] of input.leads.entries()) {
      try {
        const full_name = lead.full_name?.trim()
        if (!full_name) throw new ValidationError('full_name es requerido')

        const res = await createLeadWithContact.execute({
          org_id: input.orgId,
          assigned_to: null, // lead sin asignar (cola de nuevos)
          full_name,
          phone: lead.phone ?? null,
          email: lead.email ?? null,
          source: 'api',
          source_detail: lead.source_detail ?? null,
          operation: lead.operation ?? 'otro',
          notes: lead.notes ?? null,
          contact_data: {
            full_name,
            phone: lead.phone ?? null,
            email: lead.email ?? null,
            agent_id: admin.id, // el contacto sí requiere dueño
            contact_type: 'otro',
            source: 'api',
          },
        })

        results.push({ index, ok: true, id: res.id, contact_id: res.contact_id })
      } catch (e) {
        results.push({ index, ok: false, error: e instanceof Error ? e.message : 'Error desconocido' })
      }
    }

    const created = results.filter((r) => r.ok).length
    return {
      ok: created > 0,
      created,
      failed: results.length - created,
      results,
    }
  }
}
