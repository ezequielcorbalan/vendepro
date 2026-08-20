'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Stepper del design system: progreso dentro de un flujo de pasos.
 *
 * - `variant="dots"` (default): indicador pasivo. El paso actual se estira a
 *   una píldora con el gradiente de marca, los completados quedan en primary
 *   y los pendientes en gris. Se anuncia como progressbar.
 * - `variant="pills"`: pasos navegables con ícono y etiqueta, para wizards.
 *   Requiere `onStepChange`.
 *
 * Distinto de SegmentedControl (cambia la vista de la misma data) y de Tabs
 * (secciones de una pantalla): acá los pasos tienen orden y avance.
 */
export interface StepperStep {
  label?: string
  icon?: ReactNode
}

interface StepperProps {
  /** Los pasos, o cuántos son (para el indicador de puntos, que no lleva label). */
  steps: StepperStep[] | number
  /** Índice del paso actual (0-based). */
  current: number
  variant?: 'dots' | 'pills'
  /** Hace los pasos navegables (sólo en variant="pills"). */
  onStepChange?: (index: number) => void
  /** Muestra "3/8" al final (sólo en variant="dots"). */
  showCount?: boolean
  /** Etiqueta accesible del progreso. */
  label?: string
  className?: string
}

export function Stepper({
  steps: stepsProp,
  current,
  variant = 'dots',
  onStepChange,
  showCount = false,
  label = 'Progreso',
  className,
}: StepperProps) {
  const steps: StepperStep[] = typeof stepsProp === 'number'
    ? Array.from({ length: stepsProp }, () => ({}))
    : stepsProp

  if (variant === 'pills') {
    return (
      <div className={cn('flex gap-2 overflow-x-auto pb-2', className)} aria-label={label}>
        {steps.map((step, i) => (
          <button
            type="button"
            key={step.label ?? i}
            onClick={() => onStepChange?.(i)}
            aria-current={i === current ? 'step' : undefined}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-control text-xs font-medium whitespace-nowrap transition-colors',
              i === current
                ? 'bg-primary text-white'
                : 'bg-white text-gray-500 border border-gray-200 hover:text-ink',
            )}
          >
            {step.icon}
            {step.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={steps.length}
      aria-valuenow={current + 1}
      aria-valuetext={`Paso ${current + 1} de ${steps.length}`}
    >
      {steps.map((step, i) => (
        <span
          key={step.label ?? i}
          className={cn(
            'rounded-full transition-all duration-300',
            i === current
              ? 'w-6 h-2 bg-gradient-to-r from-brand-pink to-brand-orange'
              : i < current
              ? 'w-2 h-2 bg-primary'
              : 'w-2 h-2 bg-gray-200',
          )}
        />
      ))}
      {showCount && (
        <span className="text-xs text-gray-500 ml-1">{current + 1}/{steps.length}</span>
      )}
    </div>
  )
}
