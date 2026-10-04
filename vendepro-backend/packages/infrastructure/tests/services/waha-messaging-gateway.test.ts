import { describe, it, expect, afterEach } from 'vitest'
import { createServer, type Server } from 'node:http'
import { WahaMessagingGateway } from '../../src/services/waha-messaging-gateway'

/**
 * Un WAHA de mentira: alcanza para verificar lo único que importa del adapter
 * —qué request manda y cómo lee la respuesta— sin levantar un contenedor ni
 * conectar un teléfono.
 */
function fakeWaha(handler: (req: { url: string; headers: any; body: any }) => { status?: number; body?: any }) {
  let recibido: any = null
  const server: Server = createServer((req, res) => {
    let raw = ''
    req.on('data', chunk => { raw += chunk })
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : null
      recibido = { url: req.url, headers: req.headers, body }
      const { status = 200, body: respuesta = {} } = handler(recibido)
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(respuesta))
    })
  })
  return {
    server,
    async listen(): Promise<string> {
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
      const dir = server.address() as any
      return `http://127.0.0.1:${dir.port}`
    },
    get recibido() { return recibido },
  }
}

let abierto: Server | null = null
afterEach(() => { abierto?.close(); abierto = null })

describe('WahaMessagingGateway', () => {
  it('manda el texto al endpoint de WAHA con la sesión y el chat', async () => {
    const waha = fakeWaha(() => ({ body: { id: { _serialized: 'false_549115@c.us_ABC' } } }))
    abierto = waha.server
    const baseUrl = await waha.listen()

    const gateway = new WahaMessagingGateway({ baseUrl, session: 'mg', apiKey: 'secreto' })
    const r = await gateway.sendText({ channel: 'whatsapp', chatId: '5491155551234@c.us', text: 'Hola' })

    expect(waha.recibido.url).toBe('/api/sendText')
    expect(waha.recibido.body).toEqual({ session: 'mg', chatId: '5491155551234@c.us', text: 'Hola' })
    expect(waha.recibido.headers['x-api-key']).toBe('secreto')
    // El id sirve para reconocer después el eco entrante de nuestro propio mensaje.
    expect(r.externalId).toBe('false_549115@c.us_ABC')
  })

  it('tolera una baseUrl con barra final', async () => {
    const waha = fakeWaha(() => ({ body: { id: 'x' } }))
    abierto = waha.server
    const baseUrl = await waha.listen()

    await new WahaMessagingGateway({ baseUrl: `${baseUrl}/`, session: 'default', apiKey: null })
      .sendText({ channel: 'whatsapp', chatId: 'a@c.us', text: 'Hola' })

    expect(waha.recibido.url).toBe('/api/sendText')
  })

  it('sin api key no manda el header', async () => {
    const waha = fakeWaha(() => ({ body: {} }))
    abierto = waha.server
    const baseUrl = await waha.listen()

    await new WahaMessagingGateway({ baseUrl, session: 'default', apiKey: null })
      .sendText({ channel: 'whatsapp', chatId: 'a@c.us', text: 'Hola' })

    expect(waha.recibido.headers['x-api-key']).toBeUndefined()
  })

  // Sin el detalle, el agente ve "falló" y nadie sabe si se cayó la sesión.
  it('cuando WAHA falla, el error dice qué contestó', async () => {
    const waha = fakeWaha(() => ({ status: 422, body: { error: 'session not connected' } }))
    abierto = waha.server
    const baseUrl = await waha.listen()

    const gateway = new WahaMessagingGateway({ baseUrl, session: 'default', apiKey: null })
    await expect(gateway.sendText({ channel: 'whatsapp', chatId: 'a@c.us', text: 'Hola' }))
      .rejects.toThrow(/422.*session not connected/)
  })

  it('si la respuesta no trae id, el mensaje igual se considera enviado', async () => {
    const waha = fakeWaha(() => ({ body: { ok: true } }))
    abierto = waha.server
    const baseUrl = await waha.listen()

    const r = await new WahaMessagingGateway({ baseUrl, session: 'default', apiKey: null })
      .sendText({ channel: 'whatsapp', chatId: 'a@c.us', text: 'Hola' })
    expect(r.externalId).toBeNull()
  })

  it('no acepta canales que WAHA no maneja', async () => {
    const gateway = new WahaMessagingGateway({ baseUrl: 'http://x', session: 'default', apiKey: null })
    await expect(gateway.sendText({ channel: 'instagram', chatId: 'a', text: 'Hola' }))
      .rejects.toThrow(/sólo maneja WhatsApp/)
  })
})
