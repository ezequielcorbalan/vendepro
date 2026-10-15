/**
 * Traductor del webhook NATIVO de WAHA a lo que entiende la ingesta.
 *
 * Existe porque el endpoint de entrada esperaba un formato inventado
 * (`chat_id`, `from_phone`, `content`) que sólo mandaban los scripts de prueba.
 * WAHA real manda `{event, session, payload: {from, fromMe, body, ...}}`: con un
 * contenedor de verdad no hubiera entrado ni un mensaje, y ninguna prueba lo
 * habría detectado.
 */

export interface MensajeWaha {
  session: string
  /** jid del chat: `5491155551234@c.us`. */
  chatId: string
  mensajeId: string | null
  texto: string | null
  /** Nombre de perfil, si el engine lo expone (no está garantizado). */
  nombre: string | null
  adjuntos: Array<{ type: string; url: string | null; mime: string | null; filename: string | null }>
  enviadoEn: string
}

export type EventoWaha =
  | { tipo: 'mensaje'; mensaje: MensajeWaha }
  | { tipo: 'estado'; session: string; estado: string }
  | { tipo: 'ignorado'; motivo: string }

/** ¿El body es del formato nativo de WAHA (y no del de los scripts de prueba)? */
export function esWebhookWaha(body: any): boolean {
  return !!body && typeof body === 'object' && typeof body.event === 'string' && 'payload' in body
}

/**
 * Chats que no son una conversación con un cliente. Un número de inmobiliaria
 * suele estar en grupos, y sin este filtro cada grupo abría una conversación
 * nueva en la bandeja y despertaba al bot.
 */
function noEsUnCliente(jid: string): string | null {
  if (jid.endsWith('@g.us')) return 'grupo'
  if (jid === 'status@broadcast') return 'estado'
  if (jid.endsWith('@newsletter')) return 'canal'
  if (jid.endsWith('@broadcast')) return 'lista de difusión'
  return null
}

function tipoDesdeMime(mime: string | null): string {
  if (!mime) return 'file'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('video/')) return 'video'
  return 'file'
}

export function parsearWebhookWaha(body: any): EventoWaha {
  const evento = String(body?.event ?? '')
  const session = String(body?.session ?? '')
  const p = body?.payload ?? {}

  if (evento === 'session.status') {
    return { tipo: 'estado', session, estado: String(p?.status ?? 'DESCONOCIDO') }
  }

  if (evento !== 'message' && evento !== 'message.any') {
    return { tipo: 'ignorado', motivo: `evento ${evento}` }
  }

  // Lo que sale DESDE el número. Sin este filtro, cada respuesta del agente
  // entraba como si la hubiera escrito el cliente, y el bot le contestaba.
  // Costo conocido: lo que alguien escriba directo en el teléfono, sin pasar
  // por VendéPro, no queda en el hilo.
  if (p?.fromMe) return { tipo: 'ignorado', motivo: 'mensaje propio (fromMe)' }

  const chatId = String(p?.from ?? '')
  if (!chatId) return { tipo: 'ignorado', motivo: 'sin remitente' }
  const descarte = noEsUnCliente(chatId)
  if (descarte) return { tipo: 'ignorado', motivo: descarte }

  const media = p?.hasMedia ? p?.media ?? null : null
  const adjuntos = media
    ? [{
        type: tipoDesdeMime(media.mimetype ?? null),
        // Puede venir null aunque hasMedia sea true: depende de si WAHA está
        // configurado para descargar archivos. El adjunto se guarda igual,
        // así el agente sabe que el cliente mandó algo.
        url: media.url ?? null,
        mime: media.mimetype ?? null,
        filename: media.filename ?? null,
      }]
    : []

  const texto = typeof p?.body === 'string' && p.body.trim() ? p.body : null
  if (!texto && adjuntos.length === 0) return { tipo: 'ignorado', motivo: 'mensaje vacío' }

  // El nombre de perfil no está en el contrato documentado: depende del
  // engine. Se toma si aparece y si no la ingesta usa el teléfono.
  const nombre = p?._data?.notifyName ?? p?._data?.pushName ?? null

  return {
    tipo: 'mensaje',
    mensaje: {
      session,
      chatId,
      mensajeId: p?.id ? String(p.id) : null,
      texto,
      nombre: typeof nombre === 'string' && nombre.trim() ? nombre.trim() : null,
      adjuntos,
      // WAHA manda el timestamp del mensaje en SEGUNDOS.
      enviadoEn: p?.timestamp
        ? new Date(Number(p.timestamp) * 1000).toISOString()
        : new Date().toISOString(),
    },
  }
}
