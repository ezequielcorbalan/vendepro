import type { OrgIntegrationRepository } from '../../ports/repositories/org-integration-repository'
import type { IntegrationLinkRepository } from '../../ports/repositories/integration-link-repository'
import type { IntegrationSyncLogRepository } from '../../ports/repositories/integration-sync-log-repository'
import type { ContactRepository } from '../../ports/repositories/contact-repository'
import type { UserRepository } from '../../ports/repositories/user-repository'
import type { KitepropGateway, KitepropContactDTO } from '../../ports/services/kiteprop-gateway'
import type { IdGenerator } from '../../ports/id-generator'
import { Contact } from '../../../domain/entities/contact'
import type { TokenDecryptor } from './test-kiteprop-connection'

export interface SyncKitepropContactsInput {
  orgId: string
  mode: 'auto' | 'manual' | 'backfill'
  /** Tope de páginas por corrida (límite de subrequests de Workers). */
  maxPages?: number
}

export interface SyncKitepropContactsResult {
  ok: boolean
  created: number
  skipped: number
  pagesProcessed: number
  /** backfill: false si quedan páginas (la UI/el próximo cron retoma). */
  done: boolean
  nextPage?: number
  error?: string
}

const PROVIDER = 'kiteprop'
const PAGE_SIZE = 25

