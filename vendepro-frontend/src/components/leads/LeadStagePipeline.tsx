'use client'

import { ChevronRight, Target, CheckCircle2, Circle, XCircle } from 'lucide-react'
import {
  getStagesForPipeline, canMoveLeadStageManually, type LeadPipelineKey,
} from '@/lib/crm-config'

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
    <div className="bg-white border border-gray-200 rounded-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center">
            <Target className="w-3.5 h-3.5 text-white" />
          </div>
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Pipeline{pipeline === 'comprador' ? ' comprador' : ''}
          </p>
        </div>
        <span className="text-[10px] text-gray-400">Clickeá una etapa para mover (incluso hacia atrás)</span>
      </div>

      <div className="overflow-hidden">
        <div className="flex items-center gap-0 flex-wrap">
          {stepperStages.map((s, i) => {
            const stageData = config[s]
            const isCompleted = stageData.order < currentOrder
            const isCurrent = s === currentStage
            const isLast = i === stepperStages.length - 1
            const movable = canMoveLeadStageManually(currentStage, s, pipeline)
            const isDisabled = disabled || (!isCurrent && !movable)
            return (
              <div key={s} className="flex items-center">
                <button
                  onClick={() => onSelect(s)}
                  disabled={isDisabled}
                  aria-current={isCurrent ? 'step' : undefined}
                  data-stage={s}
                  data-current={isCurrent ? 'true' : undefined}
                  title={!isCurrent && !movable ? 'No podés saltear a esta etapa' : undefined}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    isCurrent
                      ? 'bg-brand-pink text-white border-brand-pink'
                      : isCompleted
                      ? 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                      : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600'
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-gray-400" />
                  ) : isCurrent ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Circle className="w-3.5 h-3.5" />
                  )}
                  {stageData.label}
                </button>
                {!isLast && (
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 mx-0.5 shrink-0" />
                )}
              </div>
            )
          })}
        </div>

        {/* Estados terminales: siempre accesibles (marcar / corregir). */}
        <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-gray-100">
          {MANUAL_TERMINAL_STAGES.map(s => {
            const isCurrent = s === currentStage
            return (
              <button
                key={s}
                onClick={() => onSelect(s)}
                disabled={disabled}
                aria-current={isCurrent ? 'step' : undefined}
                data-stage={s}
                data-current={isCurrent ? 'true' : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  isCurrent
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-red-500 border-red-200 hover:bg-red-50'
                } disabled:cursor-not-allowed`}
              >
                <XCircle className="w-3.5 h-3.5" />
                {config[s]?.label ?? s}
              </button>
            )
          })}
          {isFinalized && config.finalizado && (
            <span
              aria-current="step"
              data-stage="finalizado"
              data-current="true"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${config.finalizado.color} border-transparent`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {config.finalizado.label}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
