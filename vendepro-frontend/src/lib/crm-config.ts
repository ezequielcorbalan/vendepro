// ============================================================
// CRM CONFIG CENTRALIZADO
// Fuente única de verdad para stages, tipos, colores, labels
// ============================================================

// Cada etapa define su tono canónico en 3 representaciones derivadas del MISMO
// color: `color` (badge Tailwind), `dot` (hex del punto del timeline) y `border`
// (borde izquierdo de la card). No definir estos colores en ningún otro archivo:
// las pantallas leen de acá vía getStageConfig / getStageDot / getStageBorder.
// OJO — dos etapas del pipeline vendedor tienen clave y label distintos, a
// propósito. Las claves son las del backend (`lead-stage.ts`) y no se tocan
// porque están en `leads.stage`, `stage_history` y las políticas de sync:
//   · `perdido`    → "No captado": el caso real es "tasé y no capté", y esos
//     leads se recontactan a los 30/120 días (automatización
//     `recontacto_no_captado`), no se tiran.
//   · `finalizado` → "Vendido": no es un cierre manual, lo pone el sync cuando
//     la propiedad captada se vende. "Finalizado" se confundía con "Perdido".
export const LEAD_STAGES = {
  nuevo:       { label: 'Nuevo',        color: 'bg-blue-100 text-blue-800',       dot: '#3b82f6', border: 'border-l-blue-400',    order: 1 },
  asignado:    { label: 'Asignado',     color: 'bg-indigo-100 text-indigo-800',   dot: '#6366f1', border: 'border-l-indigo-400',  order: 2 },
  contactado:  { label: 'Contactado',   color: 'bg-cyan-100 text-cyan-800',       dot: '#06b6d4', border: 'border-l-cyan-400',    order: 3 },
  calificado:  { label: 'Calificado',   color: 'bg-emerald-100 text-emerald-800', dot: '#10b981', border: 'border-l-emerald-400', order: 4 },
  en_tasacion: { label: 'En tasación',  color: 'bg-purple-100 text-purple-800',   dot: '#a855f7', border: 'border-l-purple-400',  order: 5 },
  presentada:  { label: 'Presentada',   color: 'bg-pink-100 text-pink-800',       dot: '#ec4899', border: 'border-l-pink-500',    order: 6 },
  seguimiento: { label: 'Seguimiento',  color: 'bg-yellow-100 text-yellow-800',   dot: '#eab308', border: 'border-l-yellow-400',  order: 7 },
  captado:     { label: 'Captado',      color: 'bg-green-100 text-green-800',     dot: '#22c55e', border: 'border-l-green-500',   order: 8 },
  perdido:     { label: 'No captado',   color: 'bg-red-100 text-red-800',         dot: '#ef4444', border: 'border-l-red-400',     order: 9 },
  invalido:    { label: 'Inválido',     color: 'bg-gray-100 text-gray-700',       dot: '#6b7280', border: 'border-l-gray-300',    order: 90 },
  finalizado:  { label: 'Vendido',      color: 'bg-slate-100 text-slate-700',     dot: '#64748b', border: 'border-l-slate-400',   order: 95 },
} as const

export type LeadStage = keyof typeof LEAD_STAGES
export const LEAD_STAGE_KEYS = Object.keys(LEAD_STAGES) as LeadStage[]
export const LEAD_TERMINAL_STAGES: LeadStage[] = ['perdido', 'invalido', 'finalizado']
export const LEAD_AGENT_FINAL_STAGES: LeadStage[] = ['captado', ...LEAD_TERMINAL_STAGES]
export const LEAD_PIPELINE_STAGES = LEAD_STAGE_KEYS.filter(s => !LEAD_TERMINAL_STAGES.includes(s))

// ── RECONTACTO DE "NO CAPTADO" ──────────────────────────────
// Un lead no captado no es basura: el propietario sigue queriendo vender y en
// unos meses puede volver a estar disponible. Al marcarlo, el agente elige
// cuándo retomarlo; la fecha va a `next_step_date` y se ve en la card.
// El recordatorio de calendario lo pone la automatización de la org
// (`recontacto_no_captado`, +30 y +120 días), no esta lista.
export const LEAD_RECONTACT_OPTIONS = [
  { key: '1m',    label: 'En 1 mes',    days: 30 },
  { key: '4m',    label: 'En 4 meses',  days: 120 },
  { key: 'custom',label: 'Otra fecha',  days: null },
  { key: 'none',  label: 'No recontactar', days: null },
] as const

