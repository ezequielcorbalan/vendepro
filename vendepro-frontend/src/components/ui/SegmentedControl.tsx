'use client'

import { cn } from '@/lib/utils'

/**
 * Segmented control — cambia de vista sin recargar. Track gris, opción activa
 * en blanco con sombra. Controlado.
 */
interface SegmentedOption {
  value: string
  label: string
}

interface SegmentedControlProps {
  options: SegmentedOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function SegmentedControl({ options, value, onChange, className }: SegmentedControlProps) {
  return (
    <div className={cn('inline-flex gap-0.5 bg-gray-100 rounded-control p-0.5', className)} role="tablist">
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'text-sm font-medium px-3.5 py-1.5 rounded-control transition-colors',
              active ? 'bg-white text-ink shadow-card' : 'text-gray-500 hover:text-ink',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
