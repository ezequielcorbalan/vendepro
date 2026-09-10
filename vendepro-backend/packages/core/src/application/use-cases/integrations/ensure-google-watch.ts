import type { UserIntegrationRepository } from '../../ports/repositories/user-integration-repository'
import type { GoogleCalendarGateway } from '../../ports/services/google-calendar-gateway'
import type { IdGenerator } from '../../ports/id-generator'
import type { TokenEncryptor } from '../marketing/save-meta-integration'
import type { TokenDecryptor } from './test-kiteprop-connection'
import { GOOGLE_CALENDAR_PROVIDER } from './get-google-integration'
import { getValidGoogleAccessToken } from './google-access-token'
import { readWatchState, writeWatchState, needsWatchRenewal } from './google-watch-config'

export interface EnsureGoogleWatchInput {
  userId: string
  /** URL pública HTTPS del webhook. Google exige HTTPS y dominio verificado. */
  webhookUrl: string
  /** Fuerza la renovación aunque el canal siga vigente (al reconectar). */
  force?: boolean
}

export interface EnsureGoogleWatchResult {
  watching: boolean
  /** Se abrió o renovó ahora. `false` = el canal vigente sigue sirviendo. */
  renewed: boolean
  expiration: number | null
  reason?: string
}

/**
 * Deja abierto el canal por el que Google avisa que el calendario cambió.
 *
 * Google no mantiene los canales para siempre: vencen a los pocos días y hay
 * que volver a pedirlos. Por eso esto es idempotente y lo llaman tanto la
 * conexión inicial como el cron de renovación — pedirlo de más no rompe nada,
 * dejarlo vencer sí: los eventos dejan de llegar y nadie se entera.
 */
export class EnsureGoogleWatchUseCase {
  constructor(
    private readonly integrationRepo: UserIntegrationRepository,
    private readonly gateway: GoogleCalendarGateway,
    private readonly ids: IdGenerator,
    private readonly encryptToken: TokenEncryptor,
    private readonly decryptToken: TokenDecryptor,
  ) {}

  async execute(input: EnsureGoogleWatchInput): Promise<EnsureGoogleWatchResult> {
    const integration = await this.integrationRepo.findByUserAndProvider(
      input.userId,
      GOOGLE_CALENDAR_PROVIDER,
    )
    if (!integration || !integration.enabled || !integration.credentials_encrypted) {
      return { watching: false, renewed: false, expiration: null, reason: 'not_connected' }
    }

    const state = readWatchState(integration)
    if (!input.force && !needsWatchRenewal(state)) {
      return { watching: true, renewed: false, expiration: state.watch_expiration ?? null }
    }

    const accessToken = await getValidGoogleAccessToken({
      integration,
      repo: this.integrationRepo,
      gateway: this.gateway,
      encryptToken: this.encryptToken,
      decryptToken: this.decryptToken,
    })
    if (!accessToken) {
      return { watching: false, renewed: false, expiration: null, reason: 'invalid_credentials' }
    }

    // El canal viejo se cierra antes de abrir el nuevo. Si no, Google sigue
    // mandando notificaciones al canal anterior hasta que venza y el CRM
    // sincroniza dos veces por cada cambio.
    if (state.watch_channel_id && state.watch_resource_id) {
      await this.gateway.stopChannel(accessToken, state.watch_channel_id, state.watch_resource_id)
    }

    const channelId = this.ids.generate()
    const token = this.ids.generate()

    try {
      const channel = await this.gateway.watchEvents(accessToken, {
        channelId,
        address: input.webhookUrl,
        token,
      })
      writeWatchState(integration, {
        watch_channel_id: channel.id,
        watch_resource_id: channel.resource_id,
        watch_expiration: channel.expiration ?? undefined,
        watch_token: token,
      })
      await this.integrationRepo.save(integration)
      return { watching: true, renewed: true, expiration: channel.expiration }
    } catch (err: any) {
      // Que falle abrir el canal no puede romper la conexión de la cuenta: el
      // agente igual puede traer sus eventos con el botón manual. Se informa
      // el motivo para que la pantalla lo pueda decir.
      return {
        watching: false,
        renewed: false,
        expiration: null,
        reason: String(err?.message ?? 'watch_failed'),
      }
    }
  }
}
