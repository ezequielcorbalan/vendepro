import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { ContactRepository } from '../../ports/repositories/contact-repository'
import type { UserRepository } from '../../ports/repositories/user-repository'
import type { TagRepository } from '../../ports/repositories/tag-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { ValidationError } from '../../../domain/errors/validation-error'
import { Tag } from '../../../domain/entities/tag'
import { CreateLeadWithContactUseCase } from '../leads/create-lead-with-contact'

export interface ImportLeadItem {
  full_name: string
  phone?: string | null
  email?: string | null
  source_detail?: string | null
  operation?: string
  notes?: string | null
  tags?: string[]
  property_address?: string | null
  neighborhood?: string | null
  property_type?: string | null
  budget?: number | null
  estimated_value?: number | null
  timing?: string | null
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
  deduped?: boolean
  error?: string
}

export interface ImportLeadsResult {
  ok: boolean
  created: number
  failed: number
  results: ImportLeadResult[]
}

export const MAX_IMPORT_BATCH = 100

/** Normaliza un tag a slug: minúsculas, sin acentos, no-alfanuméricos → guión. */
export function slugifyTag(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Importa leads desde una integración externa (API /v1/leads).
 * Los leads entran SIN asignar (assigned_to null), en stage `nuevo`, para la cola
 * de nuevos. El contacto asociado sí necesita dueño (modelo de datos), así que se
 * asigna al admin de la org. Procesa por item: un lead inválido no aborta el lote.
 *
 * Dedup: si ya existe un contacto en la org con el mismo email (o teléfono,
 * últimos 10 dígitos), se reutiliza en vez de crear uno nuevo (`deduped: true`).
 * Tags: se normalizan a slug y se auto-crean si no existen; un tag que falla
 * no aborta el lead.
 */
export class ImportLeadsUseCase {
  constructor(
    private readonly leadRepo: LeadRepository,
    private readonly contactRepo: ContactRepository,
    private readonly userRepo: UserRepository,
    private readonly ids: IdGenerator,
    private readonly tagRepo?: TagRepository,
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

        const existing = await this.findExistingContact(input.orgId, lead)

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
          property_address: lead.property_address ?? null,
          neighborhood: lead.neighborhood ?? null,
          property_type: lead.property_type ?? null,
          budget: lead.budget ?? null,
          estimated_value: lead.estimated_value ?? null,
          timing: lead.timing ?? null,
          contact_id: existing?.id ?? null,
          contact_data: existing
            ? undefined
            : {
                full_name,
                phone: lead.phone ?? null,
                email: lead.email ?? null,
                agent_id: admin.id, // el contacto sí requiere dueño
                contact_type: 'otro',
                source: 'api',
              },
        })

        await this.applyTags(input.orgId, res.id, lead.tags)

        results.push({ index, ok: true, id: res.id, contact_id: res.contact_id, deduped: !!existing })
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

  private async findExistingContact(orgId: string, lead: ImportLeadItem) {
    if (!lead.email && !lead.phone) return null
    try {
      return await this.contactRepo.findByEmailOrPhone(orgId, lead.email ?? null, lead.phone ?? null)
    } catch {
      return null // dedup best-effort: si falla la búsqueda, se crea contacto nuevo
    }
  }

  private async applyTags(orgId: string, leadId: string, rawTags?: string[]): Promise<void> {
    if (!this.tagRepo || !Array.isArray(rawTags)) return
    for (const raw of rawTags) {
      try {
        const name = slugifyTag(String(raw ?? ''))
        if (!name) continue
        let tag = await this.tagRepo.findByName(orgId, name)
        if (!tag) {
          tag = Tag.create({
            id: this.ids.generate(),
            org_id: orgId,
            name,
            color: '#6366f1',
            is_default: 0,
          })
          await this.tagRepo.save(tag)
        }
        await this.tagRepo.addToLead(leadId, tag.id, orgId)
      } catch {
        // un tag que falla no aborta el lead ni el lote
      }
    }
  }
}
