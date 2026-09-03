'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * Tabs del design system. Subrayado inferior; la tab activa toma el color
 * primario.
 *
 * Dos modos, según el item traiga `href` o no:
 * - **estado** (default): `<button>` + `onChange`. Para cambiar de vista sin
 *   navegar.
 * - **ruta**: si el item tiene `href`, se renderiza un `<Link>` con
 *   `aria-current="page"`. Había tres copias a mano de este componente sólo
 *   porque no soportaba navegar (ActivityTabs, reportes/layout, leads).
 *   Con `<Link>` funcionan el click medio, el prefetch y abrir en pestaña nueva.
 *
 * En modo ruta el `value` activo lo calcula quien llama (el match de ruta es
 * suyo: a veces es exacto y a veces con `startsWith`).
 */
export interface TabItem {
  value: string
  label: string
  count?: number
  icon?: ReactNode
  /** Si se pasa, la tab navega (renderiza `<Link>` en vez de `<button>`). */
  href?: string
}

interface TabsProps {
  items: TabItem[]
  value: string
  /** Requerido en modo estado; en modo ruta no hace falta. */
  onChange?: (value: string) => void
  className?: string
}

export function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex gap-1 border-b border-gray-200', className)} role="tablist">
      {items.map(item => {
        const active = item.value === value
        const className = cn(
          'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
          active
            ? 'border-primary text-primary'
            : 'border-transparent text-gray-500 hover:text-ink hover:border-gray-300',
        )
        const content = (
          <>
            {item.icon}
            {item.label}
            {item.count != null && (
              <span
                className={cn(
                  'text-xs px-1.5 py-0.5 rounded-full',
                  active ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600',
                )}
              >
                {item.count}
              </span>
            )}
          </>
        )

        if (item.href) {
          return (
            <Link
              key={item.value}
              href={item.href}
              role="tab"
              aria-selected={active}
              aria-current={active ? 'page' : undefined}
              className={className}
            >
              {content}
            </Link>
          )
        }

        return (
          <button
            type="button"
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(item.value)}
            className={className}
          >
            {content}
          </button>
        )
      })}
    </div>
  )
}
