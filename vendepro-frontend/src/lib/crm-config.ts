// ============================================================
// CRM CONFIG CENTRALIZADO
// Fuente única de verdad para stages, tipos, colores, labels
// ============================================================

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
  invalido:    { label: 'Inválido',     color: 'bg-gray-100 text-gray-700',       order: 90 },
  finalizado:  { label: 'Finalizado',   color: 'bg-emerald-100 text-emerald-700', order: 95 },
} as const

export type LeadStage = keyof typeof LEAD_STAGES
export const LEAD_STAGE_KEYS = Object.keys(LEAD_STAGES) as LeadStage[]
export const LEAD_TERMINAL_STAGES: LeadStage[] = ['perdido', 'invalido', 'finalizado']
export const LEAD_AGENT_FINAL_STAGES: LeadStage[] = ['captado', ...LEAD_TERMINAL_STAGES]
export const LEAD_PIPELINE_STAGES = LEAD_STAGE_KEYS.filter(s => !LEAD_TERMINAL_STAGES.includes(s))

// Espejo de MANUAL_TRANSITIONS del backend (lead-stage.ts). Define a qué etapas
// se puede AVANZAR manualmente desde cada una. El movimiento hacia atrás (orden
// menor) siempre se permite como corrección (bypass) y no depende de esta tabla.
// IMPORTANTE: mantener sincronizado con el backend si cambian las transiciones.
export const LEAD_FORWARD_TRANSITIONS: Record<LeadStage, LeadStage[]> = {
  nuevo:       ['asignado', 'contactado', 'invalido', 'perdido'],
  asignado:    ['contactado', 'invalido', 'perdido'],
  contactado:  ['calificado', 'seguimiento', 'invalido', 'perdido'],
  calificado:  ['en_tasacion', 'seguimiento', 'invalido', 'perdido'],
  en_tasacion: ['presentada', 'seguimiento', 'invalido', 'perdido'],
  presentada:  ['captado', 'seguimiento', 'invalido', 'perdido'],
  seguimiento: ['calificado', 'en_tasacion', 'presentada', 'captado', 'invalido', 'perdido'],
  captado:     [],
  invalido:    [],
  finalizado:  [],
  perdido:     [],
}

// ¿Se puede mover manualmente de `from` a `to` desde el pipeline?
// - Hacia atrás (orden menor): siempre (corrección / bypass).
// - Hacia adelante: solo si es una transición válida de la máquina de estados.
export function canMoveLeadStageManually(from: LeadStage, to: LeadStage): boolean {
  if (from === to) return false
  const fromOrder = LEAD_STAGES[from]?.order ?? 0
  const toOrder = LEAD_STAGES[to]?.order ?? 0
  if (toOrder < fromOrder) return true
  return LEAD_FORWARD_TRANSITIONS[from]?.includes(to) ?? false
}

export const DEFAULT_TAGS = {
  propietario: { label: 'Propietario', color: '#ec4899' },
  comprador:   { label: 'Comprador',   color: '#3b82f6' },
  inversor:    { label: 'Inversor',    color: '#f59e0b' },
  aliado:      { label: 'Aliado',      color: '#10b981' },
} as const

export const TAG_PIPELINES: Record<string, LeadStage[]> = {
  propietario: ['nuevo', 'asignado', 'contactado', 'calificado', 'en_tasacion', 'presentada', 'seguimiento', 'captado', 'perdido'],
  comprador:   ['nuevo', 'asignado', 'contactado', 'calificado', 'seguimiento', 'captado', 'perdido'],
  inversor:    ['nuevo', 'contactado', 'calificado', 'seguimiento', 'captado', 'perdido'],
  aliado:      ['nuevo', 'contactado'],
}

export function getPipelineForTag(tagName: string | null): LeadStage[] {
  if (!tagName) return TAG_PIPELINES.propietario
  const key = tagName.toLowerCase()
  return TAG_PIPELINES[key] || TAG_PIPELINES.propietario
}

export const PROPERTY_STAGES = {
  propuesta:     { label: 'Propuesta',       color: 'bg-gray-100 text-gray-700',       order: 0 },
  captada:       { label: 'Captada',         color: 'bg-green-100 text-green-800',     order: 1 },
  publicada:     { label: 'Publicada',       color: 'bg-blue-100 text-blue-800',       order: 2 },
  reservada:     { label: 'Reservada',       color: 'bg-purple-100 text-purple-800',   order: 3 },
  suspendida:    { label: 'Suspendida',      color: 'bg-orange-100 text-orange-800',   order: 4 },
  vendida:       { label: 'Vendida',         color: 'bg-emerald-100 text-emerald-800', order: 5 },
  perdida:       { label: 'Perdida',         color: 'bg-red-100 text-red-700',         order: 6 },
  invalida:      { label: 'Inválida',        color: 'bg-gray-100 text-gray-700',       order: 7 },
  vencida:       { label: 'Vencida',         color: 'bg-red-100 text-red-800',         order: 8 },
  archivada:     { label: 'Archivada',       color: 'bg-gray-100 text-gray-500',       order: 9 },
  documentacion: { label: 'Documentación',   color: 'bg-amber-100 text-amber-800',     order: 99 },
} as const

