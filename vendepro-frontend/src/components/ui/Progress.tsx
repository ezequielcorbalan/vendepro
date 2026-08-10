import { cn } from '@/lib/utils'

/**
 * Barra de progreso e indicador de pasos del design system.
 * Ambos usan el gradiente de marca sobre track gris.
 */
interface ProgressBarProps {
  /** 0 a 100. */
  value: number
  className?: string
}

export function ProgressBar({ value, className }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div
      className={cn('w-full h-1.5 bg-gray-100 rounded-full overflow-hidden', className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-pink to-brand-orange transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

interface StepsProps {
  total: number
  /** Paso actual (1-indexed). */
  current: number
  showCount?: boolean
  className?: string
}

export function Steps({ total, current, showCount = true, className }: StepsProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1
        const active = step === current
        const done = step < current
        return (
          <span
            key={step}
            className={cn(
              'h-2 rounded-full transition-all duration-300',
              active
                ? 'w-6 bg-gradient-to-r from-brand-pink to-brand-orange'
                : done
                  ? 'w-2 bg-primary'
                  : 'w-2 bg-gray-200',
            )}
          />
        )
      })}
      {showCount && <span className="text-xs text-gray-400 ml-1">{current}/{total}</span>}
    </div>
  )
}
