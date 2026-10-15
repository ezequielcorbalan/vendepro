import { debeRecibir } from '@vendepro/core'
import type { EventoTiempoReal, Suscriptor } from '@vendepro/core'

/**
 * Durable Object de tiempo real: uno por inmobiliaria.
 *
 * Mantiene los WebSockets de quienes tienen la bandeja (o la campana) abierta
 * y les reenvía los avisos que publican api-crm y api-public. Usa la API de
 * hibernación: con las conexiones quietas el objeto se duerme y no cobra
 * tiempo de CPU; se despierta sólo para repartir un aviso.
 *
 * No guarda nada: si se reinicia, los navegadores se reconectan solos y
 * mientras tanto la consulta periódica cubre el hueco.
 *
 * Rutas (internas, las llama el worker después de autenticar):
 *   GET  /conectar  (Upgrade: websocket) con X-User-Id y X-Ve-Todo
 *   POST /publicar  body: EventoTiempoReal
 */
export class InboxHub {
  constructor(private readonly state: DurableObjectState, _env: unknown) {
    // El "ping" de mantenimiento se contesta sin despertar al objeto.
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/conectar') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Se esperaba un WebSocket', { status: 426 })
      }
      const userId = request.headers.get('X-User-Id')
      if (!userId) return new Response('Falta el usuario', { status: 400 })

      const par = new WebSocketPair()
      const [cliente, servidor] = [par[0], par[1]]
      this.state.acceptWebSocket(servidor)
      const suscriptor: Suscriptor = { userId, veTodo: request.headers.get('X-Ve-Todo') === '1' }
      servidor.serializeAttachment(suscriptor)
      return new Response(null, { status: 101, webSocket: cliente })
    }

    if (url.pathname === '/publicar' && request.method === 'POST') {
      const evento = (await request.json().catch(() => null)) as EventoTiempoReal | null
      if (!evento || (evento.tipo !== 'conversacion' && evento.tipo !== 'aviso')) {
        return new Response('Evento inválido', { status: 400 })
      }
      return Response.json({ entregados: this.repartir(evento) })
    }

    return new Response('No encontrado', { status: 404 })
  }

  /** Manda el evento a cada conexión que tiene permiso de recibirlo. */
  repartir(evento: EventoTiempoReal): number {
    const mensaje = JSON.stringify(evento)
    let entregados = 0
    for (const ws of this.state.getWebSockets()) {
      const suscriptor = ws.deserializeAttachment() as Suscriptor | null
      if (!suscriptor || !debeRecibir(suscriptor, evento)) continue
      try {
        ws.send(mensaje)
        entregados++
      } catch {
        // Una conexión rota no frena al resto; el runtime la cierra solo.
      }
    }
    return entregados
  }

  async webSocketMessage(_ws: WebSocket, _mensaje: string | ArrayBuffer): Promise<void> {
    // El navegador no manda nada además del ping (que se responde solo).
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try { ws.close(code, 'cerrado') } catch { /* ya estaba cerrado */ }
  }
}
