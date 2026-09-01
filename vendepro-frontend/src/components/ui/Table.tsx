'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Table del design system (data-driven). Header gris en text-xs mayúsculas,
 * filas con divisor y hover tenue. Scrollea horizontal en contenedor propio.
 * Para columnas numéricas usá align: 'right' (aplica tabular-nums).
 * `sortable` ordena por row[key] (string/number); la flecha usa el mismo
 * gris del texto del header, sólo cambia la opacidad activo/inactivo.
 *
 * Listas reales (contactos, propiedades) necesitan tres cosas más, y por no
 * tenerlas el componente estaba adoptado en 2 de 175 archivos:
 * - `actions` — celda final de acciones por fila. Aparece en hover del row.
 *   OJO: sólo para acciones SECUNDARIAS (eliminar, duplicar). Si la fila se
 *   puede abrir, eso va en `rowHref`, no en `actions`: esconder la única señal
 *   de "acá se entra" detrás de un hover deja la tabla sin affordance. Pasó en
 *   /contactos y es la razón de que exista `rowHref`.
 * - `rowHref` — si se pasa, la fila entera navega: cursor de mano, hover
 *   marcado, chevron siempre visible al final y Enter desde el teclado.
 *   (en touch queda siempre visible: no hay hover donde tocar).
 * - `renderMobileCard` — abajo de `md` la tabla se reemplaza por una lista de
 *   cards con ESTE render. A propósito no proyecta las columnas automáticamente:
 *   el layout mobile de una lista nunca es "las mismas celdas apiladas".
 * - `footer` — pie dentro de la misma superficie (paginación, totales).
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
  /** Acciones por fila, alineadas a la derecha. Se revelan en hover del row. */
  actions?: (row: T) => ReactNode
  /** Si se pasa, la fila entera navega a esa URL. */
  rowHref?: (row: T) => string
  /** Render de la fila para mobile (< md). Si no se pasa, la tabla scrollea. */
  renderMobileCard?: (row: T) => ReactNode
  /** Pie dentro de la misma superficie — paginación, totales. */
  footer?: ReactNode
  /** Ancho mínimo de la tabla antes de scrollear. Default 480px. */
  minWidth?: number
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
  actions,
  rowHref,
  renderMobileCard,
  footer,
  minWidth = 480,
  className,
}: TableProps<T>) {
  const router = useRouter()
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
    <div className={cn('w-full border border-gray-200 rounded-card bg-white overflow-hidden', className)}>
      <div className={cn('w-full overflow-x-auto', renderMobileCard && 'hidden md:block')}>
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
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
            {(actions || rowHref) && <th className="bg-gray-50 px-4 py-2.5 border-b border-gray-100" aria-label="Acciones" />}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              className={cn(
                'group transition-colors',
                rowHref ? 'cursor-pointer hover:bg-primary/[0.04]' : 'hover:bg-primary/[0.02]',
              )}
              {...(rowHref ? {
                onClick: (e: React.MouseEvent) => {
                  // No robarle el click a un link o botón de adentro de la fila.
                  if ((e.target as HTMLElement).closest('a,button')) return
                  router.push(rowHref(row))
                },
              } : {})}
            >
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
              {(actions || rowHref) && (
                <td className="px-4 py-3 border-b border-gray-100 last:border-b-0 text-right whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    {/* Las acciones secundarias sí se esconden en hover; en touch
                        no hay hover, así que ahí quedan visibles. */}
                    {actions && (
                      <span className="inline-flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
                        {actions(row)}
                      </span>
                    )}
                    {/* El chevron NO se esconde: es la señal de que la fila se abre. */}
                    {rowHref && (
                      <Link
                        href={rowHref(row)}
                        aria-label="Ver detalle"
                        className="inline-flex p-1.5 text-gray-400 hover:text-primary"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    )}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {renderMobileCard && (
        <div className="md:hidden divide-y divide-gray-100">
          {sorted.map((row, i) => (
            <div key={rowKey(row, i)}>{renderMobileCard(row)}</div>
          ))}
        </div>
      )}

      {footer && (
        <div className="border-t border-gray-100 bg-gray-50/40 px-4 py-3 text-sm">{footer}</div>
      )}
    </div>
  )
}