export type PropertyStage = keyof typeof PROPERTY_STAGES
export const PROPERTY_STAGE_KEYS = Object.keys(PROPERTY_STAGES) as PropertyStage[]

// Agrupamientos UI (no son stages del backend)
export const ACTIVE_PROPERTY_STAGES: PropertyStage[] = ['captada', 'documentacion', 'publicada', 'reservada']
export const PROPOSED_PROPERTY_STAGES: PropertyStage[] = ['propuesta']
export const FINAL_PROPERTY_STAGES: PropertyStage[] = ['vendida', 'perdida', 'invalida', 'archivada']
export const PAUSED_PROPERTY_STAGES: PropertyStage[] = ['suspendida', 'vencida']

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
  kiteprop:    { label: 'KiteProp' },
  manual:      { label: 'Carga manual' },
  otro:        { label: 'Otro' },
} as const

export const OPERATION_TYPES = {
  venta:     { label: 'Venta' },
  alquiler:  { label: 'Alquiler' },
  tasacion:  { label: 'Tasación' },
  otro:      { label: 'Otro' },
} as const

export const OBJECTIVE_METRICS = {
  llamadas:           { label: 'Llamadas',               category: 'actividad',    activityTypes: ['llamada'] },
  reuniones:          { label: 'Reuniones',               category: 'actividad',    activityTypes: ['reunion'] },
  reuniones_verdes:   { label: 'Reuniones verdes',        category: 'actividad',    activityTypes: [] },
  visitas:            { label: 'Visitas',                 category: 'actividad',    activityTypes: ['visita_captacion', 'visita_comprador'] },
  seguimientos:       { label: 'Seguimientos',            category: 'actividad',    activityTypes: ['seguimiento'] },
  whatsapps:          { label: 'WhatsApps',               category: 'actividad',    activityTypes: ['whatsapp'] },
  prospeccion_bc:     { label: 'Prospección BC',          category: 'actividad',    activityTypes: ['admin'] },
  pre_listing:        { label: 'Pre Listing',             category: 'actividad',    activityTypes: [] },
  pre_buying:         { label: 'Pre Buying',              category: 'actividad',    activityTypes: [] },
  referidos:          { label: 'Referidos',               category: 'actividad',    activityTypes: [] },
  presentaciones:     { label: 'Presentaciones',          category: 'actividad',    activityTypes: ['presentacion'] },
  tasaciones:         { label: 'Tasaciones',              category: 'resultado',    activityTypes: ['tasacion'] },
  captaciones:        { label: 'Captaciones',             category: 'resultado',    activityTypes: [] },
  publicaciones:      { label: 'Publicaciones',           category: 'resultado',    activityTypes: [] },
  reservas:           { label: 'Reservas',                category: 'resultado',    activityTypes: [] },
  cierres:            { label: 'Cierres / Ventas',        category: 'resultado',    activityTypes: ['cierre'] },
  facturacion:        { label: 'Facturación (USD)',        category: 'resultado',    activityTypes: [] },
  ticket_promedio:    { label: 'Ticket promedio (USD)',    category: 'resultado',    activityTypes: [] },
} as const

export type ObjectiveMetric = keyof typeof OBJECTIVE_METRICS

export const OBJECTIVE_TEMPLATES = {
  keller: {
    label: 'Método Keller',
    description: 'The Millionaire Real Estate Agent — alto volumen de prospección',
    period: 'monthly' as const,
    metrics: {
      llamadas: 200, reuniones_verdes: 8, visitas: 15,
      seguimientos: 50, prospeccion_bc: 30, pre_listing: 4,
      referidos: 2, tasaciones: 4, captaciones: 2, cierres: 1,
    },
  },
  magnin: {
    label: 'Método Magnin',
    description: 'Prospección sistemática e intensiva — foco en captaciones',
    period: 'monthly' as const,
    metrics: {
      llamadas: 300, reuniones_verdes: 12, visitas: 20,
      seguimientos: 80, prospeccion_bc: 60, pre_listing: 6,
      referidos: 3, tasaciones: 6, captaciones: 3, cierres: 1,
    },
  },
  agenda: {
    label: 'Agenda Productiva',
    description: 'Actividad diaria consistente — equilibrio entre prospección y resultados',
    period: 'monthly' as const,
    metrics: {
      llamadas: 100, reuniones_verdes: 6, visitas: 10,
      seguimientos: 30, prospeccion_bc: 20, pre_listing: 3,
      referidos: 2, tasaciones: 3, captaciones: 2, cierres: 1,
    },
  },
} as const

