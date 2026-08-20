import type { FichaLinkRepository } from '../../ports/repositories/ficha-link-repository'
import type { FichaRepository } from '../../ports/repositories/ficha-repository'
import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { ContactRepository } from '../../ports/repositories/contact-repository'
import type { UserRepository } from '../../ports/repositories/user-repository'
import type { AppraisalRepository } from '../../ports/repositories/appraisal-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { CreateFichaUseCase } from '../fichas/create-ficha'
import { CreateLeadUseCase } from '../leads/create-lead'
import { CreateContactUseCase } from '../contacts/create-contact'
import { CreateAppraisalUseCase } from '../appraisals/create-appraisal'
import { NotFoundError } from '../../../domain/errors/not-found'
import { ValidationError } from '../../../domain/errors/validation-error'

/**
 * Payload crudo del formulario público. Todo llega como string o null porque
 * viene de inputs de un celular: la coerción se hace acá, no en el navegador.
 */
export interface SubmitPublicFichaInput {
  slug: string
  owner_name: string
  owner_phone: string
  owner_email?: string | null
  address: string
  neighborhood?: string | null
  property_type?: string | null
  floor_number?: string | null
  unit?: string | null
  rooms?: string | number | null
  bathrooms?: string | number | null
  covered_area?: string | number | null
  kitchen_type?: string | null
  furnished?: string | null
  age?: string | null
  light_level?: string | null
  balcony_type?: string[] | string | null
  parking_type?: string | null
  storage_rooms?: string | number | null
  pets_allowed?: string | null
  is_professional?: string | null
  amenities?: string[] | string | null
  heating_type?: string[] | string | null
  expenses?: string | number | null
  notes?: string | null
  // ── Superficies desglosadas: el propietario declara las partes ──
  semi_area?: string | number | null
  uncovered_area?: string | number | null
  // ── Preguntas por tipo de propiedad ──
  /** 'venta' | 'alquiler' | 'ambas' */
  operation?: string | null
  land_area?: string | number | null
  frontage_m?: string | number | null
  depth_m?: string | number | null
  property_condition?: string | null
  zoning?: string | null
  utilities?: string[] | string | null
  floors_count?: string | number | null
  commercial_use?: string | null
  has_warehouse?: string | null
  /** UF o número de la cochera y de la baulera. */
  parking_unit?: string | null
  storage_unit?: string | null
}

export interface SubmitPublicFichaResult {
  success: true
  ficha_id: string
  lead_id: string
  contact_id: string
  appraisal_id: string
  org_id: string
  agent_id: string
}

/**
 * Recibe la Ficha de Tasación que completó el propietario en /f/<slug> y la
 * convierte en trabajo cargado: contacto + lead + ficha + tasación en borrador.
 *
 * Dedup: se reutiliza el contacto si ya existe uno con el mismo teléfono o
 * mail en la org. El lead se crea siempre nuevo — un propietario puede tener
 * dos propiedades, y fusionar por dirección a ciegas escondería la segunda.
 * Un link 'single' sólo acepta un envío, así que ahí no hay duplicado posible.
 */