export type LeadRecontactKey = typeof LEAD_RECONTACT_OPTIONS[number]['key']

/** Fecha ISO (yyyy-mm-dd) a `days` días de hoy. Para el modal de "No captado". */
export function recontactDateIn(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ── PIPELINE COMPRADOR ──────────────────────────────────────
// Flujo: nuevo → contactado → calificado → visita_agendada → visito → oferta → cerrado
// Loop operativo: visito ↔ visita_agendada (un comprador visita varias propiedades);
// oferta → visito (oferta caída que sigue buscando).
export const BUYER_LEAD_STAGES = {
  nuevo:           { label: 'Nuevo',           color: 'bg-blue-100 text-blue-800',       dot: '#3b82f6', border: 'border-l-blue-400',   order: 1 },
  contactado:      { label: 'Contactado',      color: 'bg-cyan-100 text-cyan-800',       dot: '#06b6d4', border: 'border-l-cyan-400',   order: 2 },
  calificado:      { label: 'Calificado',      color: 'bg-emerald-100 text-emerald-800', dot: '#10b981', border: 'border-l-emerald-400',order: 3 },
  visita_agendada: { label: 'Visita agendada', color: 'bg-violet-100 text-violet-800',   dot: '#8b5cf6', border: 'border-l-violet-400', order: 4 },
  visito:          { label: 'Visitó',          color: 'bg-purple-100 text-purple-800',   dot: '#a855f7', border: 'border-l-purple-400', order: 5 },
  oferta:          { label: 'Oferta',          color: 'bg-amber-100 text-amber-800',     dot: '#f59e0b', border: 'border-l-amber-400',  order: 6 },
  cerrado:         { label: 'Cerrado',         color: 'bg-green-100 text-green-800',     dot: '#22c55e', border: 'border-l-green-500',  order: 7 },
  perdido:         { label: 'Perdido',         color: 'bg-red-100 text-red-800',         dot: '#ef4444', border: 'border-l-red-400',    order: 9 },
  invalido:        { label: 'Inválido',        color: 'bg-gray-100 text-gray-700',       dot: '#6b7280', border: 'border-l-gray-300',   order: 90 },
} as const

export type BuyerLeadStage = keyof typeof BUYER_LEAD_STAGES
export const BUYER_LEAD_STAGE_KEYS = Object.keys(BUYER_LEAD_STAGES) as BuyerLeadStage[]
export const BUYER_LEAD_TERMINAL_STAGES: BuyerLeadStage[] = ['cerrado', 'perdido', 'invalido']
export const BUYER_LEAD_PIPELINE_STAGES = BUYER_LEAD_STAGE_KEYS.filter(s => s !== 'perdido' && s !== 'invalido')

export type LeadPipelineKey = 'vendedor' | 'comprador'

// Espejo de BUYER_MANUAL_TRANSITIONS del backend (lead-stage.ts).
// IMPORTANTE: mantener sincronizado con el backend si cambian las transiciones.
export const BUYER_LEAD_FORWARD_TRANSITIONS: Record<BuyerLeadStage, BuyerLeadStage[]> = {
  nuevo:           ['contactado', 'invalido', 'perdido'],
  contactado:      ['calificado', 'invalido', 'perdido'],
  calificado:      ['visita_agendada', 'invalido', 'perdido'],
  visita_agendada: ['visito', 'invalido', 'perdido'],
  visito:          ['visita_agendada', 'oferta', 'invalido', 'perdido'],
  oferta:          ['cerrado', 'visito', 'invalido', 'perdido'],
  cerrado:         [],
  invalido:        [],
  perdido:         [],
}

/** Config de stages del pipeline pedido (badge/chips/kanban/stepper). */
export function getStagesForPipeline(pipeline: LeadPipelineKey) {
  if (pipeline === 'comprador') {
    return {
      config: BUYER_LEAD_STAGES as Record<string, StageConfig>,
      keys: BUYER_LEAD_STAGE_KEYS as string[],
      pipelineStages: BUYER_LEAD_PIPELINE_STAGES as string[],
      terminalStages: BUYER_LEAD_TERMINAL_STAGES as string[],
    }
  }
  return {
    config: LEAD_STAGES as Record<string, StageConfig>,
    keys: LEAD_STAGE_KEYS as string[],
    pipelineStages: LEAD_PIPELINE_STAGES as string[],
    terminalStages: LEAD_TERMINAL_STAGES as string[],
  }
}

type StageConfig = { label: string; color: string; dot: string; border: string; order: number }
const STAGE_FALLBACK: StageConfig = { label: '', color: 'bg-gray-100 text-gray-600', dot: '#9ca3af', border: 'border-l-gray-300', order: 0 }

/** Config de un stage según el pipeline del lead (fallback gris si es desconocido). */
export function getStageConfig(stage: string, pipeline?: string | null): StageConfig {
  const cfg = pipeline === 'comprador'
    ? (BUYER_LEAD_STAGES as Record<string, StageConfig>)[stage]
    : (LEAD_STAGES as Record<string, StageConfig>)[stage]
  return cfg ?? { ...STAGE_FALLBACK, label: stage }
}

/** Config mergeada (vendedor ∪ comprador) para lookups sin contexto de pipeline,
 * p. ej. el timeline de stage_history. Las claves compartidas tienen el mismo color. */
function getMergedStageConfig(stage: string): StageConfig | undefined {
  return (LEAD_STAGES as Record<string, StageConfig>)[stage]
    ?? (BUYER_LEAD_STAGES as Record<string, StageConfig>)[stage]
}

/** Color hex del punto (dot) del timeline por etapa. Fuente única. */
export function getStageDot(stage: string): string {
  return getMergedStageConfig(stage)?.dot ?? STAGE_FALLBACK.dot
}

/** Clase del borde izquierdo de la card por etapa. Fuente única. */
export function getStageBorder(stage: string): string {
  return getMergedStageConfig(stage)?.border ?? STAGE_FALLBACK.border
}

/**
 * Label de una etapa cualquiera —lead o propiedad— sin saber de qué entidad es.
 * Para pantallas genéricas (automatizaciones) que reciben la clave pelada desde
 * la API. Antes esas pantallas prettificaban la clave (`no_captado` → "No
 * captado") y eso se rompe apenas clave y label divergen, como en `perdido` →
 * "No captado" o `finalizado` → "Vendido".
 */
export function getAnyStageLabel(stage: string): string {
  const cfg = getMergedStageConfig(stage) ?? (PROPERTY_STAGES as Record<string, { label: string }>)[stage]
  if (cfg?.label) return cfg.label
  const withSpaces = stage.replace(/_/g, ' ')
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1)
}

