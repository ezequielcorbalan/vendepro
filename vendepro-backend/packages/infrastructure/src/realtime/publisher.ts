import type { RealtimePublisher, EventoTiempoReal } from '@vendepro/core'

/**
 * Publica en el InboxHub de la inmobiliaria (un Durable Object por org).
 *
 * Best-effort a propósito: si el hub no responde, el mensaje ya está guardado
 * y la pantalla lo levanta en su próxima consulta. Un aviso en vivo que falla
 * no puede tirar abajo la ingesta ni una respuesta del agente.
 */
export class DurableObjectRealtimePublisher implements RealtimePublisher {
  constructor(private readonly hub: DurableObjectNamespace) {}

  async publicar(orgId: string, evento: EventoTiempoReal): Promise<void> {
    try {
      const stub = this.hub.get(this.hub.idFromName(orgId))
      await stub.fetch('https://hub/publicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evento),
      })
    } catch {
      // Ver arriba: el polling cubre lo que no llegue en vivo.
    }
  }
}

/** Sin el binding (tests, un entorno sin Durable Objects) no hace nada. */
export class SinTiempoReal implements RealtimePublisher {
  async publicar(): Promise<void> {}
}

export function crearPublicadorTiempoReal(env: { INBOX_HUB?: DurableObjectNamespace }): RealtimePublisher {
  return env.INBOX_HUB ? new DurableObjectRealtimePublisher(env.INBOX_HUB) : new SinTiempoReal()
}
