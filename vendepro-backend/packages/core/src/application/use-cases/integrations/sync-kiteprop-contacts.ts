import type { OrgIntegrationRepository } from '../../ports/repositories/org-integration-repository'
import type { IntegrationLinkRepository } from '../../ports/repositories/integration-link-repository'
import type { IntegrationSyncLogRepository } from '../../ports/repositories/integration-sync-log-repository'
import type { ContactRepository } from '../../ports/repositories/contact-repository'
import type { UserRepository } from '../../ports/repositories/user-repository'
import type { KitepropGateway, KitepropContactDTO, KitepropMessageDTO, KitepropPropertyRef, KitepropContactAgent } from '../../ports/services/kiteprop-gateway'
import type { IdGenerator } from '../../ports/id-generator'
import { Contact } from '../../../domain/entities/contact'
import type { TokenDecryptor } from './test-kiteprop-connection'

export interface SyncKitepropContactsInput {
  orgId: string
  /**
   * - auto/manual: incremental message-driven desde last_sync_at.
   * - enrich: message-driven de TODO el histórico (sin corte por fecha), chunked;
   *   re-atribuye/enriquece los contactos ya importados.
   * - backfill: contact-driven (agenda base), sin enriquecer.
   */
  mode: 'auto' | 'manual' | 'enrich' | 'backfill'
  /** Tope de páginas por corrida (límite de subrequests de Workers). */
  maxPages?: number
}

export interface SyncKitepropContactsResult {
  ok: boolean
  created: number
  /** Contactos existentes enriquecidos con la consulta (message-driven). */
  enriched: number
  skipped: number
  pagesProcessed: number
  /** backfill: false si quedan páginas (la UI/el próximo cron retoma). */
  done: boolean
  nextPage?: number
  error?: string
}

const PROVIDER = 'kiteprop'
const PAGE_SIZE = 25
const NOTES_MAX = 1500

/** Normaliza un nombre para comparar agentes: minúsculas, sin acentos, trim. */
function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/**
 * Sincroniza KiteProp → VendéPro (solo contactos, no leads).
 *
 * - auto/manual: MESSAGE-DRIVEN. Recorre las consultas de portal (search_messages).
 *   Cada consulta enriquece al contacto con el agente real (mapeado por email),
 *   el portal de origen y el texto del mensaje + la propiedad consultada.
 * - backfill: CONTACT-DRIVEN. Recorre la agenda completa (search_contacts) para la
 *   carga histórica base; sin enriquecimiento por consulta.
 *
 * Idempotencia con integration_links en dos claves:
 * - external_id = "<id contacto>"  → mapping persona.
 * - external_id = "msg:<id mensaje>" → consulta ya procesada (no re-escribe).
 * Dedupe de personas: link de contacto + ContactRepository.findByEmailOrPhone.
 */
export class SyncKitepropContactsUseCase {
  constructor(
    private readonly integrationRepo: OrgIntegrationRepository,
    private readonly linkRepo: IntegrationLinkRepository,
    private readonly syncLogRepo: IntegrationSyncLogRepository,
    private readonly contactRepo: ContactRepository,
    private readonly userRepo: UserRepository,
    private readonly gateway: KitepropGateway,
    private readonly ids: IdGenerator,
    private readonly decryptKey: TokenDecryptor,
  ) {}

  // Caches por corrida (evitan repetir llamadas MCP/D1)
  private propCache = new Map<number, KitepropPropertyRef | null>()
  private contactAgentCache = new Map<string, KitepropContactAgent | null>() // contactId → agente asignado en KiteProp
  private agentCache = new Map<string, string | null>() // clave agente KiteProp → user.id VendéPro
  private orgUsers: Array<{ id: string; email: string; full_name: string }> | null = null
  private agentMap: Record<string, string> = {} // config: id agente KiteProp → id usuario VendéPro

