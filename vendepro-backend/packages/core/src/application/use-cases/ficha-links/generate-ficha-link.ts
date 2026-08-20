import type { FichaLinkRepository } from '../../ports/repositories/ficha-link-repository'
import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { FichaLink, type FichaLinkMode, type FichaLinkPrefill } from '../../../domain/entities/ficha-link'
import { NotFoundError } from '../../../domain/errors/not-found'
import { ValidationError } from '../../../domain/errors/validation-error'

export interface GenerateFichaLinkInput {
  org_id: string
  agent_id: string
  mode: FichaLinkMode
  /** Sólo 'single': lead del que nace el link. Pre-llena con sus datos. */
  lead_id?: string | null
  label?: string | null
  prefill?: FichaLinkPrefill | null
  /**
   * Sólo 'open': link de la inmobiliaria en vez del agente. Los envíos caen
   * en el admin de la org. Requiere rol admin (lo valida la ruta).
   */
  institutional?: boolean
}

export interface GenerateFichaLinkOutput {
  id: string
  slug: string
  mode: FichaLinkMode
  reused: boolean
}

/**
 * Crea el link público de Ficha de Tasación que el propietario completa en
 * /f/<slug>.
 *
 * Un agente tiene UN link 'open' vigente: pedirlo de nuevo devuelve el mismo,
 * porque el link abierto vive pegado en la bio de Instagram y en la firma del
 * mail — regenerarlo rompería los que ya están publicados.
 */
export class GenerateFichaLinkUseCase {
  constructor(
    private readonly repo: FichaLinkRepository,
    private readonly ids: IdGenerator,
    private readonly leadRepo?: LeadRepository,
  ) {}

  async execute(input: GenerateFichaLinkInput): Promise<GenerateFichaLinkOutput> {
    const ownerAgentId = input.mode === 'open' && input.institutional ? null : input.agent_id

    if (input.mode === 'open') {
      const existing = await this.repo.findOpenLink(input.org_id, ownerAgentId)
      if (existing) {
        return { id: existing.id, slug: existing.slug, mode: 'open', reused: true }
      }
    }

    let prefill = input.prefill ?? null
    let leadId: string | null = null

    if (input.mode === 'single') {
      if (!input.lead_id) {
        throw new ValidationError('Un link dirigido requiere lead_id')
      }
      if (!this.leadRepo) {
        throw new ValidationError('LeadRepository requerido para links dirigidos')
      }
      const lead = await this.leadRepo.findById(input.lead_id, input.org_id)
      if (!lead) throw new NotFoundError('Lead', input.lead_id)
      leadId = lead.id

      // El pre-llenado sale del lead salvo que la ruta mande algo explícito:
      // el propietario no debería tipear lo que el CRM ya sabe.
      const fromLead = lead.toObject() as any
      prefill = {
        address: prefill?.address ?? fromLead.property_address ?? null,
        neighborhood: prefill?.neighborhood ?? fromLead.neighborhood ?? null,
        property_type: prefill?.property_type ?? fromLead.property_type ?? null,
        owner_name: prefill?.owner_name ?? fromLead.full_name ?? null,
        owner_phone: prefill?.owner_phone ?? fromLead.phone ?? null,
        owner_email: prefill?.owner_email ?? fromLead.email ?? null,
      }
    }

    const slug = await this.uniqueSlug()
    const link = FichaLink.create({
      id: this.ids.generate(),
      org_id: input.org_id,
      agent_id: ownerAgentId,
      mode: input.mode,
      slug,
      label: input.label ?? null,
      lead_id: leadId,
      prefill,
    })
    await this.repo.save(link)
    return { id: link.id, slug: link.slug, mode: link.mode, reused: false }
  }

  /**
   * 14 caracteres: el link es la única credencial del formulario, así que el
   * slug tiene que ser impracticable de adivinar (los de visita usan 10).
   */
  private async uniqueSlug(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const candidate = this.buildSlug()
      if (!(await this.repo.existsBySlug(candidate))) return candidate
    }
    throw new ValidationError('No se pudo generar un slug único')
  }

  private buildSlug(): string {
    const raw = (this.ids.generate() + this.ids.generate()).replace(/[^a-z0-9]/gi, '').toLowerCase()
    return raw.slice(0, 14).padEnd(14, '0')
  }
}
