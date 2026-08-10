import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Table del design system (data-driven). Header gris en text-xs mayúsculas,
 * filas con divisor y hover tenue. Scrollea horizontal en contenedor propio.
 * Para columnas numéricas usá align: 'right' (aplica tabular-nums).
 */
export interface Column<T> {
  key: string
  header: ReactNode
  align?: 'left' | 'right' | 'center'
  /** Render custom de la celda; por defecto muestra row[key]. */
  render?: (row: T) => ReactNode
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T, index: number) => string
  className?: string
}

const ALIGN: Record<NonNullable<Column<unknown>['align']>, string> = {
  left: 'text-left',
  right: 'text-right tabular-nums',
  center: 'text-center',
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  className,
}: TableProps<T>) {
  return (
    <div className={cn('w-full overflow-x-auto border border-gray-200 rounded-card bg-white', className)}>
      <table className="w-full border-collapse text-sm min-w-[480px]">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                className={cn(
                  'text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50',
                  'px-4 py-2.5 border-b border-gray-100',
                  ALIGN[col.align ?? 'left'],
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={rowKey(row, i)} className="hover:bg-primary/[0.02] transition-colors">
              {columns.map(col => (
                <td
                  key={col.key}
                  className={cn(
                    'px-4 py-3 border-b border-gray-100 text-ink last:border-b-0',
                    ALIGN[col.align ?? 'left'],
                  )}
                >
                  {col.render ? col.render(row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
