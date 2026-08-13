'use client'

import { cn } from '@/lib/utils'

/**
 * Chips seleccionables en fila (pills). Distinto de RadioGroup/Checkbox
 * (círculos verticales) y de SegmentedControl (cambio de vista, no selección
 * de datos): esto es para elegir UN valor o VARIOS de una lista horizontal,
 * como "Tipología", "Amenities", etc.
 */
interface PillOption {
  value: string
  label: string
}

const PILL_BASE = 'text-sm px-3 py-2 rounded-control border transition-colors'
const PILL_ACTIVE = 'bg-primary text-white border-primary'
const PILL_INACTIVE = 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'

interface PillRadioGroupProps {
  label?: string
  options: PillOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}

/** Selección única. */
export function PillRadioGroup({ label, options, value, onChange, className }: PillRadioGroupProps) {
  return (
    <div className={className}>
      {label && <p className="block text-sm font-medium text-gray-700 mb-1.5">{label}</p>}
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(PILL_BASE, value === o.value ? PILL_ACTIVE : PILL_INACTIVE)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

interface PillCheckGroupProps {
  label?: string
  options: PillOption[]
  value: string[]
  onChange: (value: string[]) => void
  className?: string
}

/** Selección múltiple. */
export function PillCheckGroup({ label, options, value, onChange, className }: PillCheckGroupProps) {
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])
  return (
    <div className={className}>
      {label && <p className="block text-sm font-medium text-gray-700 mb-1.5">{label}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value.includes(o.value)}
            onClick={() => toggle(o.value)}
            className={cn(PILL_BASE, value.includes(o.value) ? PILL_ACTIVE : PILL_INACTIVE)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
