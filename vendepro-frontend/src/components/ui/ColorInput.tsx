'use client'

import { cn } from '@/lib/utils'

/**
 * Muestrita de color de 28px. Envuelve el `<input type="color">` nativo, que es
 * el que abre el selector del sistema — no hay forma de reemplazarlo sin
 * escribir un picker entero, y no hace falta.
 *
 * Lo que unifica es la medida y el borde: estaba en dos lugares con `rounded`
 * en uno y `rounded-control` en el otro. Y el `aria-label` es **obligatorio**
 * en el tipo a propósito: un selector de color no tiene texto visible, así que
 * sin label es un control sin nombre. En `FunnelChartForm` no lo tenía — un
 * lector de pantalla anunciaba nada más que "color".
 */
interface ColorInputProps {
  /** El color actual. `null` muestra `fallback`, para "sin color elegido". */
  value: string | null
  onChange: (color: string) => void
  /** Qué color mostrar cuando `value` es `null`. */
  fallback?: string
  disabled?: boolean
  className?: string
  /** Qué color es éste. Obligatorio: el control no tiene texto visible. */
  'aria-label': string
}

export function ColorInput({
  value, onChange, fallback = '#ffffff', disabled = false, className,
  'aria-label': ariaLabel,
}: ColorInputProps) {
  return (
    <input
      type="color"
      value={value ?? fallback}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'h-7 w-7 shrink-0 rounded-control border border-gray-300 p-0.5',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        className,
      )}
    />
  )
}
