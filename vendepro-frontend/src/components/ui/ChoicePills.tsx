'use client'

import { cn } from '@/lib/utils'

/**
 * Chips seleccionables en fila (pills). Distinto de RadioGroup/Checkbox
 * (círculos verticales) y de SegmentedControl (cambio de vista, no selección
 * de datos): esto es para elegir UN valor o VARIOS de una lista horizontal,
 * como "Tipología", "Amenities", etc.
 *
 * La anatomía es la de `Tag variant="solid"` —pill con radio completo, borde y
 * sombra suave— porque es el mismo objeto visual: un chip. La única diferencia
 * es que estos son seleccionables.
 *
 * El activo NO se rellena de primary sólido: toma el tinte de
 * `Tag variant="soft"` (`bg-primary/10 text-primary`) y marca la selección con
 * el borde en primary. Así el chip elegido sigue leyéndose como chip y no como
 * botón, y la fila no queda con bloques de color saturado.
 */
interface PillOption {
  value: string
  label: string
}

// Mismas clases que Tag variant="solid": si cambia el chip, cambian los dos.
const PILL_BASE = 'inline-flex items-center gap-1.5 rounded-full font-medium text-sm px-4 py-2 border transition-colors'
const PILL_ACTIVE = 'bg-primary/10 text-primary border-primary shadow-card'
const PILL_INACTIVE = 'bg-white text-ink border-gray-200 shadow-card hover:border-gray-300'

interface PillRadioGroupProps {
  label?: string
  /** Aclaración bajo el label, igual que en Field. */
  hint?: string
  options: PillOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}

/** Selección única. */
export function PillRadioGroup({ label, hint, options, value, onChange, className }: PillRadioGroupProps) {
  return (
    <div className={className}>
      {label && <p className="block text-sm font-medium text-gray-700 mb-1.5">{label}</p>}
      {hint && <p className="text-xs text-gray-500 -mt-1 mb-1.5">{hint}</p>}
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
  /** Aclaración bajo el label, igual que en Field. */
  hint?: string
  options: PillOption[]
  value: string[]
  onChange: (value: string[]) => void
  className?: string
}

/** Selección múltiple. */
export function PillCheckGroup({ label, hint, options, value, onChange, className }: PillCheckGroupProps) {
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])
  return (
    <div className={className}>
      {label && <p className="block text-sm font-medium text-gray-700 mb-1.5">{label}</p>}
      {hint && <p className="text-xs text-gray-500 -mt-1 mb-1.5">{hint}</p>}
      {/* Igual que PillRadioGroup: el grupo se anuncia con su etiqueta. */}
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
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
