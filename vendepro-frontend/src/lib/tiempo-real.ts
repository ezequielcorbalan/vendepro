'use client'

// ============================================================
// Tiempo real: avisos al instante de la bandeja y la campana
//
// Una sola conexión WebSocket por pestaña, compartida por todo lo que la use
// (hoy la bandeja de Conversaciones y la campana). Se abre con el primer
// suscriptor y se cierra con el último.
//
// El aviso no trae datos: dice QUÉ cambió ("la conversación X", "tenés una
// notificación") y cada pantalla lo vuelve a pedir por la API de siempre.
// Si la conexión no está, nada se rompe: las pantallas siguen con su consulta
// periódica, que es el respaldo.
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { apiFetch, getApiBase } from './api'

export type EventoTiempoReal =
  | { tipo: 'conversacion'; conversationId: string; assigneeId: string | null; previoAssigneeId?: string | null }
  | { tipo: 'aviso'; userIds: string[] }

type Oyente = (evento: EventoTiempoReal) => void

const oyentes = new Set<Oyente>()
const oyentesEstado = new Set<(conectado: boolean) => void>()

let ws: WebSocket | null = null
let conectando = false
let conectado = false
let intentos = 0
let reconexion: ReturnType<typeof setTimeout> | null = null
let latido: ReturnType<typeof setInterval> | null = null

/** Cada 30 s: Cloudflare corta un WebSocket quieto, y el ping no despierta al hub. */
const LATIDO_MS = 30_000
/** Si el servidor no tiene tiempo real configurado (503), se reintenta muy de vez en cuando. */
const ESPERA_SIN_SERVICIO_MS = 5 * 60_000

function setConectado(valor: boolean) {
  if (conectado === valor) return
  conectado = valor
  oyentesEstado.forEach(fn => fn(valor))
}

function limpiar() {
  if (latido) clearInterval(latido)
  latido = null
  ws = null
  setConectado(false)
}

function programarReconexion(esperaMs?: number) {
  if (reconexion || oyentes.size === 0) return
  // 1 s, 2 s, 4 s… hasta 30 s: un corte de red no se convierte en una ráfaga.
  const espera = esperaMs ?? Math.min(30_000, 1000 * 2 ** intentos)
  intentos++
  reconexion = setTimeout(() => { reconexion = null; void conectar() }, espera)
}

async function conectar() {
  if (ws || conectando || oyentes.size === 0 || typeof WebSocket === 'undefined') return
  conectando = true
  try {
    const res = await apiFetch('crm', '/realtime/ticket', { method: 'POST' })
    if (res.status === 503) { programarReconexion(ESPERA_SIN_SERVICIO_MS); return }
    if (!res.ok) throw new Error(`ticket ${res.status}`)
    const { ticket } = (await res.json()) as any
    const base = getApiBase('crm').replace(/^http/, 'ws')
    const socket = new WebSocket(`${base}/realtime?ticket=${encodeURIComponent(ticket)}`)
    ws = socket

    socket.onopen = () => {
      intentos = 0
      setConectado(true)
      latido = setInterval(() => { try { socket.send('ping') } catch { /* se cierra solo */ } }, LATIDO_MS)
    }
    socket.onmessage = (m) => {
      if (m.data === 'pong') return
      try {
        const evento = JSON.parse(String(m.data)) as EventoTiempoReal
        oyentes.forEach(fn => { try { fn(evento) } catch { /* un oyente roto no frena al resto */ } })
      } catch { /* mensaje que no es un evento */ }
    }
    socket.onclose = () => {
      if (ws !== socket) return
      limpiar()
      programarReconexion()
    }
    socket.onerror = () => { try { socket.close() } catch { /* ya cerrado */ } }
  } catch {
    limpiar()
    programarReconexion()
  } finally {
    conectando = false
  }
}

function desconectar() {
  if (reconexion) clearTimeout(reconexion)
  reconexion = null
  intentos = 0
  const socket = ws
  limpiar()
  try { socket?.close(1000, 'sin suscriptores') } catch { /* ya cerrado */ }
}

// Al volver a la pestaña, si se había caído, se reconecta en el momento.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !ws && oyentes.size > 0) {
      if (reconexion) { clearTimeout(reconexion); reconexion = null }
      intentos = 0
      void conectar()
    }
  })
}

/** Suscribirse sin React (devuelve la función para desuscribirse). */
export function suscribirTiempoReal(fn: Oyente): () => void {
  oyentes.add(fn)
  void conectar()
  return () => {
    oyentes.delete(fn)
    if (oyentes.size === 0) desconectar()
  }
}

/**
 * Escuchar avisos desde un componente. Devuelve si la conexión está viva, para
 * que la pantalla decida cada cuánto consultar por su cuenta.
 */
export function useTiempoReal(onEvento: Oyente): boolean {
  const ultimo = useRef(onEvento)
  ultimo.current = onEvento
  const [vivo, setVivo] = useState(conectado)

  useEffect(() => {
    oyentesEstado.add(setVivo)
    setVivo(conectado)
    const desuscribir = suscribirTiempoReal(e => ultimo.current(e))
    return () => { oyentesEstado.delete(setVivo); desuscribir() }
  }, [])

  return vivo
}
