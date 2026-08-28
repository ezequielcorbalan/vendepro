'use client'

import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Indicador de pasos del design system — fuente única para "en qué paso estás".
 *
 * Antes había SEIS diseños distintos para este mismo trabajo: círculo con label
 * debajo (register), círculo con label al lado (reportes/nuevo), lo mismo en
 * 20px (wizard de email), dots (onboarding, ficha pública), pastillas
 * segmentadas (wizard de tasaciones) y un SegmentedControl con ícono
 * (prefactibilidades). Tres de esos seis eran el mismo dibujo con tres medidas.
 *
 * Dos variantes, porque son dos contextos de verdad distintos:
 * - `numbered` (default) — círculo numerado + label al lado + línea de unión.
 *   Es el canónico: dice el número, el nombre y si el paso está hecho.
 * - `dots` — sólo puntos + contador. Para cuando NO hay lugar para labels
 *   (header de un modal, barra de una página pública). No dice qué paso es, así
 *   que no lo uses si tenés el ancho.
 *
 * Estado "hecho" = check sobre círculo `primary`. Antes reportes/nuevo lo
 * pintaba verde y el resto rosa; gana el rosa (el verde es para `success`).
 *
 * Mobile: en `numbered` los labels se esconden abajo de `sm` y queda una línea
 * "Paso N de M · Label" debajo, en vez de que la fila scrollee fuera de vista.
 *
 * Uso:
 *   <StepIndicator steps={['Audiencia', 'Contenido', 'Revisión']} current={2} />
 *   <StepIndicator steps={STEPS} current={step} onStepClick={setStep} />
 *   <StepIndicator steps={8} current={3} variant="dots" />
 */
export type StepIndicatorVariant = 'numbered' | 'dots'

export interface StepItem {
  label: string
  /** Ícono a la izquierda del label (lucide). */
  icon?: ReactNode
}

interface StepIndicatorProps {
  /** Labels de los pasos, o un número si no tienen nombre (sólo tiene sentido con `dots`). */
  steps: Array<string | StepItem> | number
  /** Paso actual, 1-based. */
  current: number
  variant?: StepIndicatorVariant
  /** Si se pasa, los pasos YA COMPLETADOS son clickeables (volver atrás). */
  onStepClick?: (step: number) => void
  /** Permite click también hacia adelante. Off por default: casi ningún wizard lo quiere. */
  allowForward?: boolean
  /** Contador "N/M" al final. Sólo en `dots`. */
  showCount?: boolean
  className?: string
}

function normalize(steps: StepIndicatorProps['steps']): StepItem[] {
  if (typeof steps === 'number') return Array.from({ length: steps }, () => ({ label: '' }))
  return steps.map(s => (typeof s === 'string' ? { label: s } : s))
}

export function StepIndicator({
  steps,
  current,
  variant = 'numbered',
  onStepClick,
  allowForward = false,
  showCount = true,
  className,
}: StepIndicatorProps) {
  const items = normalize(steps)
  const total = items.length

  if (variant === 'dots') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {items.map((_, i) => {
          const n = i + 1
          const active = n === current
          const done = n < current
          return (
            <span
              key={n}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                active ? 'w-6 bg-brand-gradient-r' : done ? 'w-2 bg-primary' : 'w-2 bg-gray-200',
              )}
            />
          )
        })}
        {showCount && <span className="text-xs text-gray-400 ml-1">{current}/{total}</span>}
      </div>
    )
  }

  const currentLabel = items[current - 1]?.label

  return (
    <div className={className}>
      <ol className="flex items-center gap-2">
        {items.map((item, i) => {
          const n = i + 1
          const active = n === current
          const done = n < current
          const clickable = !!onStepClick && (done || (allowForward && !active))

          const circle = (
            <span
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 transition-colors',
                done || active ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500',
              )}
            >
              {done ? <Check className="w-4 h-4" aria-hidden /> : n}
            </span>
          )

          const label = item.label && (
            <span
              className={cn(
                'hidden sm:inline-flex items-center gap-1.5 text-sm whitespace-nowrap',
                active ? 'text-ink font-medium' : done ? 'text-gray-600' : 'text-gray-400',
              )}
            >
              {item.icon}
              {item.label}
            </span>
          )

          return (
            <li key={n} className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick(n)}
                  className="flex items-center gap-2 rounded-control hover:opacity-80 transition-opacity"
                  title={item.label ? `Ir a: ${item.label}` : `Ir al paso ${n}`}
                >
                  {circle}
                  {label}
                </button>
              ) : (
                <span className="flex items-center gap-2">
                  {circle}
                  {label}
                </span>
              )}
              {n < total && <span className="w-6 sm:w-8 h-px bg-gray-300 shrink-0" aria-hidden />}
            </li>
          )
        })}
      </ol>

      {/* Mobile: los labels de arriba están ocultos, así que el paso actual se
          nombra acá abajo. Evita que la fila scrollee fuera de la pantalla. */}
      {currentLabel && (
        <p className="sm:hidden text-xs text-gray-500 mt-2">
          Paso {current} de {total} · <span className="text-ink font-medium">{currentLabel}</span>
        </p>
      )}
    </div>
  )
}