  async execute(input: SyncKitepropContactsInput): Promise<SyncKitepropContactsResult> {
    const startedAt = new Date().toISOString()
    this.propCache.clear()
    this.contactAgentCache.clear()
    this.agentCache.clear()
    this.orgUsers = null

    const integration = await this.integrationRepo.findByOrgAndProvider(input.orgId, PROVIDER)
    if (!integration) return this.fail(input, null, startedAt, 'La integración KiteProp no está configurada')
    if (!integration.enabled) return this.fail(input, integration.id, startedAt, 'La integración KiteProp está deshabilitada')
    if (!integration.credentials_encrypted) return this.fail(input, integration.id, startedAt, 'No hay API key configurada')

    const apiKey = await this.decryptKey(integration.credentials_encrypted)
    if (!apiKey) return this.fail(input, integration.id, startedAt, 'No se pudo desencriptar la API key. Volvé a ingresarla.')

    const admin = await this.userRepo.findFirstAdminByOrg(input.orgId)
    if (!admin) return this.fail(input, integration.id, startedAt, 'Organización sin administrador configurado')

    const config = integration.getConfig()
    this.agentMap = (config.agent_map && typeof config.agent_map === 'object') ? (config.agent_map as Record<string, string>) : {}
    const maxPages = input.maxPages ?? (input.mode === 'backfill' ? 5 : 3)

    const acc: RunAcc = { created: 0, enriched: 0, skipped: 0, pagesProcessed: 0, done: false, page: 1, runError: null, itemError: null }

    if (input.mode === 'backfill') {
      acc.page = Number(config.backfill_next_page ?? 1) || 1
      await this.runBackfill(input.orgId, apiKey, admin.id, maxPages, acc)
    } else if (input.mode === 'enrich') {
      // Histórico de consultas, sin corte por fecha, reanudable por config.
      acc.page = Number(config.enrich_next_page ?? 1) || 1
      await this.runMessages(input.orgId, apiKey, admin.id, undefined, acc.page, maxPages, acc)
    } else {
      // Incremental: desde la fecha (día) del último sync; si nunca corrió, desde hoy.
      const dateFrom = (integration.last_sync_at ?? new Date().toISOString()).slice(0, 10)
      await this.runMessages(input.orgId, apiKey, admin.id, dateFrom, 1, maxPages, acc)
    }

    // Persistir estado
    if (input.mode === 'backfill') {
      integration.setConfig({ ...config, backfill_next_page: acc.done ? null : acc.page, backfill_done: acc.done })
    } else if (input.mode === 'enrich') {
      integration.setConfig({ ...config, enrich_next_page: acc.done ? null : acc.page, enrich_done: acc.done })
    } else if (acc.done && !acc.runError) {
      integration.update({ last_sync_at: new Date().toISOString() })
    }
    await this.integrationRepo.save(integration)

    const error = acc.runError ?? acc.itemError
    const status: 'ok' | 'partial' | 'error' =
      acc.runError && acc.pagesProcessed === 0 ? 'error' : (!acc.done || error ? 'partial' : 'ok')

    await this.writeLog(input, integration.id, startedAt, status, acc.created + acc.enriched, acc.skipped, error)

    return {
      ok: status !== 'error',
      created: acc.created,
      enriched: acc.enriched,
      skipped: acc.skipped,
      pagesProcessed: acc.pagesProcessed,
      done: acc.done,
      ...(acc.done ? {} : { nextPage: acc.page }),
      ...(error ? { error } : {}),
    }
  }

  // ─────────────────────────── MESSAGE-DRIVEN (auto/manual) ───────────────────────────

