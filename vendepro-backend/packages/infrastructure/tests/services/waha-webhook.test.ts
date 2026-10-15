import { describe, it, expect } from 'vitest'
import { parsearWebhookWaha, esWebhookWaha } from '../../src/services/waha-webhook'

// Basado en los ejemplos de la documentación de WAHA (docs/how-to/events).
const mensaje = (payload: any = {}) => ({
  id: 'evt_1', timestamp: 1741249702485, event: 'message', session: 'org-orglocal',
  me: { id: '5491100000000@c.us', pushName: 'Inmobiliaria' },
  payload: {
    id: 'false_5491155551234@c.us_AAAA', timestamp: 1760000000,
    from: '5491155551234@c.us', fromMe: false, to: '5491100000000@c.us',
    body: 'Hola, vi el depto', hasMedia: false, ack: 1, vCards: [], _data: {},
    ...payload,
  },
  engine: 'WEBJS',
})

describe('esWebhookWaha', () => {
  it('reconoce el formato nativo', () => {
    expect(esWebhookWaha(mensaje())).toBe(true)
  })
  it('no confunde el formato de los scripts de prueba', () => {
    expect(esWebhookWaha({ chat_id: '549@c.us', content: 'hola' })).toBe(false)
  })
})

describe('parsearWebhookWaha — mensajes', () => {
  it('traduce un mensaje de texto', () => {
    const r = parsearWebhookWaha(mensaje())
    expect(r.tipo).toBe('mensaje')
    if (r.tipo !== 'mensaje') return
    expect(r.mensaje.chatId).toBe('5491155551234@c.us')
    expect(r.mensaje.texto).toBe('Hola, vi el depto')
    expect(r.mensaje.mensajeId).toBe('false_5491155551234@c.us_AAAA')
    expect(r.mensaje.session).toBe('org-orglocal')
  })

  // WAHA manda el timestamp del mensaje en segundos, no en milisegundos.
  it('convierte el timestamp de segundos a ISO', () => {
    const r = parsearWebhookWaha(mensaje())
    if (r.tipo !== 'mensaje') throw new Error('esperaba mensaje')
    expect(r.mensaje.enviadoEn).toBe(new Date(1760000000 * 1000).toISOString())
  })

  // La trampa: sin esto, cada respuesta del agente entraba como si la
  // hubiera escrito el cliente, y el bot le contestaba.
  it('ignora lo que sale desde el número (fromMe)', () => {
    const r = parsearWebhookWaha(mensaje({ fromMe: true }))
    expect(r).toEqual({ tipo: 'ignorado', motivo: 'mensaje propio (fromMe)' })
  })

  it.each([
    ['120363000000000000@g.us', 'grupo'],
    ['status@broadcast', 'estado'],
    ['120363000000000000@newsletter', 'canal'],
  ])('ignora %s (%s)', (from, motivo) => {
    expect(parsearWebhookWaha(mensaje({ from }))).toEqual({ tipo: 'ignorado', motivo })
  })

  it('traduce un audio con su tipo desde el mime', () => {
    const r = parsearWebhookWaha(mensaje({
      body: '', hasMedia: true,
      media: { url: 'https://waha/files/a.oga', mimetype: 'audio/ogg; codecs=opus', filename: null },
    }))
    if (r.tipo !== 'mensaje') throw new Error('esperaba mensaje')
    expect(r.mensaje.texto).toBeNull()
    expect(r.mensaje.adjuntos).toEqual([{ type: 'audio', url: 'https://waha/files/a.oga', mime: 'audio/ogg; codecs=opus', filename: null }])
  })

  // media.url puede venir null según la config de WAHA: igual se guarda,
  // así el agente sabe que el cliente mandó algo.
  it('guarda el adjunto aunque WAHA no lo haya descargado', () => {
    const r = parsearWebhookWaha(mensaje({ body: '', hasMedia: true, media: { url: null, mimetype: 'image/jpeg', filename: 'foto.jpg' } }))
    if (r.tipo !== 'mensaje') throw new Error('esperaba mensaje')
    expect(r.mensaje.adjuntos[0]).toMatchObject({ type: 'image', url: null })
  })

  it('toma el nombre de perfil si el engine lo trae', () => {
    const r = parsearWebhookWaha(mensaje({ _data: { notifyName: 'Juan Pérez' } }))
    if (r.tipo !== 'mensaje') throw new Error('esperaba mensaje')
    expect(r.mensaje.nombre).toBe('Juan Pérez')
  })

  it('sin nombre de perfil, null (la ingesta usa el teléfono)', () => {
    const r = parsearWebhookWaha(mensaje())
    if (r.tipo !== 'mensaje') throw new Error('esperaba mensaje')
    expect(r.mensaje.nombre).toBeNull()
  })

  it('ignora un mensaje sin texto ni adjuntos', () => {
    expect(parsearWebhookWaha(mensaje({ body: '   ' }))).toEqual({ tipo: 'ignorado', motivo: 'mensaje vacío' })
  })
})

describe('parsearWebhookWaha — estado de la sesión', () => {
  it('traduce session.status', () => {
    const r = parsearWebhookWaha({
      event: 'session.status', session: 'org-orglocal',
      payload: { status: 'FAILED', statuses: [], data: null },
    })
    expect(r).toEqual({ tipo: 'estado', session: 'org-orglocal', estado: 'FAILED' })
  })

  it('ignora otros eventos', () => {
    expect(parsearWebhookWaha({ event: 'presence.update', session: 's', payload: {} }).tipo).toBe('ignorado')
  })
})