export type ObjectiveTemplate = keyof typeof OBJECTIVE_TEMPLATES

export const PERIOD_SCALE: Record<string, number> = {
  weekly:    0.25,  // mensual ÷ 4
  monthly:   1,
  quarterly: 3,     // mensual × 3
  yearly:    12,    // mensual × 12
}

export function scaleMetrics(
  metrics: Record<string, number>,
  period: string,
): Record<string, number> {
  const factor = PERIOD_SCALE[period] ?? 1
  const result: Record<string, number> = {}
  for (const [k, v] of Object.entries(metrics)) {
    result[k] = Math.max(1, Math.round(v * factor))
  }
  return result
}

export const PERIOD_TYPES = {
  weekly:    { label: 'Semanal' },
  monthly:   { label: 'Mensual' },
  quarterly: { label: 'Trimestral' },
  yearly:    { label: 'Anual' },
} as const

export function getObjectiveSemaforo(realized: number, target: number, periodProgressPct: number): {
  level: 'red' | 'orange' | 'yellow' | 'green'; label: string; color: string
} {
  if (target <= 0) return { level: 'green', label: 'Sin objetivo', color: 'bg-gray-100 text-gray-500' }
  const pct = (realized / target) * 100
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

export function getLeadUrgency(lead: any): 'ok' | 'warning' | 'danger' | 'lost' {
  if (lead.stage === 'perdido' || lead.stage === 'invalido') return 'lost'
  if (lead.stage === 'finalizado' || lead.stage === 'captado') return 'ok'
  const now = new Date()
  const updated = lead.updated_at ? new Date(lead.updated_at) : new Date(lead.created_at)
  const diffH = (now.getTime() - updated.getTime()) / (1000 * 60 * 60)
  if (lead.stage === 'nuevo' && diffH > 24) return 'danger'
  if (diffH > 168) return 'danger'
  if (diffH > 72) return 'warning'
  return 'ok'
}

export function formatWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('54') && digits.length >= 12) return digits
  if (digits.startsWith('+')) return digits
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

export const USER_ROLES = {
  owner:      { label: 'Dueño',          color: 'bg-yellow-100 text-yellow-700', level: 4 },
  admin:      { label: 'Administrador',  color: 'bg-red-100 text-red-700',       level: 3 },
  supervisor: { label: 'Supervisor',     color: 'bg-purple-100 text-purple-700', level: 2 },
  agent:      { label: 'Agente',         color: 'bg-blue-100 text-blue-700',     level: 1 },
} as const

export type RoleKey = keyof typeof USER_ROLES

export function canSeeAll(role: string): boolean {
  return role === 'admin' || role === 'owner' || role === 'supervisor'
}

export function canManageOrg(role: string): boolean {
  return role === 'admin' || role === 'owner'
}

export function canManageAgents(role: string): boolean {
  return role === 'admin' || role === 'owner'
}

export function canSetObjectives(role: string): boolean {
  return role === 'admin' || role === 'owner' || role === 'supervisor'
}

export function getRoleLabel(role: string): string {
  return (USER_ROLES as any)[role]?.label || role
}

export function getRoleColor(role: string): string {
  return (USER_ROLES as any)[role]?.color || 'bg-gray-100 text-gray-600'
}

// Scopes de los tokens de API de integración. Extensible a futuros endpoints /v1/*.
export const API_SCOPES = {
  'leads:write': { label: 'Importar leads' },
} as const

export type ApiScope = keyof typeof API_SCOPES

// Eventos disponibles para webhooks salientes (Configuración de API → Webhooks).
export const WEBHOOK_EVENTS = {
  'lead.created': {
    label: 'Lead creado',
    description: 'Se dispara al entrar un lead (API, web pública o carga manual)',
  },
  'lead.stage_changed': {
    label: 'Cambio de etapa',
    description: 'Se dispara cuando un lead cambia de etapa en el pipeline',
  },
  'appraisal.created': {
    label: 'Tasación creada',
    description: 'Se dispara al crear una tasación',
  },
} as const

export type WebhookEventKey = keyof typeof WEBHOOK_EVENTS
