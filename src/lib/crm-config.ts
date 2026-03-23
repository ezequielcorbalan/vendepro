// ============================================================
// CRM CONFIG CENTRALIZADO
// Fuente única de verdad para stages, tipos, colores, labels
// Todos los módulos importan de acá
// ============================================================

// ── LEAD STAGES ──────────────────────────────────────────────
export const LEAD_STAGES = {
  nuevo:       { label: 'Nuevo',        color: 'bg-blue-100 text-blue-800',     order: 1 },
  asignado:    { label: 'Asignado',     color: 'bg-indigo-100 text-indigo-800', order: 2 },
  contactado:  { label: 'Contactado',   color: 'bg-cyan-100 text-cyan-800',     order: 3 },
  calificado:  { label: 'Calificado',   color: 'bg-emerald-100 text-emerald-800', order: 4 },
  seguimiento: { label: 'Seguimiento',  color: 'bg-yellow-100 text-yellow-800', order: 5 },
  en_tasacion: { label: 'En tasación',  color: 'bg-purple-100 text-purple-800', order: 6 },
  presentada:  { label: 'Presentada',   color: 'bg-pink-100 text-pink-800',     order: 7 },
  captado:     { label: 'Captado',      color: 'bg-green-100 text-green-800',   order: 8 },
  perdido:     { label: 'Perdido',      color: 'bg-red-100 text-red-800',       order: 9 },
} as const

export type LeadStage = keyof typeof LEAD_STAGES
export const LEAD_STAGE_KEYS = Object.keys(LEAD_STAGES) as LeadStage[]
export const LEAD_PIPELINE_STAGES = LEAD_STAGE_KEYS.filter(s => s !== 'perdido')

// ── ACTIVITY TYPES ───────────────────────────────────────────
export const ACTIVITY_TYPES = {
  llamada:           { label: 'Llamada',              icon: 'Phone',           color: 'text-blue-600 bg-blue-50' },
  whatsapp:          { label: 'WhatsApp',             icon: 'MessageCircle',   color: 'text-green-600 bg-green-50' },
  reunion:           { label: 'Reunión',              icon: 'Users',           color: 'text-purple-600 bg-purple-50' },
  visita_captacion:  { label: 'Visita captación',     icon: 'Home',            color: 'text-orange-600 bg-orange-50' },
  visita_comprador:  { label: 'Visita comprador',     icon: 'Eye',             color: 'text-teal-600 bg-teal-50' },
  tasacion:          { label: 'Tasación',             icon: 'Calculator',      color: 'text-pink-600 bg-pink-50' },
  presentacion:      { label: 'Presentación',         icon: 'Presentation',    color: 'text-indigo-600 bg-indigo-50' },
  seguimiento:       { label: 'Seguimiento',          icon: 'Clock',           color: 'text-yellow-600 bg-yellow-50' },
  documentacion:     { label: 'Documentación',        icon: 'FileText',        color: 'text-gray-600 bg-gray-50' },
  admin:             { label: 'Administrativa',       icon: 'Settings',        color: 'text-slate-600 bg-slate-50' },
  cierre:            { label: 'Cierre',               icon: 'CheckCircle2',    color: 'text-emerald-600 bg-emerald-50' },
} as const

export type ActivityType = keyof typeof ACTIVITY_TYPES
export const ACTIVITY_TYPE_KEYS = Object.keys(ACTIVITY_TYPES) as ActivityType[]

// ── CALENDAR EVENT TYPES ─────────────────────────────────────
export const EVENT_TYPES = {
  llamada:          { label: 'Llamada',          color: 'text-blue-700 bg-blue-100',    icon: 'Phone' },
  reunion:          { label: 'Reunión',          color: 'text-purple-700 bg-purple-100', icon: 'Users' },
  visita_captacion: { label: 'Visita captación', color: 'text-orange-700 bg-orange-100', icon: 'Home' },
  visita_comprador: { label: 'Visita comprador', color: 'text-teal-700 bg-teal-100',    icon: 'Eye' },
  tasacion:         { label: 'Tasación',         color: 'text-pink-700 bg-pink-100',     icon: 'Calculator' },
  seguimiento:      { label: 'Seguimiento',      color: 'text-yellow-700 bg-yellow-100', icon: 'Clock' },
  admin:            { label: 'Administrativa',   color: 'text-gray-700 bg-gray-100',     icon: 'Settings' },
  firma:            { label: 'Firma',            color: 'text-emerald-700 bg-emerald-100', icon: 'PenTool' },
  otro:             { label: 'Otro',             color: 'text-slate-700 bg-slate-100',   icon: 'Calendar' },
} as const

