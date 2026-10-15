import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const apiFetch = vi.fn()
vi.mock('../api', () => ({
  apiFetch: (...a: any[]) => apiFetch(...a),
  getApiBase: () => 'http://localhost:8702',
}))

class SocketFalso {
  static ultimos: SocketFalso[] = []
  onopen?: () => void
  onmessage?: (m: { data: string }) => void
  onclose?: () => void
  onerror?: () => void
  enviados: string[] = []
  cerrado = false
  constructor(public url: string) { SocketFalso.ultimos.push(this) }
  send(d: string) { this.enviados.push(d) }
  close() { this.cerrado = true; this.onclose?.() }
}

const ticketOk = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ticket: 'tk.123' }) })
const esperar = () => new Promise(r => setTimeout(r, 0))

beforeEach(() => {
  vi.resetModules()
  SocketFalso.ultimos = []
  apiFetch.mockReset()
  ;(globalThis as any).WebSocket = SocketFalso
})
afterEach(() => { vi.useRealTimers() })

describe('tiempo real', () => {
  it('pide un ticket y abre el WebSocket con él', async () => {
    apiFetch.mockImplementation(ticketOk)
    const { suscribirTiempoReal } = await import('../tiempo-real')
    const salir = suscribirTiempoReal(() => {})
    await esperar(); await esperar()

    expect(apiFetch).toHaveBeenCalledWith('crm', '/realtime/ticket', { method: 'POST' })
    expect(SocketFalso.ultimos[0]?.url).toBe('ws://localhost:8702/realtime?ticket=tk.123')
    salir()
  })

  it('reparte los eventos a todos los suscriptores, con una sola conexión', async () => {
    apiFetch.mockImplementation(ticketOk)
    const { suscribirTiempoReal } = await import('../tiempo-real')
    const a = vi.fn(), b = vi.fn()
    const salirA = suscribirTiempoReal(a), salirB = suscribirTiempoReal(b)
    await esperar(); await esperar()

    expect(SocketFalso.ultimos).toHaveLength(1)
    const ws = SocketFalso.ultimos[0]!
    ws.onopen?.()
    ws.onmessage?.({ data: JSON.stringify({ tipo: 'aviso', userIds: ['u1'] }) })
    ws.onmessage?.({ data: 'pong' })
    expect(a).toHaveBeenCalledWith({ tipo: 'aviso', userIds: ['u1'] })
    expect(b).toHaveBeenCalledTimes(1)
    salirA(); salirB()
  })

  it('cierra la conexión cuando se va el último suscriptor', async () => {
    apiFetch.mockImplementation(ticketOk)
    const { suscribirTiempoReal } = await import('../tiempo-real')
    const salir = suscribirTiempoReal(() => {})
    await esperar(); await esperar()
    salir()
    expect(SocketFalso.ultimos[0]?.cerrado).toBe(true)
  })

  // Un corte de red no puede dejar la bandeja sorda: se reconecta sola.
  it('si se corta, se reconecta con un ticket nuevo', async () => {
    vi.useFakeTimers()
    apiFetch.mockImplementation(ticketOk)
    const { suscribirTiempoReal } = await import('../tiempo-real')
    const salir = suscribirTiempoReal(() => {})
    await vi.advanceTimersByTimeAsync(0)
    SocketFalso.ultimos[0]!.onclose?.()

    await vi.advanceTimersByTimeAsync(1100)
    expect(apiFetch).toHaveBeenCalledTimes(2)
    expect(SocketFalso.ultimos).toHaveLength(2)
    salir()
  })

  // Un entorno sin Durable Objects responde 503: no se insiste cada segundo.
  it('sin el servicio en el servidor, espera minutos antes de reintentar', async () => {
    vi.useFakeTimers()
    apiFetch.mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({}) })
    const { suscribirTiempoReal } = await import('../tiempo-real')
    const salir = suscribirTiempoReal(() => {})
    await vi.advanceTimersByTimeAsync(60_000)
    expect(apiFetch).toHaveBeenCalledTimes(1)
    expect(SocketFalso.ultimos).toHaveLength(0)
    salir()
  })
})
