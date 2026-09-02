'use client'

// ============================================================
// Mensajes predeterminados de WhatsApp
//
// Equivalente a las respuestas rápidas de WhatsApp Business: la inmobiliaria
// define los textos una vez y el agente los elige al abrir el chat, en lugar
// de tipearlos. Viven en la org (`GET /whatsapp-templates` de api-crm).
//
// Este módulo concentra las tres decisiones del feature para que ni los
// botones ni las pantallas las repitan:
//  1. cómo se leen (con caché a nivel módulo: hay un botón de WhatsApp por
//     lead en una lista de 185, no puede haber un fetch por botón),
//  2. qué variables acepta el texto y cómo se reemplazan,
//  3. de dónde salen los valores de esas variables (lead/contacto + usuario).
// ============================================================

import { useEffect, useState } from 'react'
import { apiFetch } from './api'
import { getCurrentUser } from './auth'

export interface WhatsAppTemplate {
  id: string
  org_id: string
  name: string
  body: string
  sort_order: number
  is_active: number
  created_at: string
  updated_at: string
}

/** Variables que el admin puede escribir en el cuerpo del mensaje. */
export const WHATSAPP_TEMPLATE_VARIABLES = [
  { key: 'nombre', label: 'Nombre del cliente', example: 'Gustavo' },
  { key: 'agente', label: 'Tu nombre', example: 'Marcela Genta' },
  { key: 'inmobiliaria', label: 'Nombre de la inmobiliaria', example: 'Marcela Genta Operaciones' },
  { key: 'direccion', label: 'Dirección de la propiedad', example: 'Lavalle 2060' },
] as const

export type WhatsAppTemplateVariable = (typeof WHATSAPP_TEMPLATE_VARIABLES)[number]['key']

/** Datos de la entidad desde la que se abre el chat (lead, contacto, evento). */
export interface WhatsAppTemplateContext {
  /** Nombre completo; para {{nombre}} se usa sólo el primero. */
  name?: string | null
  address?: string | null
}

// ── Render ────────────────────────────────────────────────────

/** Primer nombre, que es como se saluda en un WhatsApp ("Hola Gustavo"). */
function firstName(fullName?: string | null): string {
  return (fullName || '').trim().split(/\s+/)[0] || ''
}

/**
 * Reemplaza `{{variable}}` por su valor. Una variable sin dato se borra (en
 * vez de dejar el placeholder crudo) y se colapsan los espacios que quedan:
 * un mensaje con "Hola ," se manda igual, uno con "Hola {{nombre}}," no.
 */
export function renderWhatsAppTemplate(
  body: string,
  ctx: WhatsAppTemplateContext,
  extras?: { agentName?: string | null; orgName?: string | null },
): string {
  const values: Record<WhatsAppTemplateVariable, string> = {
    nombre: firstName(ctx.name),
    agente: (extras?.agentName ?? getCurrentUser()?.full_name ?? '').trim(),
    inmobiliaria: (extras?.orgName ?? '').trim(),
    direccion: (ctx.address ?? '').trim(),
  }

  return body
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
      const value = values[key as WhatsAppTemplateVariable]
      return value !== undefined ? value : match
    })
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .trim()
}

// ── Lectura con caché ─────────────────────────────────────────

interface TemplatesState {
  templates: WhatsAppTemplate[]
  orgName: string | null
}

let cache: TemplatesState | null = null
let inFlight: Promise<TemplatesState> | null = null
const subscribers = new Set<(state: TemplatesState) => void>()

const EMPTY: TemplatesState = { templates: [], orgName: null }

async function fetchTemplates(): Promise<TemplatesState> {
  const res = await apiFetch('crm', '/whatsapp-templates?active=1')
  const data = (await res.json()) as any
  const state: TemplatesState = {
    templates: Array.isArray(data?.templates) ? data.templates : [],
    orgName: data?.org_name ?? null,
  }
  cache = state
  subscribers.forEach(fn => fn(state))
  return state
}

/**
 * Invalida la caché para que el próximo consumidor vuelva a leer del backend.
 * La llama el ABM de configuración después de guardar o borrar.
 */
export function invalidateWhatsAppTemplates(): void {
  cache = null
  inFlight = null
}

/**
 * Plantillas activas de la org. Comparten una sola request entre todos los
 * botones montados; si la API falla se devuelve vacío y el botón de WhatsApp
 * vuelve a su comportamiento de siempre (abrir el chat sin texto).
 */
export function useWhatsAppTemplates(): TemplatesState & { loading: boolean } {
  const [state, setState] = useState<TemplatesState>(() => cache ?? EMPTY)
  const [loading, setLoading] = useState(() => cache === null)

  useEffect(() => {
    let alive = true
    subscribers.add(setState)

    if (cache) {
      setState(cache)
      setLoading(false)
    } else {
      setLoading(true)
      // Si falla se limpia `inFlight`, para que el próximo montaje reintente
      // en vez de quedar pegado al vacío por el resto de la sesión.
      inFlight = inFlight ?? fetchTemplates().catch(() => { inFlight = null; return EMPTY })
      inFlight.then(s => { if (alive) { setState(s); setLoading(false) } })
    }

    return () => { alive = false; subscribers.delete(setState) }
  }, [])

  return { ...state, loading }
}
