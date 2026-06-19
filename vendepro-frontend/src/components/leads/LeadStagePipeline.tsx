'use client'

import { ChevronRight, Target, CheckCircle2, Circle } from 'lucide-react'
import {
  LEAD_STAGES, type LeadStage,
  LEAD_PIPELINE_STAGES, LEAD_TERMINAL_STAGES,
} from '@/lib/crm-config'

interface LeadStagePipelineProps {
  /** Etapa actual del lead (la columna `stage`). */
  currentStage: string
  /** Se dispara al clickear una etapa — mismo evento que el selector "Mover etapa". */
  onSelect: (stage: string) => void
  disabled?: boolean
}

/**
 * Stepper del pipeline del lead. Resalta la etapa actual y permite mover a otra
 * etapa con un click (dispara `onSelect`, el mismo handler que el selector).
 */
export function LeadStagePipeline({ currentStage, onSelect, disabled = false }: LeadStagePipelineProps) {
  const isTerminalLost = currentStage === 'perdido' || currentStage === 'invalido'
  const isFinalized = currentStage === 'finalizado'
  const rawOrder = LEAD_STAGES[currentStage as LeadStage]?.order ?? 0
  const currentOrder = isTerminalLost ? 0 : isFinalized ? 999 : rawOrder
  const isTerminal = (LEAD_TERMINAL_STAGES as readonly string[]).includes(currentStage)

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#ff007c] to-[#ff8017] flex items-center justify-center shadow-sm">
          <Target className="w-3.5 h-3.5 text-white" />
        </div>
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Pipeline</p>
      </div>
      <div className="overflow-hidden">
        <div className="flex items-center gap-0 flex-wrap">
          {LEAD_PIPELINE_STAGES.map((s, i) => {
            const stageData = LEAD_STAGES[s]
            const isCompleted = stageData.order < currentOrder
            const isCurrent = s === currentStage
            const isLast = i === LEAD_PIPELINE_STAGES.length - 1
            return (
              <div key={s} className="flex items-center">
                <button
                  onClick={() => onSelect(s)}
                  disabled={disabled}
                  aria-current={isCurrent ? 'step' : undefined}
                  data-stage={s}
                  data-current={isCurrent ? 'true' : undefined}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    isCurrent
                      ? 'bg-[#ff007c] text-white border-[#ff007c] shadow-sm'
                      : isCompleted
                      ? 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                      : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600'
                  } disabled:cursor-not-allowed`}
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
          {isTerminal && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-gray-300 mx-0.5 shrink-0" />
              <span
                aria-current="step"
                data-stage={currentStage}
                data-current="true"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${LEAD_STAGES[currentStage as LeadStage].color} border-transparent`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {LEAD_STAGES[currentStage as LeadStage].label}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
