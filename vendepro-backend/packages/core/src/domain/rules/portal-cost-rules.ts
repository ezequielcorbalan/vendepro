/**
 * Cruce de gasto de portales contra los leads que trajeron.
 *
 * Es la cuenta que hoy la inmobiliaria hace a ojo: pago X por mes en ZonaProp,
 * me entran Y consultas, ¿cuánto me sale cada una y cuántas terminan en visita?
 *
 * Cuatro reglas que valen más que el cálculo:
 *
 * 1. **El gasto se prorratea por días.** La factura del portal es mensual, pero
 *    el panel muestra "mes a hoy": comparar la factura entera de septiembre
 *    contra 7 días de leads da un costo por lead inflado tres veces. Se toma la
 *    fracción del mes que cae dentro del rango. Es válido porque lo que se paga
 *    es presencia en el portal, que se consume parejo a lo largo del mes.
 * 2. **La tabla incluye las dos mitades sueltas.** Un portal con leads y sin
 *    gasto cargado aparece igual (con el costo vacío y el motivo), y un gasto
 *    cargado contra una fuente que no trajo un solo lead también. Esconder
 *    cualquiera de los dos deja al usuario creyendo que la foto está completa.
 * 3. **Sin cotización no hay costo.** Si el gasto está en pesos y nadie pudo
 *    resolver el dólar, la celda queda vacía con el motivo — no se convierte con
 *    un número inventado ni se muestra un peso al lado de un dólar.
 * 4. **Lo que no se pudo convertir no suma al total**, y se dice cuántas filas
 *    quedaron afuera: un total silenciosamente incompleto es peor que no tenerlo.
 */

export interface PortalSpendRow {
  provider: string
  provider_label?: string | null
  /** 'YYYY-MM' */
  period_month: string
  amount: number
  currency: string
  /** Unidades de `currency` por 1 USD. `null` = pendiente. */
  usd_rate: number | null
}

export interface PortalSpendAggregate {
  provider: string
  label: string | null
  /** Gasto prorrateado y convertido. `null` si ninguna fila tenía cotización. */
  spend_usd: number | null
  /** Meses con gasto cargado que tocan el rango. */
  months: number
  /** De esos, cuántos no se pudieron convertir. */
  months_without_rate: number
  /** true si algún mes entró parcial (el rango no lo cubre entero). */
  prorated: boolean
}

export interface PortalLeadCount {
  provider: string
  leads: number
  /** Leads que llegaron a agendar o hacer una visita. */
  visitas: number
  /** Leads que terminaron en operación cerrada. */
  ganados: number
}

export type PortalCostMissing = 'sin_gasto' | 'sin_cotizacion' | 'sin_leads' | null

export interface PortalCostRow {
  provider: string
  label: string | null
  spend_usd: number | null
  months: number
  months_without_rate: number
  prorated: boolean
  leads: number
  visitas: number
  ganados: number
  cost_per_lead_usd: number | null
  cost_per_visit_usd: number | null
  missing: PortalCostMissing
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate()
}

/** Días del mes `YYYY-MM` que caen dentro de [from, to) — ambos `YYYY-MM-DD`. */
export function monthOverlapDays(month: string, from: string, to: string): number {
  const [y, m] = month.split('-').map(Number)
  const monthStart = Date.UTC(y!, m! - 1, 1)
  const monthEnd = Date.UTC(y!, m!, 1) // exclusivo
  const rangeStart = Date.parse(from)
  const rangeEnd = Date.parse(to)
  if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd)) return 0

  const start = Math.max(monthStart, rangeStart)
  const end = Math.min(monthEnd, rangeEnd)
  if (end <= start) return 0
  return Math.round((end - start) / 86_400_000)
}

/**
 * Agrupa el gasto por portal, prorrateando cada mes por los días que caen
 * dentro del rango y convirtiendo con la cotización congelada de esa fila.
 */
