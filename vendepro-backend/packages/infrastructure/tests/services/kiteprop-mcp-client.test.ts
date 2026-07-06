import { describe, it, expect, vi, afterEach } from 'vitest'
import { KitepropMcpClient } from '../../src/services/kiteprop-mcp-client'

/** Respuesta JSON-RPC exitosa: el payload va serializado en result.content[0].text. */
function rpcResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      result: { content: [{ type: 'text', text: JSON.stringify(payload) }] },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' }, ...init },
  )
}

const PROFILE = { success: true, data: { id: 7689, full_name: 'Gaston Corbalan', email: 'g@test.com' } }
const CONTACTS_PAGE = {
  data: [
    { id: 100, full_name: 'Ana López', email: 'ana@mail.com', phone: '+5491111111111', whatsapp_formatted: null, source: 'zonaprop', tags: ['tag1'], category: { id: 1, name: 'Nuevo' }, created_at: '2026-07-01T10:00:00.000000Z' },
    { id: 200, full_name: 'Sin Tel', email: 'ig.x@embluemail.com', phone: null, whatsapp_formatted: '+5492222222222', source: 'whatsapp_bot_instagram', tags: [], category: null, created_at: '2026-07-02T10:00:00.000000Z' },
  ],
  meta: { current_page: 1, last_page: 3, total: 55 },
}

