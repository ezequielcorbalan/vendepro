import { cn } from '@/lib/utils'

/**
 * Barra de progreso del design system — gradiente de marca sobre track gris.
 *
 * El indicador de pasos que vivía acá (`Steps`, dots) se movió a
 * `ui/StepIndicator` con `variant="dots"`, que unificó los seis diseños de
 * stepper que había en la app. Importalo de ahí.
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
        className="h-full rounded-full bg-brand-gradient-r transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
