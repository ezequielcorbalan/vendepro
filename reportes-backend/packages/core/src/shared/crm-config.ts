// ============================================================
// CRM CONFIG CENTRALIZADO
// Fuente única de verdad para stages, tipos, colores, labels
// Todos los módulos importan de acá
// ============================================================

// ── LEAD/TASACIÓN PIPELINE ──────────────────────────────────
// Flujo real: nuevo → asignado → contactado → calificado → en_tasación → presentada → seguimiento → captado | perdido
// "seguimiento" va DESPUÉS de presentar la tasación (follow-up post-presentación)
// El pipeline termina en "captado" o "perdido" — lo comercial va en PROPERTY_STAGES
export const LEAD_STAGES = {
  nuevo:       { label: 'Nuevo',        color: 'bg-blue-100 text-blue-800',       order: 1 },
  asignado:    { label: 'Asignado',     color: 'bg-indigo-100 text-indigo-800',   order: 2 },
  contactado:  { label: 'Contactado',   color: 'bg-cyan-100 text-cyan-800',       order: 3 },
  calificado:  { label: 'Calificado',   color: 'bg-emerald-100 text-emerald-800', order: 4 },
  en_tasacion: { label: 'En tasación',  color: 'bg-purple-100 text-purple-800',   order: 5 },
  presentada:  { label: 'Presentada',   color: 'bg-pink-100 text-pink-800',       order: 6 },
  seguimiento: { label: 'Seguimiento',  color: 'bg-yellow-100 text-yellow-800',   order: 7 },
  captado:     { label: 'Captado',      color: 'bg-green-100 text-green-800',     order: 8 },
  perdido:     { label: 'Perdido',      color: 'bg-red-100 text-red-800',         order: 9 },
  archivado:   { label: 'Archivado',   color: 'bg-gray-100 text-gray-500',       order: 10 },
} as const

export type LeadStage = keyof typeof LEAD_STAGES
export const LEAD_STAGE_KEYS = Object.keys(LEAD_STAGES) as LeadStage[]
export const LEAD_PIPELINE_STAGES = LEAD_STAGE_KEYS.filter(s => s !== 'perdido' && s !== 'archivado')

// ── LEAD TAGS (etiquetas) ──────────────────────────────────
export const DEFAULT_TAGS = {
  propietario: { label: 'Propietario', color: '#ec4899' },
  comprador:   { label: 'Comprador',   color: '#3b82f6' },
  inversor:    { label: 'Inversor',    color: '#f59e0b' },
  aliado:      { label: 'Aliado',      color: '#10b981' },
} as const

// ── PIPELINES DINÁMICOS POR TAG ────────────────────────────
// Cada tag tiene su propio pipeline. Si no tiene tag, usa el default (propietario).
export const TAG_PIPELINES: Record<string, LeadStage[]> = {
  propietario: ['nuevo', 'asignado', 'contactado', 'calificado', 'en_tasacion', 'presentada', 'seguimiento', 'captado', 'perdido'],
  comprador:   ['nuevo', 'asignado', 'contactado', 'calificado', 'seguimiento', 'captado', 'perdido'],
  inversor:    ['nuevo', 'contactado', 'calificado', 'seguimiento', 'captado', 'perdido'],
  aliado:      ['nuevo', 'contactado'],  // Aliados no necesitan pipeline comercial
}

export function getPipelineForTag(tagName: string | null): LeadStage[] {
  if (!tagName) return TAG_PIPELINES.propietario
  const key = tagName.toLowerCase()
  return TAG_PIPELINES[key] || TAG_PIPELINES.propietario
}

// Stages que disparan acciones automáticas
export const STAGE_AUTO_ACTIONS = {
  en_tasacion: 'create_appraisal',  // Ofrecer crear tasación vinculada
  presentada:  'create_followup',    // Auto-crear evento de seguimiento
  captado:     'create_property',    // Ofrecer crear propiedad comercial
} as const

