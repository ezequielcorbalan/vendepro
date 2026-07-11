import type { KitepropGateway, KitepropContactDTO, KitepropContactsPage, KitepropTestResult, KitepropMessageDTO, KitepropMessagesPage, KitepropPropertyRef, KitepropPropertyDTO, KitepropAgentDTO, KitepropContactAgent } from '@vendepro/core'

/**
 * Cliente del servidor MCP de KiteProp (https://mcp.kiteprop.com).
 * KiteProp no publica API REST; su superficie oficial es MCP: JSON-RPC 2.0
 * sobre streamable HTTP, con la API key `kp_...` como query param.
 * La respuesta puede venir como JSON directo o como event-stream (SSE);
 * el payload real viaja en `result.content[0].text` (JSON serializado).
 *
 * IMPORTANTE: nunca loguear la api key (viaja en la URL).
 */
export class KitepropMcpClient implements KitepropGateway {
  constructor(
    private readonly baseUrl = 'https://mcp.kiteprop.com/mcp',
    private readonly timeoutMs = 20_000,
  ) {}

  async testConnection(apiKey: string): Promise<KitepropTestResult> {
    try {
      const profile = await this.callTool(apiKey, 'get_my_profile', {})
      const data = profile?.data ?? profile
      return { ok: true, profileName: data?.full_name ?? data?.email ?? null }
    } catch (err) {
      return { ok: false, error: (err as Error)?.message ?? 'Error de conexión con KiteProp' }
    }
  }

  async fetchContacts(apiKey: string, opts: { page: number; limit?: number; dateFrom?: string }): Promise<KitepropContactsPage> {
    const result = await this.callTool(apiKey, 'search_contacts', {
      page: opts.page,
      limit: opts.limit ?? 25,
      order: 'id:desc',
      ...(opts.dateFrom ? { date_from: opts.dateFrom } : {}),
    })

    const rows: any[] = Array.isArray(result?.data) ? result.data : []
    const meta = result?.meta ?? {}
    return {
      data: rows.map((c) => this.toContactDTO(c)),
      current_page: Number(meta.current_page ?? opts.page),
      last_page: Number(meta.last_page ?? opts.page),
      total: Number(meta.total ?? rows.length),
    }
  }

  private toContactDTO(c: any): KitepropContactDTO {
    return {
      external_id: String(c.id),
      full_name: String(c.full_name ?? '').trim() || 'Sin nombre',
      email: c.email ?? null,
      phone: c.phone ?? c.whatsapp_formatted ?? null,
      source: c.source ?? null,
      tags: Array.isArray(c.tags) ? c.tags.map((t: unknown) => String(t)) : [],
      category: c.category?.name ?? null,
      created_at: c.created_at ?? new Date().toISOString(),
    }
  }

  async fetchMessages(apiKey: string, opts: { page: number; limit?: number }): Promise<KitepropMessagesPage> {
    const result = await this.callTool(apiKey, 'search_messages', {
      page: opts.page,
      limit: opts.limit ?? 25,
      order: 'id:desc',
    })

    const rows: any[] = Array.isArray(result?.data) ? result.data : []
    const meta = result?.meta ?? {}
    return {
      data: rows.map((m) => this.toMessageDTO(m)),
      current_page: Number(meta.current_page ?? opts.page),
      last_page: Number(meta.last_page ?? opts.page),
      total: Number(meta.total ?? rows.length),
    }
  }

  private toMessageDTO(m: any): KitepropMessageDTO {
    const c = m.contact ?? {}
    return {
      external_id: String(m.id),
      body: String(m.body ?? '').trim(),
      source: m.source ?? null,
      property_id: m.property_id != null ? Number(m.property_id) : null,
      created_at: m.created_at ?? new Date().toISOString(),
      contact: {
        external_id: String(c.id),
        full_name: String(c.full_name ?? '').trim() || 'Sin nombre',
        email: c.email ?? null,
        phone: c.phone ?? c.whatsapp_formatted ?? null,
      },
    }
  }

  async fetchAgents(apiKey: string): Promise<KitepropAgentDTO[]> {
    const result = await this.callTool(apiKey, 'list_users', { limit: 25 })
    const rows: any[] = Array.isArray(result?.data) ? result.data : (Array.isArray(result) ? result : [])
    return rows.map((u) => ({
      external_id: String(u.id),
      full_name: String(u.full_name ?? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()) || 'Sin nombre',
      email: u.email ?? null,
    }))
  }

