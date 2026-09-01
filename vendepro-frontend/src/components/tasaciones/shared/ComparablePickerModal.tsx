'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import type { ComparableData } from './ComparableCard'

/**
 * Modal para elegir un comparable de alguna fuente.
 *
 * Había DOS: `PropertiesPickerModal` (218 líneas) y `SoldPropertiesPickerModal`
 * (197), y eran la misma pantalla — scrim, panel, header con ícono, banda de
 * filtros, lista con loading/empty/items, y cada fila con título + badge + meta
 * + monto a la derecha. Diferían en de dónde traen los datos, qué campos de
 * filtro muestran y cómo mapean al comparable. Cada bug había que arreglarlo dos
 * veces, y de hecho pasó: los dos tenían el mismo drift de color y de etapas.
 *
 * Acá vive la pantalla; cada fuente aporta sólo lo suyo vía `ComparableSource`.
 *
 * El overlay es el `Modal` del DS, así que trae Portal, scroll-lock, focus-trap,
 * devolución de foco y Esc — nada de eso tenían las dos versiones anteriores.
 * Ver la fase 6 en doc/ds-plan-fase6.md.
 */

/** Un campo de filtro además del buscador. */
export interface PickerFilter {
  key: string
  placeholder: string
  kind: 'text' | 'select'
  options?: { value: string; label: string }[]
  /**
   * `true` = el filtro se manda al servidor y recarga la lista.
   * `false`/ausente = filtra en cliente, con `matches` de la fuente.
   */
  server?: boolean
}

/** Cómo se dibuja una fila de la lista. */
export interface PickerRow {
  title: string
  badge?: ReactNode
  meta: ReactNode[]
  amountLabel: string
  amount: string
}

export interface ComparableSource<T> {
  title: string
  icon: ReactNode
  searchPlaceholder: string
  filters?: PickerFilter[]
  /** Aclaración bajo los filtros. */
  hint?: ReactNode
  load: (serverFilters: Record<string, string>) => Promise<T[]>
  rowKey: (item: T) => string
  /** Texto sobre el que busca el buscador. */
  searchable: (item: T) => string
  /** Filtro en cliente para los filtros que no son `server`. */
  matches?: (item: T, filters: Record<string, string>) => boolean
  toRow: (item: T) => PickerRow
  toComparable: (item: T) => ComparableData
  emptyTitle: string
  emptyDescription?: string
  emptyFiltered: string
}

interface Props<T> {
  open: boolean
  onClose: () => void
  onPick: (data: ComparableData) => void
  source: ComparableSource<T>
}

const COLS: Record<number, string> = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' }

export function ComparablePickerModal<T>({ open, onClose, onPick, source }: Props<T>) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})

  const filters = source.filters ?? []
  // Los filtros de servidor son la dependencia de la carga; los de cliente no.
  const serverKeys = filters.filter(f => f.server).map(f => f.key)
  const serverSignature = serverKeys.map(k => `${k}=${values[k] ?? ''}`).join('&')

  useEffect(() => {
    if (!open) return
    setSearch('')
    setValues({})
  }, [open])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const serverFilters: Record<string, string> = {}
    for (const k of serverKeys) if (values[k]) serverFilters[k] = values[k]
    let vivo = true
    source.load(serverFilters)
      .then(list => { if (vivo) setItems(list) })
      .catch(() => { if (vivo) setItems([]) })
      .finally(() => { if (vivo) setLoading(false) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, serverSignature])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter(item => {
      if (source.matches && !source.matches(item, values)) return false
      if (!q) return true
      return source.searchable(item).toLowerCase().includes(q)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, values])

  const sinDatos = items.length === 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={source.title}
      icon={source.icon}
      padded={false}
      className="max-w-3xl max-h-[85vh] flex flex-col"
    >
      <div className="border-b border-gray-100 bg-gray-50 px-6 py-3 shrink-0">
        {/* Mapa estático y no interpolación: Tailwind no genera clases que
            construye el runtime (`sm:grid-cols-${n}` no existiría en el CSS). */}
        <div className={`grid grid-cols-1 gap-2 ${COLS[Math.min(filters.length + 1, 3)]}`}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 z-10" />
            <Input
              placeholder={source.searchPlaceholder}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
              aria-label="Buscar"
            />
          </div>
          {filters.map(f => f.kind === 'select' ? (
            <Select
              key={f.key}
              aria-label={f.placeholder}
              value={values[f.key] ?? ''}
              onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
            >
              <option value="">{f.placeholder}</option>
              {(f.options ?? []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          ) : (
            <Input
              key={f.key}
              placeholder={f.placeholder}
              aria-label={f.placeholder}
              value={values[f.key] ?? ''}
              onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
            />
          ))}
        </div>
        {source.hint && <p className="mt-2 text-[11px] text-gray-500">{source.hint}</p>}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-card border border-dashed border-gray-200">
            <EmptyState
              icon={source.icon}
              title={sinDatos ? source.emptyTitle : source.emptyFiltered}
              description={sinDatos ? source.emptyDescription : undefined}
            />
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map(item => {
              const row = source.toRow(item)
              return (
                <li key={source.rowKey(item)}>
                  <button
                    type="button"
                    onClick={() => { onPick(source.toComparable(item)); onClose() }}
                    className="group flex w-full items-start gap-3 rounded-control border border-gray-200 bg-white p-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-ink">{row.title}</span>
                        {row.badge}
                      </div>
                      {row.meta.length > 0 && (
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                          {row.meta.map((m, i) => <span key={i} className="flex items-center gap-1">{m}</span>)}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400">{row.amountLabel}</p>
                      <p className="text-sm font-semibold text-ink">{row.amount}</p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Modal>
  )
}

export function formatPriceUsd(n: number | null | undefined): string {
  if (typeof n !== 'number') return '—'
  return `USD ${n.toLocaleString('es-AR')}`
}

export function formatPickerDate(d: string | null | undefined): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('es-AR') } catch { return d }
}