// Paleta categórica única para gráficos (funnels, barras). Alineada a los tonos
// del pipeline: cada color coincide con el dot de la etapa correspondiente
// (nuevo → contactado → calificado → en_tasación → presentada → seguimiento →
// captado), así el azul del gráfico es el mismo azul del badge "nuevo".
export const CHART_PALETTE = ['#3b82f6', '#06b6d4', '#10b981', '#a855f7', '#ec4899', '#eab308', '#22c55e'] as const

// ── LEAD PROPERTIES (propiedades de interés de un comprador) ──
export const LEAD_PROPERTY_STATUSES = {
  interesado:      { label: 'Interesado',      color: 'bg-blue-100 text-blue-800' },
  visita_agendada: { label: 'Visita agendada', color: 'bg-violet-100 text-violet-800' },
  visitada:        { label: 'Visitada',        color: 'bg-purple-100 text-purple-800' },
  descartada:      { label: 'Descartada',      color: 'bg-gray-100 text-gray-600' },
  oferto:          { label: 'Ofertó',          color: 'bg-amber-100 text-amber-800' },
} as const

export type LeadPropertyStatus = keyof typeof LEAD_PROPERTY_STATUSES

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
export function canMoveLeadStageManually(from: string, to: string, pipeline: LeadPipelineKey = 'vendedor'): boolean {
  if (from === to) return false
  const { config } = getStagesForPipeline(pipeline)
  const fromOrder = config[from]?.order ?? 0
  const toOrder = config[to]?.order ?? 0
  if (toOrder < fromOrder) return true
  const forward = pipeline === 'comprador'
    ? (BUYER_LEAD_FORWARD_TRANSITIONS as Record<string, string[]>)[from]
    : (LEAD_FORWARD_TRANSITIONS as Record<string, string[]>)[from]
  return forward?.includes(to) ?? false
}

