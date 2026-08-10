'use client'

import { cn } from '@/lib/utils'

/**
 * Switch on/off del design system. Encendido = color primario. Cambio inmediato
 * (no requiere guardar). Accesible por teclado (role=switch).
 */
interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  className?: string
}

export function Switch({ checked, onChange, label, disabled = false, className }: SwitchProps) {
  const toggle = () => !disabled && onChange(!checked)
  return (
    <label className={cn('inline-flex items-center gap-2.5 text-sm text-ink', disabled && 'opacity-50', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
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
