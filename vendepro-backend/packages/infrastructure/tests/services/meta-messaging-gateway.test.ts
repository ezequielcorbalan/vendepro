import { describe, it, expect, vi, afterEach } from 'vitest'
import { MetaMessagingGateway, obtenerPerfilMeta } from '../../src/services/meta-messaging-gateway'
import { providerDeCanal } from '../../src/services/messaging-factory'

afterEach(() => vi.unstubAllGlobals())

function fetchOk() {
  const fn = vi.fn(async () => new Response(JSON.stringify({ message_id: 'm_1' }), { status: 200 }))
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('MetaMessagingGateway', () => {
  it('manda a Messenger por la Send API con el page token', async () => {
    const fn = fetchOk()
    const gw = new MetaMessagingGateway({ pageAccessToken: 'tok-page' })
    const r = await gw.sendText({ channel: 'facebook', chatId: 'psid-1', text: 'Hola' } as any)

    expect(r.externalId).toBe('m_1')
    const [url, init] = fn.mock.calls[0] as any
    expect(url).toContain('/me/messages?access_token=tok-page')
    expect(JSON.parse(init.body)).toEqual({ recipient: { id: 'psid-1' }, message: { text: 'Hola' } })
  })

  // Instagram corta en 1000 caracteres y Messenger en 2000: con el tope de
  // Instagram para los dos, Messenger rechazaba mensajes que Meta acepta.
  it('aplica el tope de cada canal', async () => {
    fetchOk()
    const gw = new MetaMessagingGateway({ pageAccessToken: 't' })
    const texto = 'a'.repeat(1500)
    await expect(gw.sendText({ channel: 'instagram', chatId: 'x', text: texto } as any)).rejects.toThrow(/1000/)
    await expect(gw.sendText({ channel: 'facebook', chatId: 'x', text: texto } as any)).resolves.toBeTruthy()
  })

  it('no manda WhatsApp', async () => {
    const gw = new MetaMessagingGateway({ pageAccessToken: 't' })
    await expect(gw.sendText({ channel: 'whatsapp', chatId: 'x', text: 'h' } as any)).rejects.toThrow()
  })
})

describe('providerDeCanal', () => {
  // Instagram y Messenger son integraciones distintas: otra cuenta, otro token.
  it('cada canal tiene su integración', () => {
    expect(providerDeCanal('whatsapp')).toBe('whatsapp')
    expect(providerDeCanal('instagram')).toBe('instagram')
    expect(providerDeCanal('facebook')).toBe('facebook')
  })
})

describe('obtenerPerfilMeta', () => {
  it('Messenger: arma el nombre con nombre y apellido', async () => {
    const fn = vi.fn(async () => new Response(JSON.stringify({ first_name: 'Ana', last_name: 'Gómez' }), { status: 200 }))
    vi.stubGlobal('fetch', fn)
    const p = await obtenerPerfilMeta({ pageAccessToken: 't' }, 'psid-1', 'facebook')
    expect(p).toEqual({ nombre: 'Ana Gómez', usuario: null })
    expect(String((fn.mock.calls[0] as any)[0])).toContain('fields=first_name,last_name')
  })

  it('Instagram: nombre y @usuario', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ name: 'Juan', username: 'juanp' }), { status: 200 })))
    expect(await obtenerPerfilMeta({ pageAccessToken: 't' }, 'ig-1', 'instagram')).toEqual({ nombre: 'Juan', usuario: 'juanp' })
  })

  // Sin nombre se sigue igual: un perfil que no carga no frena la ingesta.
  it('si Meta falla, devuelve vacío sin tirar error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 400 })))
    expect(await obtenerPerfilMeta({ pageAccessToken: 't' }, 'x', 'facebook')).toEqual({ nombre: null, usuario: null })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('red caída') }))
    expect(await obtenerPerfilMeta({ pageAccessToken: 't' }, 'x', 'facebook')).toEqual({ nombre: null, usuario: null })
  })
})
