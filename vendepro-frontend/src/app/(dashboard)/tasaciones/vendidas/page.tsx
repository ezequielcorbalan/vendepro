'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Search, Loader2, MapPin, DollarSign, TrendingDown,
  Calendar, Pencil, Trash2, Database, Image as ImageIcon, User, Building,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import {
  type SoldProperty, type SoldPropertyFilters,
  PROPERTY_TYPES,
  listSoldProperties, deleteSoldProperty,
} from '@/lib/sold-properties/api'
import SoldPropertyForm from '@/components/sold-properties/SoldPropertyForm'

const ORIGIN_LABELS: Record<string, { label: string; cls: string }> = {
  mine: { label: 'Mías', cls: 'bg-pink-100 text-pink-700' },
  team: { label: 'Equipo', cls: 'bg-blue-100 text-blue-700' },
  external: { label: 'Externos', cls: 'bg-amber-100 text-amber-700' },
}

function formatPrice(n: number | null | undefined): string {
  if (typeof n !== 'number') return '—'
  return `USD ${n.toLocaleString('es-AR')}`
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('es-AR') } catch { return d }
}

export default function SoldPropertiesPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<SoldProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<SoldPropertyFilters>({ origin: 'all' })
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<SoldProperty | null>(null)
  const [creating, setCreating] = useState(false)

  function loadItems() {
    setLoading(true)
    listSoldProperties({ ...filters, search: search.trim() || undefined })
      .then(setItems)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadItems() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [
    filters.origin, filters.property_type, filters.neighborhood,
    filters.min_covered_area, filters.max_covered_area,
  ])

  const totals = useMemo(() => {
    if (items.length === 0) return null
    const closing = items.filter(x => typeof x.closing_price_usd === 'number').map(x => x.closing_price_usd as number)
    const usdM2 = items.filter(x => typeof x.usd_per_m2 === 'number').map(x => x.usd_per_m2 as number)
    const avg = (a: number[]) => a.length === 0 ? null : Math.round(a.reduce((s, v) => s + v, 0) / a.length)
    const discount = items
      .filter(x => x.listing_price_usd && x.closing_price_usd)
      .map(x => 1 - ((x.closing_price_usd as number) / (x.listing_price_usd as number)))
    return {
      count: items.length,
      avgClose: avg(closing),
      avgUsdM2: avg(usdM2),
      avgDiscount: discount.length ? Math.round((discount.reduce((s, v) => s + v, 0) / discount.length) * 1000) / 10 : null,
    }
  }, [items])

  async function handleDelete(id: string, label: string) {
    if (!confirm(`¿Eliminar el cierre real de ${label}?`)) return
    const ok = await deleteSoldProperty(id)
    if (ok) {
      toast('Cierre eliminado', 'warning')
      loadItems()
    } else {
      toast('Error al eliminar', 'error')
    }
  }

  return (
    <div>
      <Link
        href="/tasaciones"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a Tasaciones
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-pink to-brand-orange" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center shadow-sm">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-800">Cierres reales</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Base de propiedades vendidas — usalas como comparables para tasar.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="bg-brand-pink text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Cargar cierre
          </button>
        </div>
      </div>

      {/* Resumen */}
      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">Cargados</p>
            <p className="text-lg font-semibold text-gray-800 mt-1">{totals.count}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">Cierre promedio</p>
            <p className="text-lg font-semibold text-gray-800 mt-1">{formatPrice(totals.avgClose)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">USD/m² promedio</p>
            <p className="text-lg font-semibold text-gray-800 mt-1">{totals.avgUsdM2 ? `USD ${totals.avgUsdM2.toLocaleString('es-AR')}` : '—'}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">Descuento medio</p>
            <p className="text-lg font-semibold text-gray-800 mt-1">{totals.avgDiscount !== null ? `${totals.avgDiscount}%` : '—'}</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {(['all', 'mine', 'team', 'external'] as const).map(o => {
            const active = (filters.origin ?? 'all') === o
            const labels = { all: 'Todos', mine: 'Míos', team: 'Equipo', external: 'Externos' }
            return (
              <button
                key={o}
                onClick={() => setFilters(f => ({ ...f, origin: o }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  active ? 'bg-brand-pink/10 text-brand-pink' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {labels[o]}
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <select
            value={filters.property_type ?? ''}
            onChange={e => setFilters(f => ({ ...f, property_type: e.target.value || undefined }))}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
          >
            <option value="">Tipo: cualquiera</option>
            {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input
            placeholder="Barrio"
            value={filters.neighborhood ?? ''}
            onChange={e => setFilters(f => ({ ...f, neighborhood: e.target.value || undefined }))}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
          />
          <input
            type="number"
            placeholder="m² desde"
            value={filters.min_covered_area ?? ''}
            onChange={e => setFilters(f => ({ ...f, min_covered_area: e.target.value ? Number(e.target.value) : undefined }))}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
          />
          <input
            type="number"
            placeholder="m² hasta"
            value={filters.max_covered_area ?? ''}
            onChange={e => setFilters(f => ({ ...f, max_covered_area: e.target.value ? Number(e.target.value) : undefined }))}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
          />
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Buscar"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') loadItems() }}
              className="w-full border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Listado */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-pink" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Database className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-700 font-medium mb-1">Todavía no cargaste ningún cierre real</p>
          <p className="text-sm text-gray-500 mb-5">
            Cargá ventas tuyas o de colegas para tener mejor contexto al tasar.
          </p>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 bg-brand-pink text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Cargar el primero
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(sp => {
            const origin = ORIGIN_LABELS[sp.origin] ?? ORIGIN_LABELS.external
            const discount = sp.listing_price_usd && sp.closing_price_usd
              ? Math.round((1 - sp.closing_price_usd / sp.listing_price_usd) * 1000) / 10
              : null
            return (
              <div key={sp.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                {sp.photos[0] ? (
                  <div className="aspect-video bg-gray-100 overflow-hidden">
                    <img src={sp.photos[0]} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="aspect-video bg-gray-50 flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-gray-300" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-800 truncate">
                        {sp.address_approx || sp.neighborhood || sp.property_type}
                      </h3>
                      {sp.neighborhood && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" /> {sp.neighborhood}
                        </p>
                      )}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${origin.cls}`}>
                      {origin.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div>
                      <p className="text-gray-400 text-[10px]">Cierre</p>
                      <p className="text-gray-900 font-semibold">{formatPrice(sp.closing_price_usd)}</p>
                    </div>
                    {sp.usd_per_m2 && (
                      <div>
                        <p className="text-gray-400 text-[10px]">USD/m²</p>
                        <p className="text-gray-900 font-semibold">{sp.usd_per_m2.toLocaleString('es-AR')}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-gray-500 flex-wrap">
                    {(sp.covered_area || sp.total_area) && (
                      <span>{sp.covered_area ?? sp.total_area} m²</span>
                    )}
                    {typeof sp.rooms === 'number' && <span>· {sp.rooms} amb</span>}
                    {sp.closed_at && (
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(sp.closed_at)}</span>
                    )}
                    {discount !== null && (
                      <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3" /> {discount}%</span>
                    )}
                  </div>

                  {sp.origin === 'external' && sp.external_agent_name && (
                    <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                      <User className="w-3 h-3" /> {sp.external_agent_name}
                      {sp.external_agency && <><Building className="w-3 h-3 ml-1" /> {sp.external_agency}</>}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => setEditing(sp)}
                      className="flex-1 text-xs text-gray-600 hover:text-brand-pink flex items-center justify-center gap-1 py-1"
                    >
                      <Pencil className="w-3 h-3" /> Editar
                    </button>
                    <button
                      onClick={() => handleDelete(sp.id, sp.address_approx ?? sp.neighborhood ?? 'este cierre')}
                      className="flex-1 text-xs text-gray-600 hover:text-red-600 flex items-center justify-center gap-1 py-1"
                    >
                      <Trash2 className="w-3 h-3" /> Eliminar
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal create/edit */}
      {(creating || editing) && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => { setCreating(false); setEditing(null) }}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden my-8" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-brand-pink to-brand-orange h-1.5" />
            <div className="p-6 max-h-[80vh] overflow-y-auto">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {editing ? 'Editar cierre real' : 'Cargar cierre real'}
              </h2>
              <SoldPropertyForm
                initial={editing}
                onCancel={() => { setCreating(false); setEditing(null) }}
                onSaved={() => { setCreating(false); setEditing(null); loadItems() }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
