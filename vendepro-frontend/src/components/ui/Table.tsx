'use client'

import { useState, type ReactNode } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Table del design system (data-driven). Header gris en text-xs mayúsculas,
 * filas con divisor y hover tenue. Scrollea horizontal en contenedor propio.
 * Para columnas numéricas usá align: 'right' (aplica tabular-nums).
 * `sortable` ordena por row[key] (string/number); la flecha usa el mismo
 * gris del texto del header, sólo cambia la opacidad activo/inactivo.
 */
export interface Column<T> {
  key: string
  header: ReactNode
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
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

export function Table<T extends object>({
  columns,
  data,
  rowKey,
  className,
}: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = (a as Record<string, unknown>)[sortKey]
        const bv = (b as Record<string, unknown>)[sortKey]
        const cmp = typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av ?? '').localeCompare(String(bv ?? ''))
        return sortDir === 'asc' ? cmp : -cmp
      })
    : data

  const toggleSort = (col: Column<T>) => {
    if (!col.sortable) return
    if (sortKey !== col.key) { setSortKey(col.key); setSortDir('asc') }
    else setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
  }

  return (
    <div className={cn('w-full overflow-x-auto border border-gray-200 rounded-card bg-white', className)}>
      <table className="w-full border-collapse text-sm min-w-[480px]">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                className={cn(
                  'text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50',
                  'px-4 py-2.5 border-b border-gray-100',
                  ALIGN[col.align ?? 'left'],
                )}
              >
                {col.sortable ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(col)}
                    className={cn(
                      'inline-flex items-center gap-1 text-gray-500 uppercase tracking-wide font-semibold cursor-pointer',
                      col.align === 'right' && 'flex-row-reverse',
                    )}
                  >
                    {col.header}
                    {sortKey === col.key ? (
                      sortDir === 'asc'
                        ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                        : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                    ) : (
                      <ChevronsUpDown className="w-3.5 h-3.5 text-gray-500 opacity-40" />
                    )}
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={rowKey(row, i)} className="hover:bg-primary/[0.02] transition-colors">
              {columns.map(col => (
                <td
                  key={col.key}
                  className={cn(
                    'px-4 py-3 border-b border-gray-100 text-ink last:border-b-0',
                    ALIGN[col.align ?? 'left'],
                  )}
                >
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
