'use client'
import { useEffect, useMemo, useState } from 'react'
import { Search, Loader2, Database, MapPin, Calendar, X } from 'lucide-react'
import {
  listSoldProperties,
  PROPERTY_TYPES,
  type SoldProperty,
} from '@/lib/sold-properties/api'
import type { ComparableData } from './ComparableCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input, Select } from '@/components/ui/Input'

interface Props {
  open: boolean
  onClose: () => void
  /** Se invoca con los datos ya mapeados a un comparable de tipo 'venta'. */
  onPick: (data: ComparableData) => void
}

/**
 * Mapea un sold_property → ComparableData (kind='venta'). El backend recibe
 * el dato luego y guarda `source_sold_property_id` para trazabilidad.
 */
export function mapSoldPropertyToComparable(sp: SoldProperty): ComparableData {
  return {
    kind: 'venta',
    address: sp.address_approx ?? sp.neighborhood ?? null,
    total_area: sp.total_area ?? null,
    covered_area: sp.covered_area ?? null,
    price: sp.listing_price_usd ?? null,
    closing_price_usd: sp.closing_price_usd ?? null,
    closed_at: sp.closed_at ?? null,
    usd_per_m2: sp.usd_per_m2 ?? null,
    age: null,
    days_on_market: null,
    views_per_day: null,
    zonaprop_url: null,
    source_sold_property_id: sp.id,
  }
}

function formatPriceUsd(n: number | null | undefined): string {
  if (typeof n !== 'number') return '—'
  return `USD ${n.toLocaleString('es-AR')}`
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('es-AR') } catch { return d }
}

export function SoldPropertiesPickerModal({ open, onClose, onPick }: Props) {
  const [items, setItems] = useState<SoldProperty[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [propertyType, setPropertyType] = useState('')
  const [neighborhood, setNeighborhood] = useState('')

  // Reset cuando se abre.
  useEffect(() => {
    if (!open) return
    setSearch('')
    setPropertyType('')
    setNeighborhood('')
  }, [open])

  // Carga inicial al abrir + recarga cuando cambian filtros estructurales.
  useEffect(() => {
    if (!open) return
    setLoading(true)
    listSoldProperties({
      property_type: propertyType || undefined,
      neighborhood: neighborhood || undefined,
    })
      .then(setItems)
      .finally(() => setLoading(false))
  }, [open, propertyType, neighborhood])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(sp => {
      const haystack = [
        sp.address_approx, sp.neighborhood, sp.property_type, sp.notes,
        sp.external_agent_name, sp.external_agency,
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [items, search])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-card bg-white shadow-pop"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-brand-pink to-brand-orange h-1" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-ink">Elegir desde Cierres Reales</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filtros */}
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 z-10" />
              <Input
                placeholder="Buscar…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={propertyType} onChange={e => setPropertyType(e.target.value)}>
              <option value="">Tipo: cualquiera</option>
              {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
            <Input
              placeholder="Barrio"
              value={neighborhood}
              onChange={e => setNeighborhood(e.target.value)}
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-brand-pink" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-card border border-dashed border-slate-200">
              <EmptyState
                icon={<Database className="w-6 h-6" />}
                title={items.length === 0
                  ? 'No tenés cierres reales cargados todavía.'
                  : 'Ningún cierre coincide con los filtros.'}
                description={items.length === 0 ? 'Podés cargar cierres desde Tasaciones → Cierres Reales.' : undefined}
              />
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map(sp => (
                <li key={sp.id}>
                  <button
                    type="button"
                    onClick={() => { onPick(mapSoldPropertyToComparable(sp)); onClose() }}
                    className="group flex w-full items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-brand-pink/60 hover:bg-rose-50/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-ink">
                          {sp.address_approx || sp.neighborhood || sp.property_type}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">
                          {sp.property_type}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        {sp.neighborhood && (
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {sp.neighborhood}</span>
                        )}
                        {(sp.covered_area || sp.total_area) && (
                          <span>{sp.covered_area ?? sp.total_area} m²</span>
                        )}
                        {sp.closed_at && (
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(sp.closed_at)}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Cierre</p>
                      <p className="text-sm font-semibold text-ink">{formatPriceUsd(sp.closing_price_usd)}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