  private async runMessages(orgId: string, apiKey: string, adminId: string, dateFrom: string | undefined, startPage: number, maxPages: number, acc: RunAcc): Promise<void> {
    let page = startPage
    while (acc.pagesProcessed < maxPages) {
      let pageData
      try {
        pageData = await this.gateway.fetchMessages(apiKey, { page, limit: PAGE_SIZE })
      } catch (e) {
        acc.runError = e instanceof Error ? e.message : 'Error consultando KiteProp'
        break
      }

      // Marca de consultas ya procesadas (batch): external_id = "msg:<id>".
      const msgIds = pageData.data.map((m) => `msg:${m.external_id}`)
      let processed: Record<string, string> = {}
      try {
        processed = await this.linkRepo.findContactIds(orgId, PROVIDER, msgIds)
      } catch { /* best-effort */ }

      let reachedCutoff = false
      for (const msg of pageData.data) {
        // KiteProp ignora date_from; con id:desc cortamos al pasar la marca (solo incremental).
        if (dateFrom && msg.created_at.slice(0, 10) < dateFrom) { reachedCutoff = true; break }
        if (processed[`msg:${msg.external_id}`]) { acc.skipped++; continue }
        try {
          const outcome = await this.processMessage(orgId, apiKey, adminId, msg)
          if (outcome === 'created') acc.created++
          else if (outcome === 'enriched') acc.enriched++
          else acc.skipped++
        } catch (e) {
          acc.skipped++
          if (!acc.itemError) acc.itemError = e instanceof Error ? e.message : 'Error procesando consulta'
        }
      }

      acc.pagesProcessed++
      if (reachedCutoff || pageData.current_page >= pageData.last_page || pageData.data.length === 0) { acc.done = true; break }
      page++
    }
    acc.page = page
    if (!acc.runError && !acc.done && acc.pagesProcessed >= maxPages) acc.done = false
  }

  /** Crea o enriquece el contacto con los datos de una consulta de portal. */
  private async processMessage(orgId: string, apiKey: string, adminId: string, msg: KitepropMessageDTO): Promise<'created' | 'enriched' | 'skipped'> {
    const propRef = msg.property_id != null ? await this.getPropertyRefCached(apiKey, msg.property_id) : null
    const agentId = await this.resolveAgentForContact(orgId, apiKey, msg.contact.external_id, propRef)
    const line = this.enrichedNote(msg, propRef)
    const portal = msg.source || null

    // ¿La persona ya existe? Por link de contacto o por email/teléfono.
    const c = msg.contact
    let existingId = await this.safeFindContactId(orgId, c.external_id)
    if (!existingId && (c.email || c.phone)) {
      const found = await this.safeFindByEmailOrPhone(orgId, c.email, c.phone)
      if (found) existingId = found.id
    }

    if (existingId) {
      const existing = await this.contactRepo.findById(existingId, orgId)
      if (existing) {
        const o = existing.toObject()
        const enriched = Contact.create({
          ...o,
          // El portal real reemplaza el 'kiteprop' genérico; nunca lo borra si ya era un portal.
          source: portal ?? o.source,
          // Solo pisamos el agente si mapeamos uno real (no admin/fallback).
          agent_id: agentId ?? o.agent_id,
          notes: this.prependNote(o.notes, line),
        })
        await this.contactRepo.save(enriched)
      }
      await this.linkRepo.save(orgId, PROVIDER, c.external_id, existingId)
      await this.linkRepo.save(orgId, PROVIDER, `msg:${msg.external_id}`, existingId)
      return 'enriched'
    }

    // Contacto nuevo
    const contact = Contact.create({
      id: this.ids.generate(),
      org_id: orgId,
      full_name: c.full_name,
      phone: c.phone,
      email: c.email,
      contact_type: 'otro',
      neighborhood: null,
      notes: line,
      source: portal ?? PROVIDER,
      agent_id: agentId ?? adminId,
    })
    await this.contactRepo.save(contact)
    await this.linkRepo.save(orgId, PROVIDER, c.external_id, contact.id)
    await this.linkRepo.save(orgId, PROVIDER, `msg:${msg.external_id}`, contact.id)
    return 'created'
  }

  private enrichedNote(msg: KitepropMessageDTO, propRef: KitepropPropertyRef | null): string {
    const date = msg.created_at.slice(0, 10)
    const parts: string[] = ['vía KiteProp']
    if (msg.source) parts.push(this.portalLabel(msg.source))
    if (propRef && (propRef.code || propRef.title)) {
      const ref = [propRef.code, propRef.title].filter(Boolean).join(' — ')
      parts.push(`Consultó: ${ref}`)
    }
    if (msg.body) parts.push(`«${msg.body}»`)
    parts.push(date)
    return parts.join(' · ')
  }

  private prependNote(current: string | null, line: string): string {
    const combined = current ? `${line}\n${current}` : line
    return combined.length > NOTES_MAX ? combined.slice(0, NOTES_MAX) : combined
  }