export type EventType = keyof typeof EVENT_TYPES

// ── LEAD SOURCES ─────────────────────────────────────────────
export const LEAD_SOURCES = {
  zonaprop:    { label: 'ZonaProp' },
  argenprop:   { label: 'ArgenProp' },
  mercadolibre:{ label: 'MercadoLibre' },
  instagram:   { label: 'Instagram' },
  facebook:    { label: 'Facebook' },
  google:      { label: 'Google' },
  referido:    { label: 'Referido' },
  cartel:      { label: 'Cartel' },
  telefono:    { label: 'Teléfono' },
  manual:      { label: 'Carga manual' },
  otro:        { label: 'Otro' },
} as const

// ── OPERATION TYPES ──────────────────────────────────────────
export const OPERATION_TYPES = {
  venta:     { label: 'Venta' },
  alquiler:  { label: 'Alquiler' },
  tasacion:  { label: 'Tasación' },
  otro:      { label: 'Otro' },
} as const

// ── OBJECTIVE METRICS ────────────────────────────────────────
export const OBJECTIVE_METRICS = {
  llamadas:    { label: 'Llamadas',    activityType: 'llamada' },
  reuniones:   { label: 'Reuniones',   activityType: 'reunion' },
  visitas:     { label: 'Visitas',     activityType: 'visita_captacion' },
  tasaciones:  { label: 'Tasaciones',  activityType: 'tasacion' },
  captaciones: { label: 'Captaciones', activityType: null },
  cierres:     { label: 'Cierres',     activityType: 'cierre' },
} as const

export type ObjectiveMetric = keyof typeof OBJECTIVE_METRICS

// ── PERIOD TYPES ─────────────────────────────────────────────
export const PERIOD_TYPES = {
  weekly:    { label: 'Semanal' },
  monthly:   { label: 'Mensual' },
  quarterly: { label: 'Trimestral' },
  yearly:    { label: 'Anual' },
} as const

// ── LEAD CHECKLIST (automático) ──────────────────────────────
// Se calcula en base a los campos del lead — no es manual
export function getLeadChecklist(lead: any) {
  return {
    contacto:      !!(lead.phone || lead.email),
    necesidad:     !!(lead.notes && lead.notes.length > 5),
    operacion:     !!(lead.operation && lead.operation !== ''),
    presupuesto:   !!(lead.estimated_value || lead.budget),
    zona:          !!(lead.neighborhood || lead.property_address),
    proxima_accion:!!(lead.next_step),
  }
}

export function getLeadChecklistScore(lead: any): number {
  const cl = getLeadChecklist(lead)
  const total = Object.values(cl).filter(Boolean).length
  return Math.round((total / 6) * 100)
}

// ── URGENCY HELPERS ──────────────────────────────────────────
export function getLeadUrgency(lead: any): 'ok' | 'warning' | 'danger' | 'lost' {
  if (lead.stage === 'perdido') return 'lost'

  const now = new Date()
  const updated = lead.updated_at ? new Date(lead.updated_at) : new Date(lead.created_at)
  const diffH = (now.getTime() - updated.getTime()) / (1000 * 60 * 60)

  if (lead.stage === 'nuevo' && diffH > 24) return 'danger'
  if (diffH > 168) return 'danger'  // 7 days
  if (diffH > 72) return 'warning'  // 3 days
  return 'ok'
}

export function getUrgencyBadge(urgency: 'ok' | 'warning' | 'danger' | 'lost') {
  switch (urgency) {
    case 'danger':  return { text: 'URGENTE', class: 'bg-red-100 text-red-700' }
    case 'warning': return { text: 'Atención', class: 'bg-yellow-100 text-yellow-700' }
    case 'lost':    return { text: 'Perdido', class: 'bg-gray-100 text-gray-500' }
    default:        return null
  }
}
