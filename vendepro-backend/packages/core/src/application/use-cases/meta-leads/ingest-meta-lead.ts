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
  /** Dueño de los leads de Meta (quien conectó la página). Sin él, o si ya no está activo, el primer admin. */
  ownerId?: string | null
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

/**
 * Qué pregunta del formulario es el nombre, el teléfono o el email.
 *
 * Las preguntas estándar de Meta llegan con clave en inglés (`full_name`,
 * `phone_number`), pero muchos formularios usan preguntas propias en castellano
 * (`nombre`, `número_de_teléfono`). Se comparan normalizadas: sin tildes, en
 * minúscula y con `_` en lugar de espacios y signos.
 */
const NOMBRE_COMPLETO = new Set(['full_name', 'nombre_completo', 'nombre_y_apellido', 'nombre_y_apellidos', 'nombre_apellido'])
const NOMBRE = new Set(['first_name', 'nombre', 'name'])
const APELLIDO = new Set(['last_name', 'apellido', 'apellidos'])
const ES_TELEFONO = /phone|telefono|celular|whatsapp|movil/
const ES_EMAIL = /email|correo/

function normalizarClave(clave: string): string {
  return clave
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

interface CamposConocidos {
  nombreCompleto?: string
  nombre?: string
  apellido?: string
  telefono?: string
  email?: string
  /** Lo que no es nombre/teléfono/email: va a las notas, con la clave original. */
  resto: Array<[string, string]>
}

function clasificar(campos: Map<string, string>): CamposConocidos {
  const out: CamposConocidos = { resto: [] }
  for (const [clave, valor] of campos) {
    const k = normalizarClave(clave)
    if (NOMBRE_COMPLETO.has(k) && !out.nombreCompleto) out.nombreCompleto = valor
    else if (NOMBRE.has(k) && !out.nombre) out.nombre = valor
    else if (APELLIDO.has(k) && !out.apellido) out.apellido = valor
    else if (ES_EMAIL.test(k) && !out.email) out.email = valor
    else if (ES_TELEFONO.test(k) && !out.telefono) out.telefono = valor
    else out.resto.push([clave, valor])
  }
  return out
}

/**
 * Da de alta en el CRM un lead que llegó por un formulario de Meta Lead Ads.
 *
 * - **Dedup por el ID de Meta**: el webhook se reintenta y no puede entrar dos veces.
 * - **Dueño = quien conectó la página** (o el primer admin si no hay o ya no
 *   está activo): el reparto es manual, nadie lo asigna solo.
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

    const admin = await this.duenio(input.orgId, input.ownerId ?? null)
    if (!admin) throw new ValidationError('Organización sin administrador configurado')

    const campos = clasificar(aplanarCampos(data))
    const fullName = nombreDe(campos, data)
    const email = campos.email ?? null
    const phone = campos.telefono ?? null
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

  private async duenio(orgId: string, ownerId: string | null) {
    if (ownerId) {
      const owner = await this.userRepo.findById(ownerId, orgId).catch(() => null)
      if (owner && owner.active !== 0) return owner
    }
    return this.userRepo.findFirstAdminByOrg(orgId)
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

function nombreDe(campos: CamposConocidos, data: MetaLeadData): string {
  const completo = campos.nombreCompleto
    ?? [campos.nombre, campos.apellido].filter(Boolean).join(' ')
  // Un formulario sin pregunta de nombre es válido en Meta; el lead igual tiene
  // que poder entrar (Lead exige al menos 2 caracteres).
  if (completo && completo.trim().length >= 2) return completo.trim()
  return data.platform === 'ig' ? 'Lead de Instagram' : 'Lead de Facebook'
}

function notasDe(campos: CamposConocidos, data: MetaLeadData): string | null {
  const lineas = campos.resto.map(([clave, valor]) => `${clave.replace(/_/g, ' ')}: ${valor}`)
  const origen = [data.campaign_name && `campaña "${data.campaign_name}"`, data.ad_name && `anuncio "${data.ad_name}"`]
    .filter(Boolean)
    .join(', ')
  const encabezado = `Formulario de Meta${origen ? ` (${origen})` : ''}`
  return lineas.length > 0 ? `${encabezado}\n${lineas.join('\n')}` : encabezado
}
