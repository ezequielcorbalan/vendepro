import type {
  ReportConclusionGenerator,
  ReportConclusionResult,
} from '../../ports/services/ai-service'
import {
  computeHealthStatus,
  daysBetweenISO,
  type HealthStatus,
} from '../../../domain/rules/report-health-rules'

export interface GenerateReportConclusionInput {
  periodLabel?: string
  periodStart?: string
  periodEnd?: string
  metrics?: Array<{
    source?: string
    impressions?: number | string | null
    portal_visits?: number | string | null
    inquiries?: number | string | null
    phone_calls?: number | string | null
    whatsapp?: number | string | null
    in_person_visits?: number | string | null
    offers?: number | string | null
    ranking_position?: number | string | null
    avg_market_price?: number | string | null
  }>
  competitors?: Array<{ address?: string | null; price?: number | string | null; notes?: string | null }>
}

/** Etiquetas del semáforo para dárselas masticadas al modelo. */
const HEALTH_LABELS: Record<HealthStatus, string> = {
  red: 'rojo — sin tracción, muy por debajo del mínimo',
  orange: 'naranja — tracción baja',
  yellow: 'amarillo — tracción media',
  light_green: 'verde claro — buena tracción',
  green: 'verde — tracción excelente',
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function fail(message: string, statusCode: number): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number }
  err.statusCode = statusCode
  return err
}

/**
 * Redacta la conclusión del reporte a partir de lo que el agente ya cargó en el
 * wizard. Nada se lee de la base: el wizard manda su estado actual, así el
 * borrador refleja exactamente lo que el propietario va a ver.
 *
 * El semáforo y las tasas se calculan ACÁ con la regla de dominio
 * (`report-health-rules`) y viajan al modelo como contexto ya resuelto — un LLM
 * no tiene por qué conocer la metodología MG, y dársela calculada evita que
 * invente umbrales.
 */
export class GenerateReportConclusionUseCase {
  constructor(private readonly generator: ReportConclusionGenerator) {}

  async execute(input: GenerateReportConclusionInput): Promise<ReportConclusionResult> {
    const metrics = (input.metrics ?? []).map((m) => ({
      source: m.source || 'manual',
      impressions: num(m.impressions),
      portal_visits: num(m.portal_visits),
      inquiries: num(m.inquiries),
      phone_calls: num(m.phone_calls),
      whatsapp: num(m.whatsapp),
      in_person_visits: num(m.in_person_visits),
      offers: num(m.offers),
      ranking_position: num(m.ranking_position),
      avg_market_price: num(m.avg_market_price),
    }))

    const hasData = metrics.some((m) =>
      Object.entries(m).some(([k, v]) => k !== 'source' && v !== null),
    )
    if (!hasData) {
      throw fail('Cargá al menos una métrica antes de pedir la conclusión.', 400)
    }

    const hasPeriod = Boolean(input.periodStart && input.periodEnd)
    const days = hasPeriod ? daysBetweenISO(input.periodStart as string, input.periodEnd as string) : 0

    const totalPortalVisits = metrics.reduce((acc, m) => acc + (m.portal_visits ?? 0), 0)
    const viewsPerDay = hasPeriod && days > 0
      ? Math.round((totalPortalVisits / days) * 10) / 10
      : null
    const healthLabel = viewsPerDay !== null ? HEALTH_LABELS[computeHealthStatus(viewsPerDay)] : null

    return await this.generator.generateReportConclusion({
      periodLabel: input.periodLabel?.trim() || 'el período',
      daysInPeriod: days,
      viewsPerDay,
      healthLabel,
      metrics,
      competitors: (input.competitors ?? [])
        .filter((c) => c.address || c.price || c.notes)
        .map((c) => ({
          address: c.address ?? null,
          price: num(c.price),
          notes: c.notes ?? null,
        })),
    })
  }
}
