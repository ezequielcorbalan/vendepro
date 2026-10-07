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

  /** Crea o arranca la sesión. Es idempotente del lado de WAHA. */
  async iniciar(): Promise<void> {
    const crear = await fetch(this.url('/api/sessions'), {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name: this.session, start: true }),
    })
    // 422 = ya existe: en ese caso alcanza con arrancarla.
    if (crear.ok) return

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
