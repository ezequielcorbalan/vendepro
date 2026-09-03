/**
 * Dominio de automatizaciones en el frontend.
 *
 * El catálogo de triggers/acciones/variables NO se duplica acá: lo sirve
 * `GET /automations/meta` desde el backend, que es la única fuente de verdad.
 * Este archivo tiene sólo los tipos, los mapas de color de estado y los
 * formateadores — lo que el design system pide centralizar en `lib`.
 */

import { getAnyStageLabel } from './crm-config'

// ── Tipos que devuelve la API ─────────────────────────────────

export type DedupeScope = 'daily' | 'once' | 'always'

export interface AutomationCondition {
  field: string
  op: string
  value?: unknown
}

export interface Automation {
  id: string
  org_id: string | null
  name: string
  description: string | null
  template_key: string | null
  is_system: boolean
  trigger_type: string
  trigger_config: Record<string, unknown>
  conditions: AutomationCondition[]
  dedupe_scope: DedupeScope
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AutomationAction {
  id: string
  automation_id: string
  order_index: number
  action_type: string
  action_config: Record<string, unknown>
  delay_minutes: number
}

export interface AutomationStats {
  total: number
  success: number
  failed: number
  skipped: number
  last_run_at: string | null
}

export interface AutomationListItem {
  automation: Automation
  actions: AutomationAction[]
  stats: AutomationStats
}

export interface CatalogItem {
  template_key: string
  name: string
  description: string | null
  trigger_type: string
  trigger_label: string
  action_labels: string[]
  activated: boolean
  available: boolean
}

export interface ConfigField {
  name: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'boolean' | 'html' | 'user' | 'stage'
  required?: boolean
  options?: Array<{ value: string; label: string }>
  placeholder?: string
  help?: string
  default?: unknown
}

export interface TriggerMeta {
  key: string
  label: string
  description: string
  entity_type: 'lead' | 'contact' | 'property' | 'appraisal'
  config_fields: ConfigField[]
  variables: string[]
  actions: string[]
}

export interface ActionMeta {
  key: string
  label: string
  description: string
  applies_to: string[]
  config_fields: ConfigField[]
  implemented: boolean
  chains_events?: boolean
}

export interface AutomationsMeta {
  triggers: TriggerMeta[]
  actions: ActionMeta[]
  operators: Array<{ value: string; label: string; unary: boolean }>
  variables: Array<{ key: string; label: string; scope: string; example: string }>
  stages: { lead: string[]; property: string[] }
  dedupe_scopes: Array<{ value: string; label: string; help: string }>
}

export interface RunActionResult {
  id: string
  action_type: string
  status: 'pending' | 'success' | 'failed' | 'skipped'
  result: Record<string, unknown> | null
  error: string | null
  executed_at: string | null
}

export interface AutomationRun {
  id: string
  automation_id: string
  trigger_event: string
  entity_type: string | null
  entity_id: string | null
  status: 'pending' | 'success' | 'partial' | 'failed' | 'skipped'
  skip_reason: string | null
  created_at: string
  finished_at: string | null
  actions: RunActionResult[]
}

// ── Mapas de estado (fuente única del color) ──────────────────
// Consumidos siempre vía `<StatusBadge label={cfg.label} color={cfg.color} />`,
// nunca armando el span a mano. Pares -100/-800 según la regla 7 del DS.

export interface StatusConfig {
  label: string
  color: string
}

export const AUTOMATION_STATE: Record<'on' | 'off', StatusConfig> = {
  on: { label: 'Activa', color: 'bg-green-100 text-green-800' },
  off: { label: 'Pausada', color: 'bg-gray-100 text-gray-700' },
}

/** Receta del catálogo que la org ya activó. */
export const CATALOG_ACTIVATED: StatusConfig = {
  label: 'Ya activada',
  color: 'bg-green-100 text-green-800',
}

/** Etiqueta neutra para chips informativos (acciones, esperas). */
export const NEUTRAL_CHIP = 'bg-gray-100 text-gray-700'

export const RUN_STATUS: Record<string, StatusConfig> = {
  pending: { label: 'En curso', color: 'bg-blue-100 text-blue-800' },
  success: { label: 'OK', color: 'bg-green-100 text-green-800' },
  partial: { label: 'Parcial', color: 'bg-amber-100 text-amber-800' },
  failed: { label: 'Falló', color: 'bg-red-100 text-red-800' },
  skipped: { label: 'Omitida', color: 'bg-gray-100 text-gray-700' },
}

export const RUN_ACTION_STATUS: Record<string, StatusConfig> = {
  pending: { label: 'Pendiente', color: 'bg-blue-100 text-blue-800' },
  success: { label: 'OK', color: 'bg-green-100 text-green-800' },
  failed: { label: 'Falló', color: 'bg-red-100 text-red-800' },
  skipped: { label: 'Omitida', color: 'bg-gray-100 text-gray-700' },
}

export function runStatusConfig(status: string): StatusConfig {
  return RUN_STATUS[status] ?? { label: status, color: 'bg-gray-100 text-gray-700' }
}

export function runActionStatusConfig(status: string): StatusConfig {
  return RUN_ACTION_STATUS[status] ?? { label: status, color: 'bg-gray-100 text-gray-700' }
}

/**
 * Por qué una ejecución no llegó a correr, en castellano. El backend guarda
 * la clave técnica; acá se traduce para que el cliente entienda qué pasó sin
 * tener que preguntar.
 */
export const SKIP_REASON_LABEL: Record<string, string> = {
  conditions_not_met: 'No se cumplían las condiciones',
  duplicate: 'Ya se había ejecutado sobre esta persona',
  rate_limited: 'Se alcanzó el límite de ejecuciones por hora',
  suppressed: 'La persona se dio de baja de los emails',
  max_depth: 'Se cortó para evitar un bucle entre automatizaciones',
  no_recipient: 'No había a quién enviarle',
  not_implemented: 'Esta acción todavía no está disponible',
  email_disabled: 'El envío de emails está apagado',
  empty_content: 'El mensaje quedó vacío',
  email_not_configured: 'Falta configurar el remitente de emails',
}

export function skipReasonLabel(reason: string | null): string | null {
  if (!reason) return null
  return SKIP_REASON_LABEL[reason] ?? reason
}

// ── Formateadores ─────────────────────────────────────────────

/** "sin espera" · "a los 30 min" · "a las 3 h" · "a los 2 días" */
export function delayLabel(minutes: number): string {
  if (!minutes || minutes <= 0) return 'sin espera'
  if (minutes < 60) return `a los ${minutes} min`
  if (minutes < 60 * 24) {
    const hours = Math.round(minutes / 60)
    return `a la${hours === 1 ? '' : 's'} ${hours} h`
  }
  const days = Math.round(minutes / (60 * 24))
  return `a${days === 1 ? 'l' : ' los'} ${days} día${days === 1 ? '' : 's'}`
}

/** Convierte a minutos lo que el editor pide en la unidad que elige el usuario. */
export function toMinutes(value: number, unit: 'min' | 'h' | 'd'): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (unit === 'min') return Math.round(value)
  if (unit === 'h') return Math.round(value * 60)
  return Math.round(value * 60 * 24)
}

/** Descompone minutos en la unidad más legible, para precargar el editor. */
export function fromMinutes(minutes: number): { value: number; unit: 'min' | 'h' | 'd' } {
  if (!minutes || minutes <= 0) return { value: 0, unit: 'min' }
  if (minutes % (60 * 24) === 0) return { value: minutes / (60 * 24), unit: 'd' }
  if (minutes % 60 === 0) return { value: minutes / 60, unit: 'h' }
  return { value: minutes, unit: 'min' }
}

/** Fecha corta en horario de Argentina. */
export function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** Etapas legibles: 'en_tasacion' → 'En tasación'. */
export function stageLabel(stage: string): string {
  return getAnyStageLabel(stage)
}

/** Resumen de una automatización en una línea, para la card de la lista. */
export function summarize(item: AutomationListItem, triggers: TriggerMeta[], actions: ActionMeta[]): string {
  const trigger = triggers.find(t => t.key === item.automation.trigger_type)
  const names = item.actions
    .map(a => actions.find(d => d.key === a.action_type)?.label ?? a.action_type)
  const unique = [...new Set(names)]
  return `${trigger?.label ?? item.automation.trigger_type} → ${unique.join(', ')}`
}
