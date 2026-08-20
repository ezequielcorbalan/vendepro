'use client'

import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * OptionCard — tarjeta seleccionable con título, descripción y ícono opcional.
 * Para elegir entre caminos (métodos, plantillas, tipos de operación) cuando un
 * RadioGroup queda chico y un Button no alcanza porque hay texto de apoyo.
 *
 * - `selected` marca la opción elegida (borde y fondo primario).
 * - `withChevron` agrega la flecha de "esto abre un paso siguiente".
 *
 * Distinto de ChoicePills (una línea, sin descripción) y de Card (superficie,
 * no control).
 */
interface OptionCardProps {
  title: string
  description?: string
  icon?: ReactNode
  selected?: boolean
  /** Muestra el chevron a la derecha: la opción lleva a otro paso. */
  withChevron?: boolean
  onClick?: () => void
  className?: string
}

export function OptionCard({
  title,
  description,
  icon,
  selected = false,
  withChevron = false,
  onClick,
  className,
}: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'group flex items-center gap-3 px-4 py-3 rounded-card border text-left transition-colors',
        selected
          ? 'bg-primary/5 border-primary text-ink'
          : 'bg-gray-50 border-gray-200 hover:border-gray-400',
        className,
      )}
    >
      {icon && (
        <span className={cn('shrink-0', selected ? 'text-primary' : 'text-gray-500')} aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        {description && (
          <span className="block text-xs text-gray-500 leading-tight mt-0.5">{description}</span>
        )}
      </span>
      {withChevron && (
        <ChevronRight
          className={cn(
            'w-4 h-4 ml-auto shrink-0',
            selected ? 'text-primary' : 'text-gray-300 group-hover:text-gray-500',
          )}
          aria-hidden="true"
        />
      )}
    </button>
  )
}
