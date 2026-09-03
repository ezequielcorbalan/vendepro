'use client'

import { ChevronRight, Target, CheckCircle2, Circle, XCircle } from 'lucide-react'
import {
  getStagesForPipeline, canMoveLeadStageManually, type LeadPipelineKey,
} from '@/lib/crm-config'
import { Card } from '@/components/ui/Card'
import { WidgetHeader } from '@/components/ui/WidgetHeader'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'

/** Estados terminales que se pueden setear manualmente desde el pipeline. */
const MANUAL_TERMINAL_STAGES = ['perdido', 'invalido'] as const

interface LeadStagePipelineProps {
  /** Etapa actual del lead (la columna `stage`). */
  currentStage: string
  /** Pipeline del lead: define qué etapas muestra el stepper. */
  pipeline?: LeadPipelineKey
  /**
   * Se dispara al clickear una etapa. Es un bypass: permite mover a cualquier
   * etapa (incluso hacia atrás) para corregir errores. La validación de negocio
   * la hace el backend según el flag override.
   */
  onSelect: (stage: string) => void
  disabled?: boolean
}

/**
 * Stepper del pipeline del lead. Resalta la etapa actual y permite mover a
 * cualquier etapa con un click (corrección manual / bypass), incluidos los
 * estados terminales y volver atrás desde ellos.
 */
export function LeadStagePipeline({ currentStage, pipeline = 'vendedor', onSelect, disabled = false }: LeadStagePipelineProps) {
  const { config } = getStagesForPipeline(pipeline)
  // Etapas del stepper: las no-terminales-perdidas. En comprador, 'cerrado' es la
  // etapa ganada y va en el stepper (como 'captado' en vendedor); 'finalizado'
  // (vendedor, solo-sync) se muestra como chip informativo.
  const stepperStages = Object.keys(config).filter(
    s => s !== 'perdido' && s !== 'invalido' && s !== 'finalizado'
  )
  const isTerminalLost = currentStage === 'perdido' || currentStage === 'invalido'
  const isFinalized = currentStage === 'finalizado'
  const rawOrder = config[currentStage]?.order ?? 0
  const currentOrder = isTerminalLost ? 0 : isFinalized ? 999 : rawOrder

  return (
    <Card>
      <WidgetHeader
        size="sm"
        icon={<Target className="w-3.5 h-3.5" />}
        title={`Pipeline${pipeline === 'comprador' ? ' comprador' : ''}`}
        action={<Text size="xs" tone="muted" className="text-[10px]">Clickeá una etapa para mover (incluso hacia atrás)</Text>}
        className="mb-4"
      />

      <div className="overflow-hidden">
        {/* `gap-y-2` y no `gap-0`: con nueve etapas la fila envuelve casi
            siempre, y sin separación vertical las dos líneas de pills se
            tocaban. El gap horizontal sigue en 0 porque el separador es el
            chevron, que ya trae su propio margen. */}
        <div className="flex items-center gap-x-0 gap-y-2 flex-wrap">
          {stepperStages.map((s, i) => {
            const stageData = config[s]
            const isCompleted = stageData.order < currentOrder
            const isCurrent = s === currentStage
            const isLast = i === stepperStages.length - 1
            const movable = canMoveLeadStageManually(currentStage, s, pipeline)
            const isDisabled = disabled || (!isCurrent && !movable)
            return (
              <div key={s} className="flex items-center">
                <Button
                  variant={isCurrent ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => onSelect(s)}
                  disabled={isDisabled}
                  aria-current={isCurrent ? 'step' : undefined}
                  data-stage={s}
                  data-current={isCurrent ? 'true' : undefined}
                  title={!isCurrent && !movable ? 'No podés saltear a esta etapa' : undefined}
                  className={`gap-1.5 rounded-full ${
                    isCurrent ? '' : isCompleted ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-gray-400" />
                  ) : isCurrent ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Circle className="w-3.5 h-3.5" />
                  )}
                  {stageData.label}
                </Button>
                {!isLast && (
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 mx-0.5 shrink-0" />
                )}
              </div>
            )
          })}
        </div>

        {/* Estados terminales: siempre accesibles (marcar / corregir). */}
        <div className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-gray-100">
          {MANUAL_TERMINAL_STAGES.map(s => {
            const isCurrent = s === currentStage
            return (
              <Button
                key={s}
                variant={isCurrent ? 'danger' : 'outline'}
                size="sm"
                onClick={() => onSelect(s)}
                disabled={disabled}
                aria-current={isCurrent ? 'step' : undefined}
                data-stage={s}
                data-current={isCurrent ? 'true' : undefined}
                icon={<XCircle className="w-3.5 h-3.5" />}
                className={`gap-1.5 rounded-full ${isCurrent ? '' : 'text-danger border-danger/30 hover:bg-danger/10'}`}
              >
                {config[s]?.label ?? s}
              </Button>
            )
          })}
          {isFinalized && config.finalizado && (
            <span
              aria-current="step"
              data-stage="finalizado"
              data-current="true"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-transparent ${config.finalizado.color}`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {config.finalizado.label}
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}
