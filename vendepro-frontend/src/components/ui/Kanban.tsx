import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Kanban presentacional del design system (board + columna + card).
 * Estandariza el look del pipeline; el drag & drop (ej. @dnd-kit) queda en la app.
 * El color de la columna/borde suele venir de crm-config (getStageDot).
 */
export function KanbanBoard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex gap-3.5 overflow-x-auto pb-1.5', className)}>{children}</div>
}

interface KanbanColumnProps {
  title: string
  count?: number
  /** Color del punto de la columna (hex). */
  color?: string
  children?: ReactNode
  className?: string
}

export function KanbanColumn({ title, count, color, children, className }: KanbanColumnProps) {
  return (
    <div className={cn('flex-none w-56 bg-gray-100 rounded-card p-2.5', className)}>
      <div className="flex items-center justify-between px-1.5 pb-2.5">
        <span className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
          {color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
          {title}
        </span>
        {count != null && (
          <span className="text-[11px] font-semibold text-gray-500 bg-white rounded-full px-2 py-0.5">{count}</span>
        )}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

interface KanbanCardProps {
  /** Color del borde izquierdo (hex) — normalmente el de la etapa. */
  color?: string
  children: ReactNode
  className?: string
}

export function KanbanCard({ color, children, className }: KanbanCardProps) {
  return (
    <div
      className={cn('bg-white border border-gray-200 border-l-[3px] rounded-card p-3 shadow-card', className)}
      style={color ? { borderLeftColor: color } : undefined}
    >
      {children}
    </div>
  )
}