export class SubmitPublicFichaUseCase {
  constructor(
    private readonly linkRepo: FichaLinkRepository,
    private readonly fichaRepo: FichaRepository,
    private readonly leadRepo: LeadRepository,
    private readonly contactRepo: ContactRepository,
    private readonly userRepo: UserRepository,
    private readonly appraisalRepo: AppraisalRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: SubmitPublicFichaInput): Promise<SubmitPublicFichaResult> {
    const link = await this.linkRepo.findBySlug(input.slug)
    if (!link) throw new NotFoundError('FichaLink', input.slug)
    if (!link.acceptsSubmissions()) {
      throw new ValidationError('Este formulario ya no está disponible')
    }

    const ownerName = (input.owner_name ?? '').trim()
    const address = (input.address ?? '').trim()
    if (!ownerName) throw new ValidationError('Necesitamos tu nombre')
    if (!address) throw new ValidationError('Necesitamos la dirección de la propiedad')

    const phone = nonEmpty(input.owner_phone)
    const email = nonEmpty(input.owner_email)
    if (!phone && !email) {
      throw new ValidationError('Necesitamos un teléfono o un email para contactarte')
    }

    const orgId = link.org_id

    // Link institucional (agent_id NULL): el trabajo cae en el admin de la org.
    let agentId = link.agent_id
    if (!agentId) {
      const admin = await this.userRepo.findFirstAdminByOrg(orgId)
      if (!admin) throw new ValidationError('Organización sin administrador configurado')
      agentId = admin.id
    }

    const neighborhood = nonEmpty(input.neighborhood)
    const propertyType = nonEmpty(input.property_type) ?? 'departamento'
    // El propietario elige vender, alquilar o las dos; el lead hereda esa
    // intención, que es lo que define qué tasación se prepara.
    const operation = nonEmpty(input.operation) ?? 'venta'

    // ── Contacto: se reutiliza si ya está en la base ──────────────
    const existingContact = await this.contactRepo.findByEmailOrPhone(orgId, email, phone)
    let contactId: string
    if (existingContact) {
      contactId = existingContact.id
    } else {
      const created = await new CreateContactUseCase(this.contactRepo, this.ids).execute({
        org_id: orgId,
        full_name: ownerName,
        phone,
        email,
        contact_type: 'propietario',
        neighborhood,
        source: 'ficha_web',
        agent_id: agentId,
      })
      contactId = created.id
    }

    // ── Lead ──────────────────────────────────────────────────────
    // Un link dirigido ya nació de un lead: se le cuelga la ficha en vez de
    // duplicarlo. El abierto siempre abre uno nuevo.
    let leadId = link.mode === 'single' ? link.lead_id : null
    if (leadId) {
      const existingLead = await this.leadRepo.findById(leadId, orgId)
      if (!existingLead) leadId = null
    }
    if (!leadId) {
      const created = await new CreateLeadUseCase(this.leadRepo, this.ids).execute({
        org_id: orgId,
        pipeline: 'vendedor',
        full_name: ownerName,
        phone,
        email,
        source: 'ficha_web',
        source_detail: nonEmpty(link.label) ?? 'Ficha de tasación web',
        property_address: address,
        neighborhood,
        property_type: propertyType,
        operation,
        assigned_to: agentId,
        notes: nonEmpty(input.notes),
        contact_id: contactId,
      })
      leadId = created.id
    }

    // ── Ficha ─────────────────────────────────────────────────────
    const coveredArea = toNumber(input.covered_area)
    const now = new Date().toISOString()

    // `is_professional` es 0/1 en la tabla, pero el propietario puede contestar
    // "hay que consultar el reglamento". Se guarda como 0 y el matiz baja a las
    // observaciones para que el tasador no lo lea como un "no" cerrado.
    const professionalNote =
      input.is_professional === 'consultar'
        ? 'Apto profesional: hay que consultar el reglamento.'
        : null
    const notes = [nonEmpty(input.notes), professionalNote].filter(Boolean).join('\n') || null
    const ficha = await new CreateFichaUseCase(this.fichaRepo, this.ids).execute({
      org_id: orgId,
      agent_id: agentId,
      lead_id: leadId,
      ficha_link_id: link.id,
      filled_by: 'propietario',
      submitted_at: now,
      owner_name: ownerName,
      owner_phone: phone,
      owner_email: email,
      address,
      neighborhood,
      property_type: propertyType,
      floor_number: nonEmpty(input.floor_number),
      unit: nonEmpty(input.unit),
      rooms: toNumber(input.rooms),
      bathrooms: toNumber(input.bathrooms),
      covered_area: coveredArea,
      kitchen_type: nonEmpty(input.kitchen_type),
      furnished: nonEmpty(input.furnished),
      age: nonEmpty(input.age),
      light_level: nonEmpty(input.light_level),
      balcony_type: normalizeMulti(input.balcony_type),
      parking_type: nonEmpty(input.parking_type),
      storage_rooms: toNumber(input.storage_rooms),
      pets_allowed: nonEmpty(input.pets_allowed),
      is_professional: input.is_professional === 'si' ? 1 : 0,
      amenities: normalizeMulti(input.amenities),
      heating_type: normalizeMulti(input.heating_type),
      expenses: toNumber(input.expenses),
      semi_area: toNumber(input.semi_area),
      uncovered_area: toNumber(input.uncovered_area),
      operation,
      land_area: toNumber(input.land_area),
      frontage_m: toNumber(input.frontage_m),
      depth_m: toNumber(input.depth_m),
      property_condition: nonEmpty(input.property_condition),
      zoning: nonEmpty(input.zoning),
      utilities: normalizeMulti(input.utilities),
      floors_count: toNumber(input.floors_count),
      commercial_use: nonEmpty(input.commercial_use),
      has_warehouse: nonEmpty(input.has_warehouse),
      parking_unit: nonEmpty(input.parking_unit),
      storage_unit: nonEmpty(input.storage_unit),
      notes,
    })

    // ── Tasación en borrador ──────────────────────────────────────
    // Nace vacía de precios a propósito: los metros los declaró el propietario
    // y el valor lo pone el tasador. Sirve para que el trabajo ya exista.
    //
    // La superficie total: en un terreno es la del lote; en lo construido, la
    // suma de las tres partes que declaró el dueño. Queda como dato de partida
    // para la ponderación, que el tasador recalcula al medir.
    const semiArea = toNumber(input.semi_area)
    const uncoveredArea = toNumber(input.uncovered_area)
    const landArea = toNumber(input.land_area)
    const builtTotal = [coveredArea, semiArea, uncoveredArea]
      .filter((n): n is number => n !== null)
      .reduce((a, b) => a + b, 0)
    const totalArea =
      propertyType === 'terreno' ? landArea : builtTotal > 0 ? builtTotal : null

    const appraisal = await new CreateAppraisalUseCase(this.appraisalRepo, this.ids).execute({
      org_id: orgId,
      agent_id: agentId,
      property_address: address,
      neighborhood: neighborhood ?? 'Sin barrio',
      property_type: propertyType,
      covered_area: coveredArea,
      semi_area: semiArea,
      total_area: totalArea,
      lead_id: leadId,
    })

    await this.fichaRepo.update(ficha.id, orgId, { appraisal_id: appraisal.id })
    await this.linkRepo.registerSubmission(link.id)

    return {
      success: true,
      ficha_id: ficha.id,
      lead_id: leadId,
      contact_id: contactId,
      appraisal_id: appraisal.id,
      org_id: orgId,
      agent_id: agentId,
    }
  }
}

function nonEmpty(v: string | null | undefined): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length > 0 ? t : null
}

/** Los inputs numéricos del celular llegan como string; "" no es 0. */
function toNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Campos multivalor (amenities, servicios del terreno). Se guardan como texto
 * separado por comas para no romper las fichas que ya cargó el agente a mano.
 */
function normalizeMulti(v: string[] | string | null | undefined): string | null {
  if (Array.isArray(v)) {
    const clean = v.map((x) => String(x).trim()).filter(Boolean)
    return clean.length > 0 ? clean.join(', ') : null
  }
  return nonEmpty(v as string)
}