// ── PROPERTY COMMERCIAL PIPELINE ────────────────────────────
// Pipeline SEPARADO del lead — arranca cuando se capta la propiedad
// Lead termina en "captado" → se crea propiedad con stage "captada"
export const PROPERTY_STAGES = {
  captada:       { label: 'Captada',        color: 'bg-green-100 text-green-800',     order: 1 },
  publicada:     { label: 'Publicada',      color: 'bg-blue-100 text-blue-800',       order: 2 },
  reservada:     { label: 'Reservada',      color: 'bg-purple-100 text-purple-800',   order: 3 },
  suspendida:    { label: 'Suspendida',     color: 'bg-orange-100 text-orange-800',   order: 4 },
  vendida:       { label: 'Vendida',        color: 'bg-emerald-100 text-emerald-800', order: 5 },
  vencida:       { label: 'Vencida',        color: 'bg-red-100 text-red-800',         order: 6 },
  archivada:     { label: 'Archivada',      color: 'bg-gray-100 text-gray-500',       order: 7 },
  // documentacion se maneja como checklist dentro de la propiedad, no como stage del pipeline
  documentacion: { label: 'Documentación',  color: 'bg-amber-100 text-amber-800',     order: 99 },
} as const

export type PropertyStage = keyof typeof PROPERTY_STAGES
export const PROPERTY_STAGE_KEYS = Object.keys(PROPERTY_STAGES) as PropertyStage[]

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
  llamada:          { label: 'Llamada',          color: 'text-blue-700',    bg: 'bg-blue-100',    icon: 'Phone',         border: '#1d4ed8' },
  reunion:          { label: 'Reunión',          color: 'text-purple-700',  bg: 'bg-purple-100',  icon: 'Users',         border: '#7c3aed' },
  visita_captacion: { label: 'Visita captación', color: 'text-orange-700',  bg: 'bg-orange-100',  icon: 'Home',          border: '#c2410c' },
  visita_comprador: { label: 'Visita comprador', color: 'text-teal-700',    bg: 'bg-teal-100',    icon: 'Eye',           border: '#0f766e' },
  tasacion:         { label: 'Tasación',         color: 'text-pink-700',    bg: 'bg-pink-100',    icon: 'ClipboardList', border: '#be185d' },
  seguimiento:      { label: 'Seguimiento',      color: 'text-yellow-700',  bg: 'bg-yellow-100',  icon: 'RefreshCw',     border: '#a16207' },
  admin:            { label: 'Administrativa',   color: 'text-gray-700',    bg: 'bg-gray-100',    icon: 'FileText',      border: '#374151' },
  firma:            { label: 'Firma',            color: 'text-emerald-700', bg: 'bg-emerald-100', icon: 'FileSignature', border: '#047857' },
  otro:             { label: 'Otro',             color: 'text-slate-700',   bg: 'bg-slate-100',   icon: 'Calendar',      border: '#475569' },
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
  // ── Actividad / Prospección ──
  llamadas:           { label: 'Llamadas',               category: 'actividad',    activityTypes: ['llamada'] },
  reuniones:          { label: 'Reuniones',               category: 'actividad',    activityTypes: ['reunion'] },
  reuniones_verdes:   { label: 'Reuniones verdes',        category: 'actividad',    activityTypes: [] },  // manual count
  visitas:            { label: 'Visitas',                 category: 'actividad',    activityTypes: ['visita_captacion', 'visita_comprador'] },
  seguimientos:       { label: 'Seguimientos',            category: 'actividad',    activityTypes: ['seguimiento'] },
  whatsapps:          { label: 'WhatsApps',               category: 'actividad',    activityTypes: ['whatsapp'] },
  prospeccion_bc:     { label: 'Prospección BC',          category: 'actividad',    activityTypes: ['admin'] },
  pre_listing:        { label: 'Pre Listing',             category: 'actividad',    activityTypes: [] },
  pre_buying:         { label: 'Pre Buying',              category: 'actividad',    activityTypes: [] },
  referidos:          { label: 'Referidos',               category: 'actividad',    activityTypes: [] },
  presentaciones:     { label: 'Presentaciones',          category: 'actividad',    activityTypes: ['presentacion'] },
  // ── Resultados ──
  tasaciones:         { label: 'Tasaciones',              category: 'resultado',    activityTypes: ['tasacion'] },
  captaciones:        { label: 'Captaciones',             category: 'resultado',    activityTypes: [] },
  publicaciones:      { label: 'Publicaciones',           category: 'resultado',    activityTypes: [] },
  reservas:           { label: 'Reservas',                category: 'resultado',    activityTypes: [] },
  cierres:            { label: 'Cierres / Ventas',        category: 'resultado',    activityTypes: ['cierre'] },
  facturacion:        { label: 'Facturación (USD)',        category: 'resultado',    activityTypes: [] },
  ticket_promedio:    { label: 'Ticket promedio (USD)',    category: 'resultado',    activityTypes: [] },
} as const