  private portalLabel(slug: string): string {
    const map: Record<string, string> = {
      argenprop: 'Argenprop', zonaprop: 'Zonaprop', mercadolibre: 'MercadoLibre',
      buscainmueble: 'Buscainmueble', whatsapp_bot_instagram: 'Instagram',
    }
    return map[slug] ?? slug
  }

  // ─────────────────────────── Mapeo de agente ───────────────────────────

  /**
   * Resuelve el usuario de VendéPro para un contacto. Prioridad:
   * 1) agente ASIGNADO al contacto en KiteProp (get_contact.assigned_user)
   * 2) agente de la PROPIEDAD consultada (respaldo)
   * Cada candidato se resuelve por: agent_map (config) → email → nombre.
   * Devuelve null si nada matchea (el caller cae al admin).
   */
  private async resolveAgentForContact(orgId: string, apiKey: string, contactId: string, propRef: KitepropPropertyRef | null): Promise<string | null> {
    const assigned = await this.getContactAgentCached(apiKey, contactId)
    const candidates: Array<{ external_id: string | null; email: string | null; name: string | null }> = []
    if (assigned) candidates.push({ external_id: assigned.external_id, email: assigned.email, name: assigned.name })
    if (propRef) candidates.push({ external_id: null, email: propRef.agent_email, name: propRef.agent_name })

    for (const cand of candidates) {
      const userId = await this.resolveAgent(orgId, cand.external_id, cand.email, cand.name)
      if (userId) return userId
    }
    return null
  }

  /** Resuelve un agente de KiteProp a un usuario de VendéPro: agent_map → email → nombre → null. */
  private async resolveAgent(orgId: string, kitepropId: string | null, email: string | null, name: string | null): Promise<string | null> {
    const key = (kitepropId ?? email ?? name ?? '').toLowerCase().trim()
    if (!key) return null
    if (this.agentCache.has(key)) return this.agentCache.get(key)!

    let userId: string | null = null
    // 1) Mapeo explícito por id de agente KiteProp (configurable en la UI).
    if (kitepropId && this.agentMap[kitepropId]) {
      userId = this.agentMap[kitepropId]
    }
    // 2) Match por email.
    if (!userId && email) {
      try {
        const u = await this.userRepo.findByEmail(email)
        if (u) userId = u.id
      } catch { /* sigue con fallback */ }
    }
    // 3) Match por nombre.
    if (!userId && name) {
      const users = await this.getOrgUsers(orgId)
      const target = normalizeName(name)
      const match = users.find((u) => normalizeName(u.full_name) === target)
      if (match) userId = match.id
    }
    this.agentCache.set(key, userId)
    return userId
  }

  private async getContactAgentCached(apiKey: string, contactId: string): Promise<KitepropContactAgent | null> {
    if (this.contactAgentCache.has(contactId)) return this.contactAgentCache.get(contactId)!
    let agent: KitepropContactAgent | null = null
    try {
      agent = await this.gateway.getContactAgent(apiKey, contactId)
    } catch { agent = null }
    this.contactAgentCache.set(contactId, agent)
    return agent
  }

  private async getOrgUsers(orgId: string): Promise<Array<{ id: string; email: string; full_name: string }>> {
    if (this.orgUsers) return this.orgUsers
    try {
      const users = await this.userRepo.findByOrg(orgId)
      this.orgUsers = users.map((u) => ({ id: u.id, email: u.email, full_name: u.full_name }))
    } catch {
      this.orgUsers = []
    }
    return this.orgUsers
  }

  private async getPropertyRefCached(apiKey: string, propertyId: number): Promise<KitepropPropertyRef | null> {
    if (this.propCache.has(propertyId)) return this.propCache.get(propertyId)!
    let ref: KitepropPropertyRef | null = null
    try {
      ref = await this.gateway.getPropertyRef(apiKey, propertyId)
    } catch { ref = null }
    this.propCache.set(propertyId, ref)
    return ref
  }

  private async safeFindContactId(orgId: string, externalId: string): Promise<string | null> {
    try { return await this.linkRepo.findContactId(orgId, PROVIDER, externalId) } catch { return null }
  }