export const DEFAULT_TAGS = {
  propietario: { label: 'Propietario', color: '#ec4899' },
  comprador:   { label: 'Comprador',   color: '#3b82f6' },
  inversor:    { label: 'Inversor',    color: '#f59e0b' },
  aliado:      { label: 'Aliado',      color: '#10b981' },
} as const

// Marcadores de un lead — NO son etapas del pipeline, son hechos que se
// muestran como pill al lado del nombre. Estaban hardcodeados en la lista de
// leads (pill morada "Tasación").
// Urgencia de una notificación. Estaba hardcodeada en NotificationBell con
// red/yellow/blue sueltos; los tonos son de dominio y viven acá.
// ── Tasaciones ───────────────────────────────────────────────────────
// Estaba como mapa local en app/(dashboard)/tasaciones/page.tsx, así que la
// ficha del detalle no mostraba el estado: no tenía de dónde leerlo.
export const APPRAISAL_STATUSES = {
  draft:     { label: 'Borrador', color: 'bg-gray-100 text-gray-700' },
  generated: { label: 'Generada', color: 'bg-blue-100 text-blue-800' },
  sent:      { label: 'Enviada',  color: 'bg-green-100 text-green-800' },
} as const

// Origen de un cierre real (propiedades vendidas). Estaba inline en
// app/(dashboard)/tasaciones/vendidas con pink/blue/amber sueltos.
export const SOLD_ORIGINS = {
  mine:     { label: 'Mías',     color: 'bg-primary/10 text-primary' },
  team:     { label: 'Equipo',   color: 'bg-blue-100 text-blue-800' },
  external: { label: 'Externos', color: 'bg-gray-100 text-gray-700' },
} as const

export function getSoldOrigin(origin?: string | null) {
  return SOLD_ORIGINS[origin as keyof typeof SOLD_ORIGINS] ?? SOLD_ORIGINS.external
}

// Alcance de un template de tasación: de quién es y quién lo puede editar.
// El mapa estaba inline en admin/TemplatesHome con pink/purple/blue sueltos.
export const TEMPLATE_SCOPES = {
  sistema:      { label: 'Sistema',      color: 'bg-gray-100 text-gray-700' },
  propio:       { label: 'Mío',          color: 'bg-primary/10 text-primary' },
  agente:       { label: 'Agente',       color: 'bg-purple-100 text-purple-800' },
  organizacion: { label: 'Organización', color: 'bg-blue-100 text-blue-800' },
} as const

export type TemplateScope = keyof typeof TEMPLATE_SCOPES

export function getTemplateScope(t: { is_system?: boolean; agent_id?: string | null }, currentUserId?: string): TemplateScope {
  if (t.is_system) return 'sistema'
  if (!t.agent_id) return 'organizacion'
  return t.agent_id === currentUserId ? 'propio' : 'agente'
}

export function getAppraisalStatus(status?: string | null) {
  return APPRAISAL_STATUSES[status as keyof typeof APPRAISAL_STATUSES] ?? APPRAISAL_STATUSES.draft
}

export const URGENCY_TONES = {
  high:   { icon: 'text-danger',  title: 'text-danger font-medium' },
  medium: { icon: 'text-warning', title: 'text-gray-700' },
  low:    { icon: 'text-info',    title: 'text-gray-700' },
} as const

export type UrgencyLevel = keyof typeof URGENCY_TONES

// Color del ícono de cada tipo de entidad en la búsqueda global. Estaba
// hardcodeado con pink/blue/green sueltos en GlobalSearch.
export const SEARCH_ENTITY_TONES = {
  lead: 'text-primary',
  contact: 'text-info',
  property: 'text-success',
} as const

// ── Ficha de visita ──────────────────────────────────────────────
// Estaba duplicado en tres archivos (components/properties/VisitFormsSection,
// app/r/[slug] y app/v/[slug]), cada uno con sus propias labels y colores.
export const VISIT_BUY_INTENTIONS = {
  compraria: { label: 'Compraría',    tone: 'success' as const },
  tal_vez:   { label: 'Tal vez',      tone: 'warning' as const },
  no:        { label: 'No compraría', tone: 'danger'  as const },
} as const

export type VisitBuyIntention = keyof typeof VISIT_BUY_INTENTIONS

