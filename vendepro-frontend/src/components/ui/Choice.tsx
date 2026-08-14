'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Checkbox y RadioGroup del design system. Estado marcado = color primario.
 * Controlados.
 */
interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  className?: string
}

export function Checkbox({ checked, onChange, label, disabled = false, className }: CheckboxProps) {
  return (
    <label className={cn('inline-flex items-center gap-2.5 text-sm text-ink', disabled ? 'opacity-50' : 'cursor-pointer', className)}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'w-[18px] h-[18px] rounded-[5px] border grid place-items-center shrink-0 transition-colors',
          checked ? 'bg-primary border-primary text-white' : 'bg-white border-gray-300',
        )}
      >
        {checked && <Check className="w-3 h-3" strokeWidth={3} />}
      </button>
      {label && <span>{label}</span>}
    </label>
  )
}

interface RadioOption {
  value: string
  label: string
}

interface RadioGroupProps {
  options: RadioOption[]
  value: string
  onChange: (value: string) => void
  name: string
  className?: string
}

export function RadioGroup({ options, value, onChange, name, className }: RadioGroupProps) {
  return (
    <div className={cn('flex flex-col gap-2.5', className)} role="radiogroup">
      {options.map(opt => {
        const active = opt.value === value
        return (
          <label key={opt.value} className="inline-flex items-center gap-2.5 text-sm text-ink cursor-pointer">
            <button
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={opt.label}
              name={name}
              onClick={() => onChange(opt.value)}
              className={cn(
                'w-[18px] h-[18px] rounded-full border grid place-items-center shrink-0 transition-colors',
                active ? 'border-primary' : 'border-gray-300',
              )}
            >
              {active && <span className="w-[9px] h-[9px] rounded-full bg-primary" />}
            </button>
            {opt.label}
          </label>
        )
      })}
    </div>
  )
}
