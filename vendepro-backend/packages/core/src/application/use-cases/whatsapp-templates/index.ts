import type { WhatsAppTemplateRepository } from '../../ports/repositories/whatsapp-template-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { WhatsAppTemplate, type WhatsAppTemplateProps } from '../../../domain/entities/whatsapp-template'

export class ListWhatsAppTemplatesUseCase {
  constructor(private readonly repo: WhatsAppTemplateRepository) {}

  /** `onlyActive` para los selectores; el ABM de configuración los quiere todos. */
  async execute(orgId: string, opts?: { onlyActive?: boolean }): Promise<WhatsAppTemplateProps[]> {
    const templates = await this.repo.findByOrg(orgId, opts)
    return templates.map(t => t.toObject())
  }
}

export interface SaveWhatsAppTemplateInput {
  id?: string
  org_id: string
  user_id?: string | null
  name: string
  body: string
  sort_order?: number
  is_active?: boolean
}

export class SaveWhatsAppTemplateUseCase {
  constructor(
    private readonly repo: WhatsAppTemplateRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: SaveWhatsAppTemplateInput): Promise<WhatsAppTemplateProps> {
    // Editar sólo puede tocar plantillas de la propia org: si el id no existe
    // ahí, es un 404 y no un alta silenciosa con id ajeno.
    const existing = input.id ? await this.repo.findById(input.id, input.org_id) : null
    if (input.id && !existing) throw new Error('Mensaje no encontrado')

    const template = WhatsAppTemplate.create({
      id: existing?.id ?? this.ids.generate(),
      org_id: input.org_id,
      name: input.name,
      body: input.body,
      sort_order: input.sort_order ?? existing?.sort_order ?? 0,
      is_active: (input.is_active ?? (existing ? existing.is_active === 1 : true)) ? 1 : 0,
      created_by: existing?.created_by ?? input.user_id ?? null,
      created_at: existing?.created_at,
      updated_at: new Date().toISOString(),
    })
    await this.repo.save(template)
    return template.toObject()
  }
}

export class DeleteWhatsAppTemplateUseCase {
  constructor(private readonly repo: WhatsAppTemplateRepository) {}

  async execute(id: string, orgId: string): Promise<void> {
    await this.repo.delete(id, orgId)
  }
}
