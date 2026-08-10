'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Tabs del design system. Subrayado inferior; la tab activa toma el color
 * primario. Controlado: pasás `value` y `onChange`.
 */
export interface TabItem {
  value: string
  label: string
  count?: number
  icon?: ReactNode
}

interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex gap-1 border-b border-gray-200', className)} role="tablist">
      {items.map(item => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              active
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-ink hover:border-gray-300',
            )}
          >
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
          </button>
        )
      })}
    </div>
  )
}
