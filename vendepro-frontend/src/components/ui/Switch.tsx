'use client'

import { cn } from '@/lib/utils'

/**
 * Switch on/off del design system. Encendido = color primario. Cambio inmediato
 * (no requiere guardar). Accesible por teclado (role=switch).
 */
interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Etiqueta VISIBLE al lado del control. También lo nombra. */
  label?: string
  /**
   * Nombre accesible sin texto visible. Para cuando la etiqueta ya está en la
   * pantalla —un título a la izquierda, una celda de tabla— y repetirla al lado
   * del control sería ruido. Sin esto y sin `label`, el control queda sin nombre:
   * pasó en el toggle de webhooks y en el del wizard de tasación.
   */
  'aria-label'?: string
  disabled?: boolean
  className?: string
}

export function Switch({ checked, onChange, label, disabled = false, className, 'aria-label': ariaLabel }: SwitchProps) {
  const toggle = () => !disabled && onChange(!checked)
  return (
    <label className={cn('inline-flex items-center gap-2.5 text-sm text-ink', disabled && 'opacity-50', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel ?? label}
        disabled={disabled}
        onClick={toggle}
        className={cn(
          'relative w-10 h-[22px] rounded-full transition-colors shrink-0',
          checked ? 'bg-primary' : 'bg-gray-300',
          !disabled && 'cursor-pointer',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-[18px]',
          )}
        />
      </button>
      {label && <span>{label}</span>}
    </label>
  )
}