export const VISIT_SITUATIONS: Record<string, string> = {
  mudanza: 'Mudanza',
  primera_vivienda: 'Primera vivienda',
  inversion: 'Inversión',
  downsizing: 'Downsizing',
  otro: 'Otros',
}

export const VISIT_SOURCES: Record<string, string> = {
  argenprop: 'Argenprop',
  mercadolibre: 'Mercado Libre',
  zonaprop: 'Zonaprop',
  instagram: 'Instagram',
  recomendacion: 'Recomendación',
  otro: 'Otros',
}

// Frescura del último reporte de una propiedad. Estaba hardcodeado con
// orange/yellow sueltos en PropertyFilters (badge y texto).
export const REPORT_FRESHNESS = {
  overdue: { badge: 'bg-orange-100 text-orange-800', text: 'text-orange-600 font-medium' },
  warning: { badge: 'bg-yellow-100 text-yellow-800', text: 'text-yellow-700' },
} as const

// Estado de una landing. Estaba en un StatusBadge LOCAL de components/landings
// que le hacía sombra al del design system.
export const LANDING_STATUSES = {
  draft:          { label: 'Borrador',    color: 'bg-gray-100 text-gray-700' },
  pending_review: { label: 'En revisión', color: 'bg-amber-100 text-amber-800' },
  published:      { label: 'Publicada',   color: 'bg-emerald-100 text-emerald-800' },
  archived:       { label: 'Archivada',   color: 'bg-gray-200 text-gray-500' },
} as const

export const LEAD_FLAGS = {
  tasacion: { label: 'Tasación', color: 'bg-purple-100 text-purple-800' },
} as const

export type LeadFlag = keyof typeof LEAD_FLAGS

export const PROPERTY_STAGES = {
  propuesta:     { label: 'Propuesta',       color: 'bg-gray-100 text-gray-700',       dot: '#6b7280', order: 0 },
  captada:       { label: 'Captada',         color: 'bg-green-100 text-green-800',     dot: '#22c55e', order: 1 },
  publicada:     { label: 'Publicada',       color: 'bg-blue-100 text-blue-800',       dot: '#3b82f6', order: 2 },
  reservada:     { label: 'Reservada',       color: 'bg-purple-100 text-purple-800',   dot: '#a855f7', order: 3 },
  suspendida:    { label: 'Suspendida',      color: 'bg-orange-100 text-orange-800',   dot: '#f97316', order: 4 },
  vendida:       { label: 'Vendida',         color: 'bg-emerald-100 text-emerald-800', dot: '#10b981', order: 5 },
  perdida:       { label: 'Perdida',         color: 'bg-red-100 text-red-800',         dot: '#ef4444', order: 6 },
  invalida:      { label: 'Inválida',        color: 'bg-gray-100 text-gray-700',       dot: '#6b7280', order: 7 },
  vencida:       { label: 'Vencida',         color: 'bg-red-100 text-red-800',         dot: '#ef4444', order: 8 },
  archivada:     { label: 'Archivada',       color: 'bg-gray-100 text-gray-500',       dot: '#9ca3af', order: 9 },
  documentacion: { label: 'Documentación',   color: 'bg-amber-100 text-amber-800',     dot: '#f59e0b', order: 99 },
} as const

export type PropertyStage = keyof typeof PROPERTY_STAGES
export const PROPERTY_STAGE_KEYS = Object.keys(PROPERTY_STAGES) as PropertyStage[]

// Agrupamientos UI (no son stages del backend)
export const ACTIVE_PROPERTY_STAGES: PropertyStage[] = ['captada', 'documentacion', 'publicada', 'reservada']
export const PROPOSED_PROPERTY_STAGES: PropertyStage[] = ['propuesta']
export const FINAL_PROPERTY_STAGES: PropertyStage[] = ['vendida', 'perdida', 'invalida', 'archivada']
export const PAUSED_PROPERTY_STAGES: PropertyStage[] = ['suspendida', 'vencida']

// Estado de un reporte de propiedad (fuente única — antes duplicado entre el
// detalle de reportes de una propiedad y el listado general).
export const PROPERTY_REPORT_STATUS: Record<string, { label: string; color: string }> = {
  published: { label: 'Publicado', color: 'bg-green-100 text-green-800' },
  draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-600' },
}
export function getReportStatus(status?: string) {
  return PROPERTY_REPORT_STATUS[status ?? ''] ?? { label: status || '—', color: 'bg-amber-100 text-amber-800' }
}