  async getContactAgent(apiKey: string, contactId: string): Promise<KitepropContactAgent | null> {
    let result: any
    try {
      result = await this.callTool(apiKey, 'get_contact', { id: Number(contactId) })
    } catch {
      return null // best-effort
    }
    const c = result?.data ?? result
    const u = c?.assigned_user ?? c?.user ?? null
    if (!u || u.id == null) return null
    return {
      external_id: String(u.id),
      email: u.email ?? null,
      name: u.full_name ?? null,
    }
  }

  async getPropertyRef(apiKey: string, propertyId: number): Promise<KitepropPropertyRef | null> {
    const dto = await this.getProperty(apiKey, propertyId)
    if (!dto) return null
    return {
      code: dto.code,
      title: dto.title,
      address: dto.address,
      agent_email: dto.agent_email,
      agent_name: dto.agent_name,
    }
  }

  async getProperty(apiKey: string, propertyId: number): Promise<KitepropPropertyDTO | null> {
    let result: any
    try {
      result = await this.callTool(apiKey, 'get_property', { property_id: propertyId })
    } catch {
      return null // best-effort: sin la propiedad, el enriquecimiento sigue sin ella
    }
    const p = result?.data ?? result
    if (!p || (p.id == null && p.code == null)) return null
    const user = p.user ?? p.assigned_user ?? null
    // Best-effort sobre las variantes de nombres que expone KiteProp: cada campo
    // cae a null si el payload no lo trae (la importación degrada con placeholders).
    const num = (v: unknown): number | null => {
      const n = typeof v === 'string' ? Number(v) : v
      return typeof n === 'number' && Number.isFinite(n) ? n : null
    }
    const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
    const operation = Array.isArray(p.operations) ? p.operations[0] : null
    const priceEntry = operation && Array.isArray(operation.prices) ? operation.prices[0] : null
    return {
      external_id: String(p.id ?? propertyId),
      code: str(p.code) ?? (p.id != null ? `KP${p.id}` : null),
      title: str(p.title),
      address: str(p.address) ?? str(p.full_address) ?? str(p.fake_address),
      neighborhood: str(p.neighborhood?.name) ?? str(p.neighborhood) ?? str(p.location?.name),
      property_type: str(p.type?.name) ?? str(p.property_type) ?? str(p.type),
      rooms: num(p.rooms) ?? num(p.room_amount) ?? num(p.suite_amount),
      size_m2: num(p.total_surface) ?? num(p.surface) ?? num(p.roofed_surface),
      price: num(p.price) ?? num(priceEntry?.price) ?? num(operation?.price),
      currency: str(p.currency) ?? str(priceEntry?.currency),
      cover_photo: str(p.cover_photo) ?? str(p.main_photo) ?? str(Array.isArray(p.photos) ? (p.photos[0]?.image ?? p.photos[0]?.url ?? p.photos[0]) : null),
      agent_email: str(user?.email),
      agent_name: str(user?.full_name) ?? str(user?.name),
    }
  }

  /** Llama un tool MCP y devuelve el payload JSON ya parseado. Lanza Error con mensaje seguro. */
  private async callTool(apiKey: string, name: string, args: Record<string, unknown>): Promise<any> {
    let res: Response
    try {
      res = await fetch(`${this.baseUrl}?api_key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name, arguments: args },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (err) {
      const msg = (err as Error)?.name === 'TimeoutError' ? 'timeout' : ((err as Error)?.message ?? 'network error')
      throw new Error(`KiteProp MCP: ${msg}`)
    }

    if (!res.ok) {
      await res.text().catch(() => '')
      const hint = res.status === 401 || res.status === 403 ? ' (API key inválida o revocada)' : ''
      throw new Error(`KiteProp MCP: HTTP ${res.status}${hint}`)
    }

    const contentType = res.headers.get('content-type') ?? ''
    let rpc: any
    if (contentType.includes('text/event-stream')) {
      // SSE: el resultado viene en líneas `data: {...}`; la última no vacía es la respuesta.
      const text = await res.text()
      const dataLines = text.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).filter(Boolean)
      const last = dataLines[dataLines.length - 1]
      if (!last) throw new Error('KiteProp MCP: respuesta SSE vacía')
      rpc = JSON.parse(last)
    } else {
      rpc = (await res.json()) as any
    }

    if (rpc.error) {
      throw new Error(`KiteProp MCP: ${rpc.error.message ?? 'error JSON-RPC'}`)
    }

    const text = rpc.result?.content?.[0]?.text
    if (rpc.result?.isError) {
      throw new Error(`KiteProp MCP: ${typeof text === 'string' ? text.slice(0, 200) : 'el tool devolvió error'}`)
    }
    if (typeof text !== 'string') {
      throw new Error('KiteProp MCP: respuesta sin contenido')
    }

    try {
      return JSON.parse(text)
    } catch {
      throw new Error('KiteProp MCP: el contenido no es JSON válido')
    }
  }
}