  private async safeFindByEmailOrPhone(orgId: string, email: string | null, phone: string | null) {
    try { return await this.contactRepo.findByEmailOrPhone(orgId, email, phone) } catch { return null }
  }

  // ─────────────────────────── CONTACT-DRIVEN (backfill) ───────────────────────────

  private async runBackfill(orgId: string, apiKey: string, adminId: string, maxPages: number, acc: RunAcc): Promise<void> {
    let page = acc.page
    while (acc.pagesProcessed < maxPages) {
      let pageData
      try {
        pageData = await this.gateway.fetchContacts(apiKey, { page, limit: PAGE_SIZE })
      } catch (e) {
        acc.runError = e instanceof Error ? e.message : 'Error consultando KiteProp'
        break
      }

      const externalIds = pageData.data.map((c) => c.external_id)
      let linked: Record<string, string> = {}
      try { linked = await this.linkRepo.findContactIds(orgId, PROVIDER, externalIds) } catch { /* best-effort */ }

      for (const dto of pageData.data) {
        if (linked[dto.external_id]) { acc.skipped++; continue }
        try {
          const result = await this.importContact(orgId, adminId, dto)
          if (result === 'created') acc.created++
          else acc.skipped++
        } catch (e) {
          acc.skipped++
          if (!acc.itemError) acc.itemError = e instanceof Error ? e.message : 'Error importando contacto'
        }
      }

      acc.pagesProcessed++
      if (pageData.current_page >= pageData.last_page || pageData.data.length === 0) { acc.done = true; break }
      page++
    }
    acc.page = page
    if (!acc.runError && !acc.done && acc.pagesProcessed >= maxPages) acc.done = false
  }

  /** Alta base de un contacto (backfill): sin enriquecimiento por consulta. */
  private async importContact(orgId: string, adminId: string, dto: KitepropContactDTO): Promise<'created' | 'linked'> {
    const existing = await this.safeFindByEmailOrPhone(orgId, dto.email, dto.phone)
    if (existing) {
      await this.linkRepo.save(orgId, PROVIDER, dto.external_id, existing.id)
      return 'linked'
    }

    const notesParts: string[] = ['Importado de KiteProp']
    if (dto.source) notesParts.push(`Origen: ${dto.source}`)
    if (dto.category) notesParts.push(`Categoría: ${dto.category}`)
    if (dto.tags.length > 0) notesParts.push(`Tags: ${dto.tags.join(', ')}`)

    const contact = Contact.create({
      id: this.ids.generate(),
      org_id: orgId,
      full_name: dto.full_name,
      phone: dto.phone,
      email: dto.email,
      contact_type: 'otro',
      neighborhood: null,
      notes: notesParts.join(' · '),
      source: dto.source ?? PROVIDER,
      agent_id: adminId,
    })
    await this.contactRepo.save(contact)
    await this.linkRepo.save(orgId, PROVIDER, dto.external_id, contact.id)
    return 'created'
  }

  // ─────────────────────────── shared ───────────────────────────

  private async fail(input: SyncKitepropContactsInput, integrationId: string | null, startedAt: string, error: string): Promise<SyncKitepropContactsResult> {
    if (integrationId) await this.writeLog(input, integrationId, startedAt, 'error', 0, 0, error)
    return { ok: false, created: 0, enriched: 0, skipped: 0, pagesProcessed: 0, done: false, error }
  }

  private async writeLog(input: SyncKitepropContactsInput, integrationId: string, startedAt: string, status: 'ok' | 'partial' | 'error', created: number, skipped: number, error: string | null): Promise<void> {
    try {
      await this.syncLogRepo.save({
        id: this.ids.generate(),
        org_id: input.orgId,
        integration_id: integrationId,
        kind: input.mode,
        status,
        contacts_created: created,
        contacts_skipped: skipped,
        error,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      })
    } catch { /* el log nunca voltea el sync */ }
  }
}

interface RunAcc {
  created: number
  enriched: number
  skipped: number
  pagesProcessed: number
  done: boolean
  page: number
  runError: string | null
  itemError: string | null
}
