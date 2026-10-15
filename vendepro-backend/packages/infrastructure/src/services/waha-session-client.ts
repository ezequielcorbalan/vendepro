/**
 * Cliente de sesiones de WAHA: lo que hace falta para CONECTAR el número
 * desde la app, sin entrar al panel del contenedor.
 *
 * Vincular WhatsApp es escanear un QR con el teléfono. Esa sesión vive en el
 * proveedor, no en VendéPro, así que acá sólo se la consulta y se la arranca.
 */

export type EstadoSesion =
  | 'STOPPED' | 'STARTING' | 'SCAN_QR_CODE' | 'WORKING' | 'FAILED'
  | 'PASSKEY_REQUIRED' | 'PASSKEY_CONFIRMATION_REQUIRED'

export interface SesionWaha {
  estado: EstadoSesion | 'DESCONOCIDO'
  /** Nombre que WhatsApp muestra de la cuenta conectada, si ya vinculó. */
  cuenta?: string | null
}

export class WahaSessionClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string | null,
    private readonly session = 'default',
  ) {}

  private headers(extra: Record<string, string> = {}) {
    return { ...(this.apiKey ? { 'X-Api-Key': this.apiKey } : {}), ...extra }
  }

  private url(path: string) {
    const base = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl
    return `${base}${path}`
  }

  /** Estado actual. Un 404 significa que la sesión todavía no existe. */
  async estado(): Promise<SesionWaha> {
    const res = await fetch(this.url(`/api/sessions/${encodeURIComponent(this.session)}`), {
      headers: this.headers(),
    })
    if (res.status === 404) return { estado: 'STOPPED' }
    if (!res.ok) throw new Error(`WAHA respondió ${res.status} al consultar la sesión`)

    const data = (await res.json().catch(() => null)) as any
    return {
      estado: (data?.status ?? 'DESCONOCIDO') as EstadoSesion,
      cuenta: data?.me?.pushName ?? data?.me?.id ?? null,
    }
  }

  /**
   * Crea o arranca la sesión. Es idempotente del lado de WAHA.
   *
   * `webhook` es lo que hace posible un WAHA compartido entre inmobiliarias:
   * cada sesión avisa a nuestro endpoint con el token de SU organización en
   * el header, así el mensaje entrante se atribuye solo. Sin esto habría que
   * un contenedor por inmobiliaria.
   */
  async iniciar(webhook?: { url: string; token: string }): Promise<void> {
    const config = webhook
      ? {
          webhooks: [{
            url: webhook.url,
            // session.status: para avisar a los admins si el número se
            // desconecta. Sin esto la bandeja se queda muda y nadie se entera.
            events: ['message', 'session.status'],
            customHeaders: [{ name: 'Authorization', value: `Bearer ${webhook.token}` }],
            retries: { policy: 'constant', delaySeconds: 5, attempts: 10 },
          }],
        }
      : undefined

    const crear = await fetch(this.url('/api/sessions'), {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name: this.session, start: true, ...(config ? { config } : {}) }),
    })
    if (crear.ok) return

    // 422 = ya existe (alguien reconecta). NO alcanza con arrancarla: conectar
    // rota el token de la org, y la sesión vieja seguiría mandando el webhook
    // con el token revocado — 401 en cada mensaje, y la bandeja muda sin que
    // nadie se entere. Hay que pisarle la config.
    if (config) {
      const actualizar = await fetch(this.url(`/api/sessions/${encodeURIComponent(this.session)}`), {
        method: 'PUT',
        headers: this.headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name: this.session, config }),
      })
      if (!actualizar.ok) {
        const detalle = await actualizar.text().catch(() => '')
        throw new Error(`WAHA respondió ${actualizar.status} al actualizar la sesión${detalle ? `: ${detalle.slice(0, 200)}` : ''}`)
      }
      // Actualizar reinicia la sesión si estaba corriendo; arrancarla de
      // nuevo sólo hace falta si estaba parada.
      const { estado } = await this.estado()
      if (estado !== 'STOPPED' && estado !== 'FAILED') return
    }

    const arrancar = await fetch(this.url(`/api/sessions/${encodeURIComponent(this.session)}/start`), {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
    })
    if (!arrancar.ok) {
      const detalle = await arrancar.text().catch(() => '')
      throw new Error(`WAHA respondió ${arrancar.status} al iniciar la sesión${detalle ? `: ${detalle.slice(0, 200)}` : ''}`)
    }
  }

  /**
   * El QR en base64, listo para pintar en un <img>.
   *
   * Caduca rápido —el primero al minuto, los siguientes a los 20 segundos— así
   * que la pantalla lo vuelve a pedir mientras el estado sea SCAN_QR_CODE.
   */
  async qr(): Promise<string | null> {
    const res = await fetch(this.url(`/api/${encodeURIComponent(this.session)}/auth/qr`), {
      headers: this.headers({ Accept: 'application/json' }),
    })
    if (!res.ok) return null
    const data = (await res.json().catch(() => null)) as any
    const valor = data?.data ?? data?.value ?? null
    if (typeof valor !== 'string') return null
    return valor.startsWith('data:') ? valor : `data:image/png;base64,${valor}`
  }
}
