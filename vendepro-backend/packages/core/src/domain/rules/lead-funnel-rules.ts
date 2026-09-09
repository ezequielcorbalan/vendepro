import type { LeadPipeline } from '../value-objects/lead-stage'

/**
 * Embudo de conversión de verdad.
 *
 * El widget anterior mostraba en qué etapa está parado cada lead HOY, no por
 * cuántas pasó: un lead captado contaba sólo en "captado" y desaparecía de
 * "nuevo" y "contactado". Por eso el gráfico salía con forma imposible —
 * "contactado" triplicando a "nuevo"— cuando un embudo real sólo puede
 * decrecer.
 *
 * Acá se cuenta cuántos leads **alcanzaron alguna vez** cada etapa, que es la
 * pregunta que el gráfico dice contestar. Y con las fechas de las transiciones
 * salen además los tiempos entre etapas, que es lo que muestra dónde se
 * estanca el pipeline.
 */

/** Etapas del embudo por pipeline: el camino, sin las de cierre. */
const FUNNEL_STAGES: Record<LeadPipeline, Array<{ key: string; label: string }>> = {
  vendedor: [
    { key: 'nuevo', label: 'Nuevo' },
    { key: 'contactado', label: 'Contactado' },
    { key: 'calificado', label: 'Calificado' },
    { key: 'en_tasacion', label: 'En tasación' },
    { key: 'presentada', label: 'Presentada' },
    { key: 'captado', label: 'Captado' },
  ],
  comprador: [
    { key: 'nuevo', label: 'Nuevo' },
    { key: 'contactado', label: 'Contactado' },
    { key: 'calificado', label: 'Calificado' },
    { key: 'visita_agendada', label: 'Visita agendada' },
    { key: 'visito', label: 'Visitó' },
    { key: 'oferta', label: 'Oferta' },
    { key: 'cerrado', label: 'Cerrado' },
  ],
}

/**
 * Etapas que existen en el pipeline pero NO son escalones del embudo.
 *
 * Un escalón de embudo tiene que ser un paso obligado: si se puede saltear, su
 * barra queda por debajo de la siguiente y el gráfico vuelve a tener la forma
 * imposible que veníamos a arreglar.
 *
 * - `asignado` es opcional: `nuevo → contactado` es una transición válida, así
 *   que un lead contactado puede no haber pasado nunca por asignado.
 * - `seguimiento` es un compás de espera al que se entra y se sale desde
 *   varias etapas; ponerlo entre dos daría una caída que no significa nada.
 *
 * Las dos se siguen viendo en la tarjeta "Pipeline de leads", que sí es un
 * conteo por etapa actual y ahí tienen sentido.
 */
const SIDE_STAGES: Record<LeadPipeline, string[]> = {
  vendedor: ['asignado', 'seguimiento'],
  comprador: [],
}

export interface FunnelLead {
  id: string
  stage: string
  created_at: string
}

export interface FunnelHistoryEntry {
  entity_id: string
  to_stage: string
  changed_at: string
}

export interface FunnelStageResult {
  stage: string
  label: string
  /** Leads que alcanzaron esta etapa alguna vez. */
  count: number
  /** Sobre el total de leads del período. */
  pct: number
  /** Sobre los que alcanzaron la etapa anterior — la conversión del paso. */
  step_pct: number
  /**
   * Días medianos desde la etapa anterior. `null` cuando no hay historial
   * suficiente: es preferible no mostrar el dato a mostrar uno inventado.
   */
  median_days_from_prev: number | null
  /** Cuántos leads entraron en esa mediana (para poder desconfiar de un n chico). */
  timed_on: number
}

export interface LeadFunnelResult {
  stages: FunnelStageResult[]
  total: number
  /**
   * Cuántos leads tienen historial de etapas. Los importados de antes no lo
   * tienen, y sin esto el usuario no puede saber si los tiempos representan a
   * su cartera o a una minoría.
   */
  with_history: number
}

/**
 * Lo que pasa DESPUÉS de captar. El pipeline del negocio no termina en
 * "captado": la propiedad se publica, se reserva y se vende. Eso vive en otra
 * entidad, pero no es otra población — `properties.lead_id` recuerda de qué
 * lead salió cada captación, así que se puede seguir a los mismos leads.
 */
const CAPTURE_TAIL_STAGES: Array<{ key: string; label: string }> = [
  { key: 'publicada', label: 'Publicada' },
  { key: 'reservada', label: 'Reservada' },
  { key: 'vendida', label: 'Vendida' },
]