// Origen de una propiedad — de dónde vino el registro. Sólo se muestra badge
// cuando NO es carga manual. Estaba hardcodeado en el detalle de propiedad.
export const PROPERTY_SOURCES: Record<string, { label: string; color: string }> = {
  kiteprop: { label: 'Importada de KiteProp', color: 'bg-indigo-50 text-indigo-600 border border-indigo-100' },
}
export function getPropertySource(source?: string | null) {
  return source ? PROPERTY_SOURCES[source] ?? null : null
}

// Estados de propiedad que NO viven en el pipeline de venta (PROPERTY_STAGES):
// alquiler es un flujo aparte, con su propia lista. Estaba hardcodeado como
// span cyan en /alquiladas.
export const PROPERTY_ALT_STATUSES: Record<string, { label: string; color: string }> = {
  alquilada: { label: 'Alquilada', color: 'bg-cyan-100 text-cyan-800' },
}

// Etapas viejas que siguen viniendo de la base. Vivía como mapa local en
// app/(dashboard)/propiedades/[id], así que cualquier otra pantalla que mostrara
// una etapa legacy caía al fallback gris.
const LEGACY_STAGE_ALIASES: Record<string, PropertyStage> = {
  captacion: 'captada',
  con_ofertas: 'reservada',
}

export function resolvePropertyStage(slug: string): PropertyStage {
  return (LEGACY_STAGE_ALIASES[slug] ?? slug) as PropertyStage
}

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
  kiteprop:    { label: 'Integración' },
  manual:      { label: 'Carga manual' },
  otro:        { label: 'Otro' },
} as const

export const OPERATION_TYPES = {
  venta:     { label: 'Venta',     color: 'bg-blue-100 text-blue-800' },
  alquiler:  { label: 'Alquiler',  color: 'bg-cyan-100 text-cyan-800' },
  ambas:     { label: 'Venta o alquiler', color: 'bg-violet-100 text-violet-800' },
  tasacion:  { label: 'Tasación',  color: 'bg-pink-100 text-pink-800' },
  otro:      { label: 'Otro',      color: 'bg-gray-100 text-gray-700' },
} as const
export type OperationType = keyof typeof OPERATION_TYPES

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
  if (lead.stage === 'finalizado' || lead.stage === 'captado' || lead.stage === 'cerrado') return 'ok'
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

/**
 * Badge de urgencia del lead — fuente única (antes duplicada entre la vista de
 * lista y el kanban, con textos y tonos de color distintos). Texto contextual
 * ("Sin contacto 5d") en vez de genérico ("URGENTE"): más útil para priorizar.
 * Color en el mismo patrón -100/-800 que Badge/StageBadge/EventChip.
 */
export function getUrgencyBadge(lead: any): { text: string; color: string } | null {
  const pipeline = lead?.pipeline === 'comprador' ? 'comprador' : 'vendedor'
  const finalStages: readonly string[] = pipeline === 'comprador' ? BUYER_LEAD_TERMINAL_STAGES : LEAD_AGENT_FINAL_STAGES
  if (finalStages.includes(lead.stage)) return null

  const diffH = (Date.now() - new Date(lead.updated_at || lead.created_at).getTime()) / 3600000
  const days = Math.floor(diffH / 24)
  if (lead.stage === 'nuevo' && diffH > 24) return { text: 'Sin asignar +24h', color: 'bg-red-100 text-red-800' }
  if (diffH > 168) return { text: `Sin contacto ${days}d`, color: 'bg-red-100 text-red-800' }
  if (diffH > 72) return { text: `Sin contacto ${days}d`, color: 'bg-yellow-100 text-yellow-800' }
  return null
}

export const USER_ROLES = {
  owner:      { label: 'Dueño',          color: 'bg-yellow-100 text-yellow-800', level: 4 },
  admin:      { label: 'Administrador',  color: 'bg-red-100 text-red-800',       level: 3 },
  supervisor: { label: 'Supervisor',     color: 'bg-purple-100 text-purple-800', level: 2 },
  agent:      { label: 'Agente',         color: 'bg-blue-100 text-blue-800',     level: 1 },
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
