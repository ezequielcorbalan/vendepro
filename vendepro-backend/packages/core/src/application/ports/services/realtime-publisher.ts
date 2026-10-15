import type { EventoTiempoReal } from '../../../domain/rules/realtime-access'

export type { EventoTiempoReal }

/**
 * Avisos en vivo a las pantallas abiertas (la bandeja y la campana).
 *
 * El aviso no lleva datos: dice QUÉ cambió y la pantalla vuelve a pedirlo
 * por la API de siempre, que es la que aplica los permisos. Así un evento
 * nunca puede filtrar el contenido de una conversación ajena.
 */
export interface RealtimePublisher {
  /** Best-effort: si el aviso no sale, la pantalla lo levanta en la próxima consulta. */
  publicar(orgId: string, evento: EventoTiempoReal): Promise<void>
}
