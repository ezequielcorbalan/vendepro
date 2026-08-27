import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { ContactRepository } from '../../ports/repositories/contact-repository'
import type { PropertyRepository } from '../../ports/repositories/property-repository'
import type { UserRepository } from '../../ports/repositories/user-repository'
import type { OrganizationRepository } from '../../ports/repositories/organization-repository'
import type { AutomationContext } from '../../../domain/rules/automation-conditions'
import type { EntityType } from '../../../domain/value-objects/automation-catalog'

export interface BuildAutomationContextInput {
  orgId: string
  entityType: EntityType
  entityId: string
  /** Cambio de etapa, si el evento es uno. */
  stage?: { from?: string | null; to?: string | null }
  /** Base pública del frontend, para armar los links de los reportes. */
  publicBaseUrl?: string
  now?: Date
}

/**
 * Arma el contexto que ven las condiciones y las variables `{{...}}`.
 *
 * Se ejecuta una sola vez por evento, aunque haya varias automatizaciones
 * escuchándolo, y el resultado se congela dentro de cada job.
 *
 * Ninguna consulta puede tumbar el flujo de negocio: si un repositorio falla
 * o la entidad no existe, ese scope queda vacío y las variables renderizan en
 * blanco. Es preferible un mail con un hueco a un lead que no se crea.
 */
export class BuildAutomationContextUseCase {
  constructor(
    private readonly leads: LeadRepository,
    private readonly contacts: ContactRepository,
    private readonly properties: PropertyRepository,
    private readonly users: UserRepository,
    private readonly orgs: OrganizationRepository,
  ) {}

  async execute(input: BuildAutomationContextInput): Promise<AutomationContext> {
    const now = input.now ?? new Date()
    const context: AutomationContext = {
      now: {
        date: formatDateAr(now),
        iso: now.toISOString(),
      },
      stage: { from: input.stage?.from ?? null, to: input.stage?.to ?? null },
    }

    // Agente responsable — se resuelve desde la entidad que traiga el evento.
    let agentId: string | null = null
    let contactId: string | null = null

    if (input.entityType === 'lead') {
      const lead = await safe(() => this.leads.findById(input.entityId, input.orgId))
      if (lead) {
        context.lead = {
          id: lead.id,
          full_name: lead.full_name,
          email: lead.email,
          phone: lead.phone,
          stage: lead.stage,
          source: (lead as any).source ?? null,
          source_detail: (lead as any).source_detail ?? null,
          operation: (lead as any).operation ?? null,
          estimated_value: (lead as any).estimated_value ?? null,
          assigned_to: lead.assigned_to,
          created_at: lead.created_at,
        }
        agentId = lead.assigned_to
        contactId = (lead as any).contact_id ?? null
      }
    }

    if (input.entityType === 'contact') contactId = input.entityId

    if (contactId) {
      const contact = await safe(() => this.contacts.findById(contactId!, input.orgId))
      if (contact) {
        context.contact = {
          id: contact.id,
          full_name: contact.full_name,
          email: contact.email,
          phone: contact.phone,
          contact_type: contact.contact_type,
          source: contact.source,
          neighborhood: contact.neighborhood,
        }
        agentId = agentId ?? contact.agent_id
      }
    }

    if (input.entityType === 'property') {
      const property = await safe(() => this.properties.findById(input.entityId, input.orgId))
      if (property) {
        context.property = {
          id: property.id,
          title: propertyTitle(property),
          address: property.address,
          neighborhood: property.neighborhood,
          city: property.city,
          property_type: property.property_type,
          rooms: property.rooms,
          size_m2: property.size_m2,
          price: formatMoney(property.asking_price, property.currency),
          asking_price: property.asking_price,
          currency: property.currency,
          stage: property.commercial_stage,
          status: property.status,
          operation: property.operation_type,
          owner_name: property.owner_name,
          owner_email: property.owner_email,
          public_url: property.public_slug && input.publicBaseUrl
            ? `${trimSlash(input.publicBaseUrl)}/r/${property.public_slug}`
            : null,
        }
        agentId = agentId ?? property.agent_id
        // Una propiedad sin contacto propio igual necesita destinatario: el
        // propietario cargado a mano sirve como contacto del evento.
        if (!context.contact && property.owner_email) {
          context.contact = {
            id: property.contact_id ?? null,
            full_name: property.owner_name,
            email: property.owner_email,
            phone: property.owner_phone,
          }
        }
      }
    }

    if (agentId) {
      const agent = await safe(() => this.users.findById(agentId!, input.orgId))
      if (agent) {
        context.agent = {
          id: agent.id,
          full_name: agent.full_name,
          email: agent.email,
          phone: agent.phone,
          role: agent.role,
        }
      }
    }

    const org = await safe(() => this.orgs.findById(input.orgId))
    context.org = {
      id: input.orgId,
      name: org?.name ?? null,
      logo_url: org?.logo_url ?? null,
      brand_color: org?.brand_color ?? null,
    }

    return context
  }
}

/** Ninguna carga de contexto puede romper el request que la disparó. */
async function safe<T>(fn: () => Promise<T | null>): Promise<T | null> {
  try {
    return await fn()
  } catch (err) {
    console.error('[automations] context load failed (swallowed):', (err as Error)?.message ?? err)
    return null
  }
}

function propertyTitle(property: {
  property_type: string | null
  rooms: number | null
  neighborhood: string | null
  address: string | null
}): string {
  const parts = [
    property.property_type,
    property.rooms ? `${property.rooms} amb` : null,
    property.neighborhood ? `en ${property.neighborhood}` : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : (property.address ?? 'Propiedad')
}

function formatMoney(amount: number | null, currency: string | null): string | null {
  if (amount === null || amount === undefined) return null
  return `${currency ?? 'USD'} ${amount.toLocaleString('es-AR')}`
}

/** Argentina es UTC-3 y no tiene horario de verano. */
function formatDateAr(d: Date): string {
  const local = new Date(d.getTime() - 3 * 60 * 60_000)
  const day = String(local.getUTCDate()).padStart(2, '0')
  const month = String(local.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${local.getUTCFullYear()}`
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '')
}