describe('KitepropMcpClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('testConnection llama get_my_profile con JSON-RPC y api_key en la URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(rpcResponse(PROFILE))

    const client = new KitepropMcpClient()
    const result = await client.testConnection('kp_test123')

    expect(result).toEqual({ ok: true, profileName: 'Gaston Corbalan' })
    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toBe('https://mcp.kiteprop.com/mcp?api_key=kp_test123')
    expect(init?.method).toBe('POST')
    const body = JSON.parse(init?.body as string)
    expect(body.jsonrpc).toBe('2.0')
    expect(body.method).toBe('tools/call')
    expect(body.params).toEqual({ name: 'get_my_profile', arguments: {} })
    const headers = init?.headers as Record<string, string>
    expect(headers['Accept']).toContain('text/event-stream')
  })

  it('fetchContacts mapea contactos (phone ?? whatsapp_formatted, category.name, external_id string)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(rpcResponse(CONTACTS_PAGE))

    const client = new KitepropMcpClient()
    const page = await client.fetchContacts('kp_test', { page: 1 })

    expect(page.current_page).toBe(1)
    expect(page.last_page).toBe(3)
    expect(page.total).toBe(55)
    expect(page.data).toHaveLength(2)
    expect(page.data[0]).toEqual({
      external_id: '100', full_name: 'Ana López', email: 'ana@mail.com',
      phone: '+5491111111111', source: 'zonaprop', tags: ['tag1'],
      category: 'Nuevo', created_at: '2026-07-01T10:00:00.000000Z',
    })
    // sin phone: usa whatsapp_formatted; sin category: null
    expect(page.data[1].phone).toBe('+5492222222222')
    expect(page.data[1].category).toBeNull()
  })

  it('fetchContacts pasa page/limit/order y date_from opcional', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => rpcResponse(CONTACTS_PAGE))

    const client = new KitepropMcpClient()
    await client.fetchContacts('kp_test', { page: 2, limit: 15, dateFrom: '2026-07-01' })

    const args = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string).params.arguments
    expect(args).toEqual({ page: 2, limit: 15, order: 'id:desc', date_from: '2026-07-01' })

    // sin dateFrom no manda date_from
    await client.fetchContacts('kp_test', { page: 1 })
    const args2 = JSON.parse(fetchSpy.mock.calls[1][1]?.body as string).params.arguments
    expect(args2).toEqual({ page: 1, limit: 25, order: 'id:desc' })
  })

  it('parsea respuestas SSE (text/event-stream) tomando la última línea data:', async () => {
    const rpc = { jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: JSON.stringify(PROFILE) }] } }
    const sse = `event: message\ndata: {"jsonrpc":"2.0","id":0,"result":{}}\n\nevent: message\ndata: ${JSON.stringify(rpc)}\n\n`
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(sse, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    )

    const client = new KitepropMcpClient()
    const result = await client.testConnection('kp_test')
    expect(result.ok).toBe(true)
    expect(result.profileName).toBe('Gaston Corbalan')
  })

  it('HTTP 401 devuelve error claro de API key sin lanzar en testConnection', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('unauthorized', { status: 401 }))

    const client = new KitepropMcpClient()
    const result = await client.testConnection('kp_bad')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('401')
    expect(result.error).toContain('API key')
  })

  it('error JSON-RPC lanza en fetchContacts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'rate limited' } }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }),
    )

    const client = new KitepropMcpClient()
    await expect(client.fetchContacts('kp_test', { page: 1 })).rejects.toThrow(/rate limited/)
  })

  it('result.isError lanza con el texto del tool', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        jsonrpc: '2.0', id: 1,
        result: { isError: true, content: [{ type: 'text', text: 'Invalid API key' }] },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )

    const client = new KitepropMcpClient()
    await expect(client.fetchContacts('kp_test', { page: 1 })).rejects.toThrow(/Invalid API key/)
  })

  it('falla de red se reporta como error de conexión (sin exponer la key)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'))

    const client = new KitepropMcpClient()
    const result = await client.testConnection('kp_secreta')
    expect(result.ok).toBe(false)
    expect(result.error).not.toContain('kp_secreta')
  })

  // ── fetchMessages ───────────────────────────────────────────────

  const MESSAGES_PAGE = {
    data: [
      {
        id: 1571447,
        body: 'Hola, vi en Argenprop este Departamento en Alquiler en Villa Urquiza y quiero más información.',
        source: 'argenprop',
        property_id: 522301,
        created_at: '2026-07-06T10:56:00.000000Z',
        contact: { id: 1357652, full_name: 'Romina', email: 'rominaaces@gmail.com', phone: '2345503872', whatsapp_formatted: null },
      },
      {
        id: 1571440,
        body: 'Consulta sin teléfono',
        source: 'zonaprop',
        property_id: null,
        created_at: '2026-07-06T09:00:00.000000Z',
        contact: { id: 1357000, full_name: 'Sin Tel', email: null, phone: null, whatsapp_formatted: '+5491133334444' },
      },
    ],
    meta: { current_page: 1, last_page: 2, total: 30 },
  }

  it('fetchMessages llama search_messages id:desc y mapea body/source/property_id/contact', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(rpcResponse(MESSAGES_PAGE))

    const client = new KitepropMcpClient()
    const page = await client.fetchMessages('kp_test', { page: 1 })

    const args = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string).params
    expect(args.name).toBe('search_messages')
    expect(args.arguments).toEqual({ page: 1, limit: 25, order: 'id:desc' })

    expect(page.current_page).toBe(1)
    expect(page.last_page).toBe(2)
    expect(page.data).toHaveLength(2)
    expect(page.data[0]).toEqual({
      external_id: '1571447',
      body: 'Hola, vi en Argenprop este Departamento en Alquiler en Villa Urquiza y quiero más información.',
      source: 'argenprop',
      property_id: 522301,
      created_at: '2026-07-06T10:56:00.000000Z',
      contact: { external_id: '1357652', full_name: 'Romina', email: 'rominaaces@gmail.com', phone: '2345503872' },
    })
    // sin phone usa whatsapp_formatted; property_id null se preserva
    expect(page.data[1].property_id).toBeNull()
    expect(page.data[1].contact.phone).toBe('+5491133334444')
  })

  // ── getPropertyRef ──────────────────────────────────────────────

  it('getPropertyRef mapea code/title/address + agente (user.email)', async () => {
    const PROP = { data: { id: 522301, code: 'KP522301', title: 'Oficina en alquiler. Villa Urquiza', address: 'Av. Triunvirato 4000', user: { id: 7688, full_name: 'Andrés Giunta', email: 'andresgiunta@deinmobiliarios.com' } } }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(rpcResponse(PROP))

    const client = new KitepropMcpClient()
    const ref = await client.getPropertyRef('kp_test', 522301)
    expect(ref).toEqual({
      code: 'KP522301',
      title: 'Oficina en alquiler. Villa Urquiza',
      address: 'Av. Triunvirato 4000',
      agent_email: 'andresgiunta@deinmobiliarios.com',
      agent_name: 'Andrés Giunta',
    })
  })

  it('getPropertyRef devuelve null (best-effort) si el tool falla', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'not found' } }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }),
    )
    const client = new KitepropMcpClient()
    expect(await client.getPropertyRef('kp_test', 999)).toBeNull()
  })
})