/** Etapa comercial de la propiedad → posición en la escalera de arriba. */
const PROPERTY_STAGE_ORDER: Record<string, number> = {
  propuesta: -1,
  captada: -1,
  documentacion: -1,
  publicada: 0,
  reservada: 1,
  vendida: 2,
}

export interface FunnelProperty {
  id: string
  lead_id: string | null
  commercial_stage: string | null
}

export interface CaptureTailResult {
  stages: FunnelStageResult[]
  /** Leads que llegaron a "captado" — el denominador de esta cola. */
  captured: number
  /**
   * De esos, cuántos tienen una propiedad cargada en el CRM. Sin este número
   * la cola se lee como "no publicamos nada" cuando en realidad la propiedad
   * se cargó suelta, sin vincular al lead que la originó.
   */
  traced: number
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const value = sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0)
  return Math.round(value * 10) / 10
}

function daysBetween(fromIso: string, toIso: string): number | null {
  const from = new Date(fromIso).getTime()
  const to = new Date(toIso).getTime()
  if (Number.isNaN(from) || Number.isNaN(to)) return null
  const days = (to - from) / 86_400_000
  // Una transición hacia atrás en el tiempo es dato sucio, no un tiempo de 0.
  return days >= 0 ? days : null
}

/**
 * Momento en que cada lead alcanzó cada etapa, según el historial. Se queda
 * con el primero: un lead que vuelve a "seguimiento" y avanza otra vez no
 * reinicia su reloj.
 */
function buildReachedAt(history: FunnelHistoryEntry[]): Map<string, Map<string, string>> {
  const byLead = new Map<string, Map<string, string>>()
  for (const entry of history) {
    let stages = byLead.get(entry.entity_id)
    if (!stages) { stages = new Map(); byLead.set(entry.entity_id, stages) }
    const current = stages.get(entry.to_stage)
    if (!current || entry.changed_at < current) stages.set(entry.to_stage, entry.changed_at)
  }
  return byLead
}

/**
 * @param leads Leads del período y pipeline ya filtrados.
 * @param history Transiciones de esos leads (puede venir incompleta).
 */
export function computeRealLeadFunnel(
  leads: FunnelLead[],
  history: FunnelHistoryEntry[],
  pipeline: LeadPipeline = 'vendedor',
): LeadFunnelResult {
  const funnelStages = FUNNEL_STAGES[pipeline]
  const sideStages = SIDE_STAGES[pipeline]
  const order = new Map(funnelStages.map((s, i) => [s.key, i]))
  const reachedAt = buildReachedAt(history)

  // Etapa alcanzada por cada lead, y cuándo.
  const reachedByStage = new Map<string, Set<string>>()
  const timestampsByLead = new Map<string, Map<string, string>>()

  for (const lead of leads) {
    const fromHistory = reachedAt.get(lead.id) ?? new Map<string, string>()
    const stamps = new Map(fromHistory)

    // Todo lead nace en "nuevo", tenga o no una fila de historial.
    if (!stamps.has('nuevo')) stamps.set('nuevo', lead.created_at)

    // Relleno para los leads sin historial (los importados): si hoy está en
    // una etapa del camino, necesariamente pasó por todas las anteriores. No
    // se aplica a las etapas de cierre —perdido, inválido— porque desde ahí
    // no se puede afirmar hasta dónde había llegado.
    const currentIndex = order.get(lead.stage)
    if (currentIndex !== undefined) {
      for (let i = 0; i <= currentIndex; i++) {
        const key = funnelStages[i]?.key
        if (key && !stamps.has(key)) stamps.set(key, '')
      }
    }
    // Una etapa lateral (seguimiento) prueba que llegó hasta ahí, pero no
    // dice cuánto avanzó después: sólo confirma las anteriores por historial.
    if (sideStages.includes(lead.stage) && !stamps.has('contactado')) {
      stamps.set('contactado', '')
    }

    timestampsByLead.set(lead.id, stamps)
    for (const stage of stamps.keys()) {
      let set = reachedByStage.get(stage)
      if (!set) { set = new Set(); reachedByStage.set(stage, set) }
      set.add(lead.id)
    }
  }

  const total = leads.length
  const stages: FunnelStageResult[] = funnelStages.map((stage, index) => {
    const count = reachedByStage.get(stage.key)?.size ?? 0
    const prev = index > 0 ? funnelStages[index - 1] : null
    const prevCount = prev ? (reachedByStage.get(prev.key)?.size ?? 0) : count

    // Tiempos: sólo con fechas reales en ambos extremos.
    const durations: number[] = []
    if (prev) {
      for (const stamps of timestampsByLead.values()) {
        const from = stamps.get(prev.key)
        const to = stamps.get(stage.key)
        if (!from || !to) continue
        const days = daysBetween(from, to)
        if (days !== null) durations.push(days)
      }
    }

    return {
      stage: stage.key,
      label: stage.label,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
      step_pct: prevCount > 0 ? Math.round((count / prevCount) * 100) : 0,
      median_days_from_prev: median(durations),
      timed_on: durations.length,
    }
  })

  return {
    stages,
    total,
    with_history: new Set(history.map(h => h.entity_id)).size,
  }
}

