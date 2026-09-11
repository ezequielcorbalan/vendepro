'use client'

import { ChevronDown } from 'lucide-react'
import { PROPERTY_STAGES, getStageConfig, type LeadPipelineKey } from '@/lib/crm-config'
import { Text } from '@/components/ui/Typography'

export interface FunnelStage {
  stage: string
  label: string
  count: number
  pct: number
  step_pct: number
  median_days_from_prev: number | null
  timed_on: number
}

/**
 * Embudo de conversión. Las barras son proporcionales al TOTAL de leads que
 * entraron, no a la barra más alta: de otro modo un embudo con poca caída y
 * uno con mucha se dibujan igual, y la forma es justamente lo que hay que ver.
 *
 * Entre etapa y etapa va la conversión del paso y el tiempo mediano, que es
 * donde se lee en qué escalón se estanca el pipeline.
 */
export function FunnelChart({
  stages,
  total,
  domain = 'lead',
  pipeline = 'vendedor',
}: {
  stages: FunnelStage[]
  total: number
  /** De qué mapa de dominio salen los colores: etapas de lead o de propiedad. */
  domain?: 'lead' | 'property'
  /**
   * De qué pipeline son las etapas. `visita_agendada`, `visito`, `oferta` y
   * `cerrado` sólo existen del lado comprador: sin esto caían al gris del
   * fallback y el embudo de compradores salía entero de un color.
   */
  pipeline?: LeadPipelineKey
}) {
  return (
    <div className="space-y-1">
      {stages.map((item, i) => {
        const cfg = domain === 'property'
          ? (PROPERTY_STAGES as Record<string, { color: string }>)[item.stage] ?? getStageConfig(item.stage)
          : getStageConfig(item.stage, pipeline)
        // Piso de ancho para que una etapa con pocos leads siga siendo legible
        // (el número va adentro de la barra).
        const width = total > 0 ? Math.max((item.count / total) * 100, 7) : 7
        return (
          <div key={item.stage}>
            {i > 0 && (
              <div className="flex items-center gap-2 sm:gap-3 py-0.5">
                <div className="w-20 sm:w-28 shrink-0" />
                <div className="flex items-center gap-1 text-gray-400">
                  <ChevronDown className="w-3 h-3 shrink-0" />
                  <Text size="xs" tone="muted" className="text-[10px]">
                    {item.step_pct}% pasa
                    {item.median_days_from_prev !== null && ` · ${item.median_days_from_prev} d`}
                  </Text>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-20 sm:w-28 shrink-0 text-right">
                <Text size="xs" tone="muted" className="text-[10px] sm:text-xs truncate">{item.label}</Text>
              </div>
              <div className="flex-1 h-7 bg-gray-50 rounded overflow-hidden">
                <div
                  className={`h-full rounded flex items-center px-2 transition-all duration-500 ${cfg.color}`}
                  style={{ width: `${width}%` }}
                >
                  <span className="text-xs font-semibold">{item.count}</span>
                </div>
              </div>
              <div className="w-9 shrink-0 text-right">
                <Text size="xs" tone="muted" className="tabular-nums">{item.pct}%</Text>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
