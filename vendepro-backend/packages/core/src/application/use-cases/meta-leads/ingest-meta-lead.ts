import type { UserRepository } from '../../ports/repositories/user-repository'
import type { ContactRepository } from '../../ports/repositories/contact-repository'
import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { IdGenerator } from '../../ports/id-generator'
import type { MetaLeadAdsGateway, MetaLeadData } from '../../ports/services/meta-lead-ads-gateway'
import { ValidationError } from '../../../domain/errors/validation-error'
import { CreateLeadWithContactUseCase } from '../leads/create-lead-with-contact'

export interface IngestMetaLeadInput {
  orgId: string
  /** `leadgen_id` del webhook de Meta. */
  leadgenId: string
  pageAccessToken: string
}

export type IngestMetaLeadResult =
  | { duplicate: true; lead_id: string }
  | {
      duplicate: false
      lead_id: string
      contact_id: string
      assigned_to: string
      full_name: string
      email: string | null
      phone: string | null
      source: 'facebook' | 'instagram'
      source_detail: string | null
      notes: string | null
    }

/** Claves estándar de Meta que van a columnas propias, no a las notas. */
const CAMPOS_PROPIOS = new Set(['full_name', 'first_name', 'last_name', 'email', 'phone_number', 'phone'])

/**
 * Da de alta en el CRM un lead que llegó por un formulario de Meta Lead Ads.
 *
 * - **Dedup por el ID de Meta**: el webhook se reintenta y no puede entrar dos veces.
 * - **Dueño = el admin de la org**, igual que los leads públicos: el reparto
 *   es manual, nadie lo asigna solo.
 * - `source_detail` = nombre de la campaña, que es la clave con la que el panel
 *   de Marketing cruza gasto y leads.
 * - Las preguntas propias del formulario quedan en las notas.
 */
export class IngestMetaLeadUseCase {
  constructor(
    private readonly gateway: MetaLeadAdsGateway,
    private readonly leadRepo: LeadRepository,
    private readonly contactRepo: ContactRepository,
    private readonly userRepo: UserRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: IngestMetaLeadInput): Promise<IngestMetaLeadResult> {
    const existente = await this.leadRepo.findByMetaLeadId(input.leadgenId, input.orgId)
    if (existente) return { duplicate: true, lead_id: existente.id }

    const data = await this.gateway.fetchLead(input.leadgenId, input.pageAccessToken)

    const admin = await this.userRepo.findFirstAdminByOrg(input.orgId)
    if (!admin) throw new ValidationError('Organización sin administrador configurado')

    const campos = aplanarCampos(data)
    const fullName = nombreDe(campos, data)
    const email = campos.get('email') ?? null
    const phone = campos.get('phone_number') ?? campos.get('phone') ?? null
    const source = data.platform === 'ig' ? 'instagram' : 'facebook'
    const sourceDetail = data.campaign_name?.trim() || null
    const notes = notasDe(campos, data)

    const result = await new CreateLeadWithContactUseCase(this.leadRepo, this.contactRepo, this.ids).execute({
      org_id: input.orgId,
      assigned_to: admin.id,
      full_name: fullName,
      phone,
      email,
      source,
      source_detail: sourceDetail,
      operation: 'otro',
      notes,
      meta_lead_id: data.id || input.leadgenId,
      contact_data: {
        full_name: fullName,
        phone,
        email,
        agent_id: admin.id,
        contact_type: 'otro',
        source,
      },
    })

    return {
      duplicate: false,
      lead_id: result.id,
      contact_id: result.contact_id,
      assigned_to: admin.id,
      full_name: fullName,
      email,
      phone,
      source,
      source_detail: sourceDetail,
      notes,
    }
  }
}

function aplanarCampos(data: MetaLeadData): Map<string, string> {
  const campos = new Map<string, string>()
  for (const f of data.field_data ?? []) {
    const valor = (f.values ?? []).map(v => String(v).trim()).filter(Boolean).join(', ')
    if (f.name && valor) campos.set(f.name, valor)
  }
  return campos
}

function nombreDe(campos: Map<string, string>, data: MetaLeadData): string {
  const completo = campos.get('full_name')
    ?? [campos.get('first_name'), campos.get('last_name')].filter(Boolean).join(' ')
  // Un formulario sin pregunta de nombre es válido en Meta; el lead igual tiene
  // que poder entrar (Lead exige al menos 2 caracteres).
  if (completo && completo.trim().length >= 2) return completo.trim()
  return data.platform === 'ig' ? 'Lead de Instagram' : 'Lead de Facebook'
}

function notasDe(campos: Map<string, string>, data: MetaLeadData): string | null {
  const lineas: string[] = []
  for (const [clave, valor] of campos) {
    if (CAMPOS_PROPIOS.has(clave)) continue
    lineas.push(`${clave.replace(/_/g, ' ')}: ${valor}`)
  }
  const origen = [data.campaign_name && `campaña "${data.campaign_name}"`, data.ad_name && `anuncio "${data.ad_name}"`]
    .filter(Boolean)
    .join(', ')
  const encabezado = `Formulario de Meta${origen ? ` (${origen})` : ''}`
  return lineas.length > 0 ? `${encabezado}\n${lineas.join('\n')}` : encabezado
}
