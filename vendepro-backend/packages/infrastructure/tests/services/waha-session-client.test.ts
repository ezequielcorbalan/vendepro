import { describe, it, expect, vi, afterEach } from 'vitest'
import { WahaSessionClient } from '../../src/services/waha-session-client'

type Paso = { status: number; body?: any }

function fetchConGuion(pasos: Record<string, Paso[]>) {
  const llamadas: Array<{ metodo: string; ruta: string; body: any }> = []
  const fn = vi.fn(async (url: string, init: any = {}) => {
    const metodo = init.method ?? 'GET'
    const ruta = new URL(url).pathname
    llamadas.push({ metodo, ruta, body: init.body ? JSON.parse(init.body) : null })
    const paso = pasos[`${metodo} ${ruta}`]?.shift() ?? { status: 404 }
    return new Response(JSON.stringify(paso.body ?? {}), { status: paso.status })
  })
  vi.stubGlobal('fetch', fn)
  return llamadas
}

afterEach(() => vi.unstubAllGlobals())

const webhook = { url: 'https://api/v1/inbox/messages', token: 'tok-nuevo' }

describe('WahaSessionClient.iniciar', () => {
  it('crea la sesión con el webhook de la org y los dos eventos', async () => {
    const llamadas = fetchConGuion({ 'POST /api/sessions': [{ status: 201 }] })
    await new WahaSessionClient('http://waha', 'k', 'org-a').iniciar(webhook)

    const wh = llamadas[0].body.config.webhooks[0]
    expect(wh.events).toEqual(['message', 'session.status'])
    expect(wh.customHeaders).toEqual([{ name: 'Authorization', value: 'Bearer tok-nuevo' }])
    expect(llamadas).toHaveLength(1)
  })

  // El bug: al reconectar se rotaba el token pero la sesión seguía mandando el
  // viejo. Cada mensaje rebotaba con 401 y la bandeja quedaba muda.
  it('si la sesión ya existe, le pisa la config con el token nuevo', async () => {
    const llamadas = fetchConGuion({
      'POST /api/sessions': [{ status: 422 }],
      'PUT /api/sessions/org-a': [{ status: 200 }],
      'GET /api/sessions/org-a': [{ status: 200, body: { status: 'STARTING' } }],
    })
    await new WahaSessionClient('http://waha', 'k', 'org-a').iniciar(webhook)

    const put = llamadas.find(l => l.metodo === 'PUT')!
    expect(put.body.config.webhooks[0].customHeaders[0].value).toBe('Bearer tok-nuevo')
    // Actualizar ya la reinició: no hace falta /start.
    expect(llamadas.some(l => l.ruta.endsWith('/start'))).toBe(false)
  })

  it('si estaba parada, la arranca después de actualizarla', async () => {
    const llamadas = fetchConGuion({
      'POST /api/sessions': [{ status: 422 }],
      'PUT /api/sessions/org-a': [{ status: 200 }],
      'GET /api/sessions/org-a': [{ status: 200, body: { status: 'STOPPED' } }],
      'POST /api/sessions/org-a/start': [{ status: 201 }],
    })
    await new WahaSessionClient('http://waha', 'k', 'org-a').iniciar(webhook)
    expect(llamadas.map(l => `${l.metodo} ${l.ruta}`)).toContain('POST /api/sessions/org-a/start')
  })

  // Mejor un error a la vista que una sesión vinculada que no avisa a nadie.
  it('si no puede actualizarla, falla en vez de seguir callado', async () => {
    fetchConGuion({
      'POST /api/sessions': [{ status: 422 }],
      'PUT /api/sessions/org-a': [{ status: 500 }],
    })
    await expect(new WahaSessionClient('http://waha', 'k', 'org-a').iniciar(webhook)).rejects.toThrow(/500/)
  })
})