export type ObjectiveMetric = keyof typeof OBJECTIVE_METRICS

// ── SEMÁFORO DE OBJETIVOS ────────────────────────────────────
export function getObjectiveSemaforo(realized: number, target: number, periodProgressPct: number): {
  level: 'red' | 'orange' | 'yellow' | 'green'; label: string; color: string
} {
  if (target <= 0) return { level: 'green', label: 'Sin objetivo', color: 'bg-gray-100 text-gray-500' }
  const pct = (realized / target) * 100
  // Compare progress vs period progress
  // If we're 50% through the period, we should be at ~50% of target
  const ratio = periodProgressPct > 0 ? pct / periodProgressPct : pct / 100

  if (pct >= 100) return { level: 'green', label: 'Cumplido', color: 'bg-green-100 text-green-700' }
  if (ratio >= 0.8) return { level: 'yellow', label: 'En camino', color: 'bg-yellow-100 text-yellow-700' }
  if (ratio >= 0.5) return { level: 'orange', label: 'Bajo', color: 'bg-orange-100 text-orange-700' }
  return { level: 'red', label: 'Muy bajo', color: 'bg-red-100 text-red-700' }
}

export function getPeriodProgressPct(periodStart: string, periodEnd: string): number {
  const start = new Date(periodStart).getTime()
  const end = new Date(periodEnd).getTime()
  const now = Date.now()
  if (now >= end) return 100
  if (now <= start) return 0
  return Math.round(((now - start) / (end - start)) * 100)
}

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

// ── WHATSAPP HELPER ──────────────────────────────────────────
export function formatWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  // Already has country code (10+ digits starting with valid prefix)
  if (digits.startsWith('54') && digits.length >= 12) return digits
  if (digits.startsWith('+')) return digits
  // Argentine number without country code
  if (digits.length === 10 || digits.length === 11) return `54${digits}`
  return digits
}

export function getUrgencyBadge(urgency: 'ok' | 'warning' | 'danger' | 'lost') {
  switch (urgency) {
    case 'danger':  return { text: 'URGENTE', class: 'bg-red-100 text-red-700' }
    case 'warning': return { text: 'Atención', class: 'bg-yellow-100 text-yellow-700' }
    case 'lost':    return { text: 'Perdido', class: 'bg-gray-100 text-gray-500' }
    default:        return null
  }
}

// ── Roles & Permissions ──────────────────────────────────
export const USER_ROLES = {
  admin:      { label: 'Administrador', color: 'bg-red-100 text-red-700', level: 3 },
  supervisor: { label: 'Supervisor',    color: 'bg-purple-100 text-purple-700', level: 2 },
  agent:      { label: 'Agente',        color: 'bg-blue-100 text-blue-700', level: 1 },
} as const

export type RoleKey = keyof typeof USER_ROLES

// Can this role see all agents' data?
export function canSeeAll(role: string): boolean {
  return role === 'admin' || role === 'owner' || role === 'supervisor'
}

// Can this role manage org settings, create admins, etc?
export function canManageOrg(role: string): boolean {
  return role === 'admin' || role === 'owner'
}

// Can this role create/delete agents?
export function canManageAgents(role: string): boolean {
  return role === 'admin' || role === 'owner'
}

// Can this role set objectives for other agents?
export function canSetObjectives(role: string): boolean {
  return role === 'admin' || role === 'owner' || role === 'supervisor'
}

export function getRoleLabel(role: string): string {
  return (USER_ROLES as any)[role]?.label || role
}

export function getRoleColor(role: string): string {
  return (USER_ROLES as any)[role]?.color || 'bg-gray-100 text-gray-600'
}
