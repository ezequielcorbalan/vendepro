import type { UserIntegration } from '../../../domain/entities/user-integration'

/**
 * Estado del canal de notificaciones y de la sincronización incremental.
 *
 * Vive dentro de `config_json` de la integración y no en columnas propias: es
 * estado de un proveedor concreto, cambia con su API, y meterlo en el esquema
 * obligaría a migrar la tabla cada vez que Google cambie de idea.
 */
export interface GoogleWatchState {
  /** Id del canal — el que Google devuelve en cada notificación. */
  watch_channel_id?: string
  /** Id del recurso observado; hace falta para cerrar el canal. */
  watch_resource_id?: string
  /** Vencimiento del canal, ms epoch. */
  watch_expiration?: number
  /** Secreto que valida que el POST viene de Google. */
  watch_token?: string
  /** Token de sincronización incremental de la Calendar API. */
  sync_token?: string
}

/**
 * Margen para renovar antes de que el canal venza. Google los cierra solos a
 * los pocos días; renovar sobre la hora deja una ventana en la que los
 * cambios no llegan, y el cron no corre al segundo exacto.
 */
export const WATCH_RENEW_MARGIN_MS = 24 * 60 * 60 * 1000

export function readWatchState(integration: UserIntegration): GoogleWatchState {
  const cfg = integration.getConfig()
  return {
    watch_channel_id: typeof cfg.watch_channel_id === 'string' ? cfg.watch_channel_id : undefined,
    watch_resource_id: typeof cfg.watch_resource_id === 'string' ? cfg.watch_resource_id : undefined,
    watch_expiration: typeof cfg.watch_expiration === 'number' ? cfg.watch_expiration : undefined,
    watch_token: typeof cfg.watch_token === 'string' ? cfg.watch_token : undefined,
    sync_token: typeof cfg.sync_token === 'string' ? cfg.sync_token : undefined,
  }
}

/** Escribe el estado del canal sin pisar el resto de la config (email, etc.). */
export function writeWatchState(integration: UserIntegration, patch: GoogleWatchState): void {
  integration.setConfig({ ...integration.getConfig(), ...patch })
}

/** ¿Hay que abrir o renovar el canal? */
export function needsWatchRenewal(state: GoogleWatchState, now: number = Date.now()): boolean {
  if (!state.watch_channel_id || !state.watch_expiration) return true
  return state.watch_expiration - now <= WATCH_RENEW_MARGIN_MS
}
