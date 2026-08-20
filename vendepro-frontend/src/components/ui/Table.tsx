'use client'

import { Fragment, useState, type ReactNode } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Table del design system (data-driven). Header gris en text-xs mayúsculas,
 * filas con divisor y hover tenue. Scrollea horizontal en contenedor propio.
 * Para columnas numéricas usá align: 'right' (aplica tabular-nums).
 * `sortable` ordena por row[key] (string/number); la flecha usa el mismo
 * gris del texto del header, sólo cambia la opacidad activo/inactivo.
 *
 * Cada `<tr>` lleva la clase `group`, así una celda puede revelar acciones al
 * pasar el mouse por la fila (`opacity-0 group-hover:opacity-100`).
 */
export interface Column<T> {
  key: string
  header: ReactNode
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  /** Oculta la columna por debajo de este breakpoint. */
  hideBelow?: 'sm' | 'md' | 'lg'
  /** Render custom de la celda; por defecto muestra row[key]. */
  render?: (row: T) => ReactNode
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T, index: number) => string
  /**
   * Contenido desplegable de la fila. Si devuelve null, esa fila no expande.
   * Con esta prop la tabla suma una columna inicial con el chevron.
   */
  expandedContent?: (row: T) => ReactNode | null
  className?: string
}

const ALIGN: Record<NonNullable<Column<unknown>['align']>, string> = {
  left: 'text-left',
  right: 'text-right tabular-nums',
  center: 'text-center',
}

const HIDE_BELOW: Record<NonNullable<Column<unknown>['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
}

export function Table<T extends object>({
  columns,
  data,
  rowKey,
  expandedContent,
  className,
}: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

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

  const colCount = columns.length + (expandedContent ? 1 : 0)

  return (
    <div className={cn('w-full overflow-x-auto border border-gray-200 rounded-card bg-white', className)}>
      <table className="w-full border-collapse text-sm min-w-[480px]">
        <thead>
          <tr>
            {expandedContent && (
              <th className="w-8 bg-gray-50 border-b border-gray-100 px-2 py-2.5" />
            )}
            {columns.map(col => (
              <th
                key={col.key}
                aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                className={cn(
                  'text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50',
                  'px-4 py-2.5 border-b border-gray-100',
                  ALIGN[col.align ?? 'left'],
                  col.hideBelow && HIDE_BELOW[col.hideBelow],
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
          {sorted.map((row, i) => {
            const key = rowKey(row, i)
            const expanded = expandedContent?.(row) ?? null
            // ReactNode admite 0 y '' como valores válidos, así que el flag va
            // normalizado a booleano para las clases y los handlers.
            const canExpand = Boolean(expanded)
            const isOpen = expandedRow === key
            return (
              <Fragment key={key}>
                <tr
                  className={cn(
                    'group hover:bg-primary/[0.02] transition-colors',
                    canExpand && 'cursor-pointer',
                  )}
                  onClick={canExpand ? () => setExpandedRow(isOpen ? null : key) : undefined}
                >
                  {expandedContent && (
                    <td className="px-2 py-3 border-b border-gray-100 last:border-b-0 align-top">
                      {canExpand && (
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-label={isOpen ? 'Ocultar detalle' : 'Ver detalle'}
                          onClick={e => { e.stopPropagation(); setExpandedRow(isOpen ? null : key) }}
                          className="p-1 rounded-control text-gray-400 hover:bg-gray-100"
                        >
                          <ChevronRight className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-90')} />
                        </button>
                      )}
                    </td>
                  )}
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3 border-b border-gray-100 text-ink last:border-b-0',
                        ALIGN[col.align ?? 'left'],
                        col.hideBelow && HIDE_BELOW[col.hideBelow],
                      )}
                    >
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
                {isOpen && canExpand && (
                  <tr>
                    <td colSpan={colCount} className="px-4 pb-4 pt-1 border-b border-gray-100">
                      {expanded}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
