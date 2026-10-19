import type { OrgIntegrationRepository } from '../../ports/repositories/org-integration-repository'
import type { MetaPageConnector } from '../../ports/services/meta-page-connector'
import type { IdGenerator } from '../../ports/id-generator'
import { OrgIntegration } from '../../../domain/entities/org-integration'
import { ValidationError } from '../../../domain/errors/validation-error'

export interface ConnectMetaPageInput {
  orgId: string
  /** Proveedor con el que se guarda la integración de Meta (compartida con la bandeja de Instagram/Facebook). */
  provider: string
  /** Token de un usuario del sistema del Business Manager de la inmobiliaria. No se guarda. */
  userAccessToken: string
  /** Página elegida. Sin esto, y con más de una página, se devuelven las opciones. */
  pageId?: string | null
  /** Quién conecta la página: los leads de los formularios se le asignan a él. */
  connectedBy: string
}

export type ConnectMetaPageResult =
  | { status: 'elegir'; pages: Array<{ id: string; name: string }> }
  | { status: 'conectada'; page: { id: string; name: string } }

/**
 * Conecta la página de Facebook de la inmobiliaria para que entren sus leads
 * de Lead Ads.
 *
 * Del token que pega el admin se saca el **page access token** de la página
 * elegida: es lo único que se guarda (cifrado). Después se suscribe la página
 * a la app; sin eso Meta no manda el webhook `leadgen` aunque la app esté
 * suscrita al campo.
 *
 * La config previa se conserva: la misma fila la usa la bandeja de Instagram
 * (`account_id`, `api_version`).
 *
 * Quien conecta la página queda como dueño de los leads que entran
 * (`lead_owner_id`): el reparto es manual, así que alguien concreto los recibe
 * y los delega. Para cambiarlo, otro admin reconecta.
 */
export class ConnectMetaPageUseCase {
  constructor(
    private readonly repo: OrgIntegrationRepository,
    private readonly connector: MetaPageConnector,
    private readonly ids: IdGenerator,
    private readonly encrypt: (plain: string) => Promise<string>,
  ) {}

  async execute(input: ConnectMetaPageInput): Promise<ConnectMetaPageResult> {
    const token = input.userAccessToken?.trim()
    if (!token) throw new ValidationError('Pegá el token del usuario del sistema')

    const pages = await this.connector.listPages(token)
    if (pages.length === 0) {
      throw new ValidationError('El token no tiene acceso a ninguna página. Revisá que el usuario del sistema tenga asignada la página.')
    }

    const pageId = input.pageId ?? (pages.length === 1 ? pages[0]!.id : null)
    if (!pageId) return { status: 'elegir', pages: pages.map(p => ({ id: p.id, name: p.name })) }

    const page = pages.find(p => p.id === pageId)
    if (!page) throw new ValidationError('Ese token no tiene acceso a la página elegida')

    await this.connector.subscribeLeadgen(page.id, page.access_token)

    const previa = await this.repo.findByOrgAndProvider(input.orgId, input.provider).catch(() => null)
    const config = {
      ...(previa?.getConfig() ?? {}),
      page_id: page.id,
      page_name: page.name,
      lead_owner_id: input.connectedBy,
    }

    await this.repo.save(OrgIntegration.create({
      id: previa?.id ?? this.ids.generate(),
      org_id: input.orgId,
      provider: input.provider,
      name: previa?.name ?? 'Meta',
      credentials_encrypted: await this.encrypt(page.access_token),
      config_json: JSON.stringify(config),
      enabled: true,
      created_at: previa?.created_at,
    }))

    return { status: 'conectada', page: { id: page.id, name: page.name } }
  }
}