/**
 * Continúa el embudo más allá de "captado", siguiendo la propiedad que salió
 * de cada lead captado.
 *
 * Mismo criterio que el embudo de leads: cuenta las etapas que la propiedad
 * ALCANZÓ alguna vez, no dónde está parada. Una propiedad vendida cuenta
 * también en publicada y reservada, aunque nadie haya registrado esos pasos.
 *
 * @param capturedLeadIds Leads que llegaron a "captado".
 * @param properties      Propiedades de la org (se filtran por lead_id acá).
 * @param history         Transiciones de esas propiedades.
 */
export function computeCaptureTail(
  capturedLeadIds: Set<string>,
  properties: FunnelProperty[],
  history: FunnelHistoryEntry[],
): CaptureTailResult {
  const captured = capturedLeadIds.size

  // Sólo las propiedades que nacieron de un lead captado del período. Una
  // propiedad cargada suelta no pertenece a esta cohorte y sumarla sería
  // exactamente el error que el embudo viejo cometía: mezclar poblaciones.
  const traced = properties.filter(p => p.lead_id && capturedLeadIds.has(p.lead_id))
  const reachedAt = buildReachedAt(history)

  const reachedByStage = new Map<string, Set<string>>()
  const timestampsByProperty = new Map<string, Map<string, string>>()

  for (const property of traced) {
    const stamps = new Map(reachedAt.get(property.id) ?? new Map<string, string>())

    // Relleno por etapa actual: una propiedad vendida pasó por publicada y
    // reservada aunque el historial no lo tenga (las importadas no lo tienen).
    // Las etapas de cierre —perdida, vencida, suspendida— no infieren nada.
    const currentIndex = PROPERTY_STAGE_ORDER[property.commercial_stage ?? '']
    if (currentIndex !== undefined && currentIndex >= 0) {
      for (let i = 0; i <= currentIndex; i++) {
        const key = CAPTURE_TAIL_STAGES[i]?.key
        if (key && !stamps.has(key)) stamps.set(key, '')
      }
    }

    timestampsByProperty.set(property.id, stamps)
    for (const stage of stamps.keys()) {
      if (PROPERTY_STAGE_ORDER[stage] === undefined || PROPERTY_STAGE_ORDER[stage]! < 0) continue
      let set = reachedByStage.get(stage)
      if (!set) { set = new Set(); reachedByStage.set(stage, set) }
      set.add(property.id)
    }
  }

  const stages: FunnelStageResult[] = CAPTURE_TAIL_STAGES.map((stage, index) => {
    const count = reachedByStage.get(stage.key)?.size ?? 0
    // El primer escalón se compara contra los leads captados; los demás
    // contra el escalón anterior.
    const prev = index > 0 ? CAPTURE_TAIL_STAGES[index - 1] : null
    const prevCount = prev ? (reachedByStage.get(prev.key)?.size ?? 0) : captured

    const durations: number[] = []
    if (prev) {
      for (const stamps of timestampsByProperty.values()) {
        const from = stamps.get(prev.key)
        const to = stamps.get(stage.key)
        if (!from || !to) continue
        const days = daysBetween(from, to)
        if (days !== null) durations.push(days)
      }
    }

    return {
      stage: stage.key,
      label: stage.label,
      count,
      // Sobre los leads captados: "de los que captamos, cuántos se vendieron".
      pct: captured > 0 ? Math.round((count / captured) * 100) : 0,
      step_pct: prevCount > 0 ? Math.round((count / prevCount) * 100) : 0,
      median_days_from_prev: median(durations),
      timed_on: durations.length,
    }
  })

  return { stages, captured, traced: traced.length }
}