/**
 * Sincroniza contactos de KiteProp → VendéPro. Crea SOLO contactos (no leads),
 * con source 'kiteprop' y el primer admin de la org como dueño.
 *
 * Idempotencia en dos capas: integration_links (mapping id externo → contacto,
 * batch por página) y ContactRepository.findByEmailOrPhone (si la persona ya
 * existía por otro origen, solo se crea el link).
 *
 * Modos:
 * - auto/manual: incremental desde last_sync_at (date_from por día; el overlap
 *   es inofensivo gracias a los links). last_sync_at solo avanza si la corrida
 *   terminó (done) para no saltear contactos.
 * - backfill: histórico completo, chunked; el progreso se guarda en
 *   config_json.backfill_next_page para reanudar entre requests.
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

  async execute(input: SyncKitepropContactsInput): Promise<SyncKitepropContactsResult> {
    const startedAt = new Date().toISOString()
    const maxPages = input.maxPages ?? (input.mode === 'backfill' ? 5 : 10)

    const integration = await this.integrationRepo.findByOrgAndProvider(input.orgId, PROVIDER)
    if (!integration) {
      return this.fail(input, null, startedAt, 'La integración KiteProp no está configurada')
    }
    if (!integration.enabled) {
      return this.fail(input, integration.id, startedAt, 'La integración KiteProp está deshabilitada')
    }
    if (!integration.credentials_encrypted) {
      return this.fail(input, integration.id, startedAt, 'No hay API key configurada')
    }

    const apiKey = await this.decryptKey(integration.credentials_encrypted)
    if (!apiKey) {
      return this.fail(input, integration.id, startedAt, 'No se pudo desencriptar la API key. Volvé a ingresarla.')
    }

    const admin = await this.userRepo.findFirstAdminByOrg(input.orgId)
    if (!admin) {
      return this.fail(input, integration.id, startedAt, 'Organización sin administrador configurado')
    }

    // Rango de la corrida
    const config = integration.getConfig()
    let page: number
    let dateFrom: string | undefined
    if (input.mode === 'backfill') {
      page = Number(config.backfill_next_page ?? 1) || 1
    } else {
      page = 1
      // Incremental: desde la fecha (día) del último sync; si nunca corrió, desde hoy.
      dateFrom = (integration.last_sync_at ?? new Date().toISOString()).slice(0, 10)
    }

    let created = 0
    let skipped = 0
    let pagesProcessed = 0
    let done = false
    let runError: string | null = null
    let itemError: string | null = null

    while (pagesProcessed < maxPages) {
      let pageData
      try {
        pageData = await this.gateway.fetchContacts(apiKey, { page, limit: PAGE_SIZE, dateFrom })
      } catch (e) {
        // 429/5xx/timeout: cortar la corrida; lo procesado queda cubierto por los links.
        runError = e instanceof Error ? e.message : 'Error consultando KiteProp'
        break
      }

      const externalIds = pageData.data.map((c) => c.external_id)
      let linked: Record<string, string> = {}
      try {
        linked = await this.linkRepo.findContactIds(input.orgId, PROVIDER, externalIds)
      } catch {
        // best-effort: sin el batch, el dedupe por email/teléfono sigue cubriendo
      }

      // Corte incremental del lado cliente: KiteProp ignora date_from (verificado
      // en producción 05-jul-2026), así que con orden id:desc (más nuevos primero)
      // cortamos apenas aparece un contacto anterior a la marca.
      let reachedCutoff = false
      for (const dto of pageData.data) {
        if (dateFrom && dto.created_at.slice(0, 10) < dateFrom) {
          reachedCutoff = true
          break
        }
        if (linked[dto.external_id]) {
          skipped++
          continue
        }
        try {
          const result = await this.importContact(input.orgId, admin.id, dto)
          if (result === 'created') created++
          else skipped++
        } catch (e) {
          skipped++
          if (!itemError) itemError = e instanceof Error ? e.message : 'Error importando contacto'
        }
      }

      pagesProcessed++
      if (reachedCutoff || pageData.current_page >= pageData.last_page || pageData.data.length === 0) {
        done = true
        break
      }
      page++
    }

    if (!runError && !done && pagesProcessed >= maxPages) {
      // Se cortó por el tope de páginas: corrida parcial, reanudable.
      done = false
    }

    // Persistir estado de la integración
    if (input.mode === 'backfill') {
      integration.setConfig({ ...config, backfill_next_page: done ? null : page, backfill_done: done })
    } else if (done && !runError) {
      integration.update({ last_sync_at: new Date().toISOString() })
    }
    await this.integrationRepo.save(integration)

    const error = runError ?? itemError
    const status: 'ok' | 'partial' | 'error' =
      runError && pagesProcessed === 0 ? 'error' : (!done || error ? 'partial' : 'ok')

    await this.writeLog(input, integration.id, startedAt, status, created, skipped, error)

    return {
      ok: status !== 'error',
      created,
      skipped,
      pagesProcessed,
      done,
      ...(done ? {} : { nextPage: page }),
      ...(error ? { error } : {}),
    }
  }

  /** Importa un contacto: link existente por email/teléfono o alta nueva. */
  private async importContact(orgId: string, adminId: string, dto: KitepropContactDTO): Promise<'created' | 'linked'> {
    // ¿La persona ya existe por otro origen? Solo crear el mapping.
    let existing = null
    if (dto.email || dto.phone) {
      try {
        existing = await this.contactRepo.findByEmailOrPhone(orgId, dto.email, dto.phone)
      } catch {
        existing = null
      }
    }

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
      source: PROVIDER,
      agent_id: adminId,
    })
    await this.contactRepo.save(contact)
    await this.linkRepo.save(orgId, PROVIDER, dto.external_id, contact.id)
    return 'created'
  }

  private async fail(
    input: SyncKitepropContactsInput,
    integrationId: string | null,
    startedAt: string,
    error: string,
  ): Promise<SyncKitepropContactsResult> {
    if (integrationId) {
      await this.writeLog(input, integrationId, startedAt, 'error', 0, 0, error)
    }
    return { ok: false, created: 0, skipped: 0, pagesProcessed: 0, done: false, error }
  }

  private async writeLog(
    input: SyncKitepropContactsInput,
    integrationId: string,
    startedAt: string,
    status: 'ok' | 'partial' | 'error',
    created: number,
    skipped: number,
    error: string | null,
  ): Promise<void> {
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
    } catch {
      // el log nunca voltea el sync
    }
  }
}