export function aggregateSpendForRange(
  rows: PortalSpendRow[],
  from: string,
  to: string,
): PortalSpendAggregate[] {
  const byProvider = new Map<string, PortalSpendAggregate & { _usd: number; _any: boolean }>()

  for (const r of rows) {
    const overlap = monthOverlapDays(r.period_month, from, to)
    if (overlap === 0) continue

    const total = daysInMonth(r.period_month)
    const fraction = Math.min(overlap / total, 1)

    const entry = byProvider.get(r.provider) ?? {
      provider: r.provider,
      label: r.provider_label ?? null,
      spend_usd: null,
      months: 0,
      months_without_rate: 0,
      prorated: false,
      _usd: 0,
      _any: false,
    }

    entry.months += 1
    if (fraction < 1) entry.prorated = true
    if (r.provider_label && !entry.label) entry.label = r.provider_label

    if (r.usd_rate !== null && r.usd_rate > 0) {
      entry._usd += (r.amount / r.usd_rate) * fraction
      entry._any = true
    } else {
      entry.months_without_rate += 1
    }

    byProvider.set(r.provider, entry)
  }

  return [...byProvider.values()].map(({ _usd, _any, ...rest }) => ({
    ...rest,
    spend_usd: _any ? round2(_usd) : null,
  }))
}

export function computePortalCosts(
  spend: PortalSpendAggregate[],
  leads: PortalLeadCount[],
): PortalCostRow[] {
  const spendByProvider = new Map(spend.map(s => [s.provider, s]))
  const leadsByProvider = new Map(leads.map(l => [l.provider, l]))
  const providers = new Set([...spendByProvider.keys(), ...leadsByProvider.keys()])

  const rows: PortalCostRow[] = []
  for (const provider of providers) {
    const s = spendByProvider.get(provider) ?? null
    const l = leadsByProvider.get(provider) ?? { provider, leads: 0, visitas: 0, ganados: 0 }

    // El motivo se elige por orden de qué le falta primero al usuario: sin
    // gasto cargado no hay nada que hacer, después la cotización, y recién
    // después importa que el portal no haya traído leads.
    const missing: PortalCostMissing =
      s === null ? 'sin_gasto'
      : s.spend_usd === null ? 'sin_cotizacion'
      : l.leads === 0 ? 'sin_leads'
      : null

    const spendUsd = s?.spend_usd ?? null
    rows.push({
      provider,
      label: s?.label ?? null,
      spend_usd: spendUsd,
      months: s?.months ?? 0,
      months_without_rate: s?.months_without_rate ?? 0,
      prorated: s?.prorated ?? false,
      leads: l.leads,
      visitas: l.visitas,
      ganados: l.ganados,
      cost_per_lead_usd: spendUsd !== null && l.leads > 0 ? round2(spendUsd / l.leads) : null,
      cost_per_visit_usd: spendUsd !== null && l.visitas > 0 ? round2(spendUsd / l.visitas) : null,
      missing,
    })
  }

  // Primero lo que más plata mueve; entre los que no tienen gasto cargado,
  // los que más leads trajeron (que son los candidatos a cargarles el gasto).
  return rows.sort((a, b) => (b.spend_usd ?? -1) - (a.spend_usd ?? -1) || b.leads - a.leads)
}

/** Totales de la sección Demanda. El gasto sin cotizar no suma — y se avisa. */
export function summarizePortalCosts(rows: PortalCostRow[]) {
  const withSpend = rows.filter(r => r.spend_usd !== null)
  const spendUsd = withSpend.reduce((a, r) => a + (r.spend_usd ?? 0), 0)
  const leads = rows.reduce((a, r) => a + r.leads, 0)
  const visitas = rows.reduce((a, r) => a + r.visitas, 0)
  const ganados = rows.reduce((a, r) => a + r.ganados, 0)
  return {
    spend_usd: withSpend.length > 0 ? round2(spendUsd) : null,
    leads,
    visitas,
    ganados,
    cost_per_lead_usd: withSpend.length > 0 && leads > 0 ? round2(spendUsd / leads) : null,
    /** Portales cuyo gasto quedó afuera del total por falta de cotización. */
    pending_rate: rows.filter(r => r.missing === 'sin_cotizacion').length,
    /** true si algún gasto entró prorrateado: el total no es la factura entera. */
    prorated: rows.some(r => r.prorated),
  }
}
