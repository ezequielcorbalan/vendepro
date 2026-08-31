'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Tarjeta seleccionable — "elegí una de estas opciones". Es un `<button>` con
 * forma de card: estado seleccionado con borde y tinte primario, hover suave.
 *
 * Reemplaza 6 implementaciones inline en 3 módulos (perfil/objetivos, wizard de
 * tasaciones, modal de nueva landing), que diferían en radio, grosor de borde y
 * color del estado activo.
 *
 * Dos orientaciones, según cómo se ven los usos reales:
 * - `row`   → ícono a la izquierda, texto al medio, `trailing` a la derecha
 *             (típico chevron). Para listas cortas de 2–3 opciones.
 * - `stack` → ícono o `media` arriba, texto abajo. Para grillas de templates.
 *
 * Uso:
 *   <OptionCard
 *     title="Método probado" description="Keller, Magnin, Agenda"
 *     icon={<Zap className="w-5 h-5" />} trailing={<ChevronRight className="w-4 h-4" />}
 *     selected={mode === 'method'} onClick={() => setMode('method')}
 *   />
 */
export type OptionCardOrientation = 'row' | 'stack'

interface OptionCardProps {
  title: ReactNode
  description?: ReactNode
  /** Ícono (lucide). Toma el color primario cuando está seleccionado. */
  icon?: ReactNode
  /** Bloque visual a sangre arriba del texto (preview de template, imagen). Sólo en `stack`. */
  media?: ReactNode
  /** Elemento al final de la fila — normalmente un chevron. Sólo en `row`. */
  trailing?: ReactNode
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
  orientation?: OptionCardOrientation
  className?: string
}

export function OptionCard({
  title,
  description,
  icon,
  media,
  trailing,
  selected = false,
  disabled = false,
  onClick,
  orientation = 'row',
  className,
}: OptionCardProps) {
  const row = orientation === 'row'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'group text-left border rounded-card transition-colors w-full overflow-hidden',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        row ? 'flex items-center gap-3 px-4 py-3' : 'flex flex-col',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
        className,
      )}
    >
      {!row && media}

      {icon && (
        <span
          className={cn(
            'shrink-0',
            selected ? 'text-primary' : 'text-gray-500',
            !row && 'px-4 pt-4',
          )}
        >
          {icon}
        </span>
      )}

      <span className={cn('min-w-0 flex-1', !row && 'p-4')}>
        <span
          className={cn(
            'block text-sm font-semibold truncate',
            selected ? 'text-primary' : 'text-ink',
          )}
        >
          {title}
        </span>
        {description && (
          <span className="block text-xs text-gray-400 mt-0.5 leading-tight">{description}</span>
        )}
      </span>

      {row && trailing && (
        <span
          className={cn(
            'shrink-0 ml-auto',
            selected ? 'text-primary' : 'text-gray-300 group-hover:text-gray-500',
          )}
        >
          {trailing}
        </span>
      )}
    </button>
  )
}
