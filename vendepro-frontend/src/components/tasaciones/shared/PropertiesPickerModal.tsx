'use client'
import { useEffect, useMemo, useState } from 'react'
import { Search, Loader2, Building2, MapPin, Calendar, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import type { ComparableData } from './ComparableCard'

interface PropertyLite {
  id: string
  address: string
  neighborhood?: string | null
  property_type?: string | null
  size_m2?: number | null
  asking_price?: number | null
  currency?: string | null
  commercial_stage?: string | null
  owner_name?: string | null
  agent_name?: string | null
  updated_at?: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  /** Se invoca con los datos ya mapeados a un comparable (kind según stage). */
  onPick: (data: ComparableData) => void
}

/**
 * Mapea una propiedad del CRM → ComparableData. Si la propiedad está en
 * stage 'vendida', se trata como cierre real (kind='venta', asking_price
 * pasa a closing_price_usd y updated_at a closed_at). En otros estados
 * cuenta como publicación (asking_price → price).
 */
export function mapPropertyToComparable(p: PropertyLite): ComparableData {
  const isVendida = (p.commercial_stage ?? '').toLowerCase() === 'vendida'
  const usdPrice = (p.currency && p.currency !== 'USD') ? null : (p.asking_price ?? null)
  return {
    kind: isVendida ? 'venta' : 'publicacion',
    address: p.address,
    total_area: p.size_m2 ?? null,
    covered_area: null,
    price: isVendida ? null : usdPrice,
    closing_price_usd: isVendida ? usdPrice : null,
    closed_at: isVendida ? (p.updated_at ?? null) : null,
    usd_per_m2: null,
    age: null,
    days_on_market: null,
    views_per_day: null,
    zonaprop_url: null,
    source_sold_property_id: null,
  }
}

function formatPriceUsd(n: number | null | undefined): string {
  if (typeof n !== 'number') return '—'
  return `USD ${n.toLocaleString('es-AR')}`
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('es-AR') } catch { return d }
}

const STAGE_LABELS: Record<string, { label: string; cls: string }> = {
  propuesta: { label: 'Propuesta', cls: 'bg-gray-100 text-gray-600' },
  captada: { label: 'Captada', cls: 'bg-green-100 text-green-700' },
  captacion: { label: 'Captación', cls: 'bg-green-100 text-green-700' },
  publicada: { label: 'Publicada', cls: 'bg-blue-100 text-blue-700' },
  reservada: { label: 'Reservada', cls: 'bg-amber-100 text-amber-700' },
  vendida: { label: 'Vendida', cls: 'bg-emerald-100 text-emerald-700' },
  alquilada: { label: 'Alquilada', cls: 'bg-purple-100 text-purple-700' },
  perdida: { label: 'Perdida', cls: 'bg-red-100 text-red-700' },
  invalida: { label: 'Inválida', cls: 'bg-gray-100 text-gray-500' },
}

export function PropertiesPickerModal({ open, onClose, onPick }: Props) {
  const [items, setItems] = useState<PropertyLite[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState<string>('')

  // Reset filtros al abrir.
  useEffect(() => {
    if (!open) return
    setSearch('')
    setStage('')
  }, [open])

  // Carga al abrir.
  useEffect(() => {
    if (!open) return
    setLoading(true)
    apiFetch('properties', '/properties')
      .then(r => r.json())
      .then((data: any) => {
        const list: PropertyLite[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.properties) ? data.properties : []
        setItems(list)
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [open])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter(p => {
      if (stage && (p.commercial_stage ?? '').toLowerCase() !== stage) return false
      if (!q) return true
      const haystack = [
        p.address, p.neighborhood, p.property_type, p.owner_name, p.agent_name,
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [items, search, stage])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-[#ff007c] to-[#ff8017] h-1" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#ff007c]" />
            <h2 className="text-lg font-semibold text-slate-900">Elegir desde una propiedad cargada</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filtros */}
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Buscar dirección, barrio, dueño…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2 py-1.5 text-xs"
              />
            </div>
            <select
              value={stage}
              onChange={e => setStage(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
            >
              <option value="">Estado: cualquiera</option>
              <option value="propuesta">Propuestas</option>
              <option value="captada">Captadas</option>
              <option value="publicada">Publicadas</option>
              <option value="reservada">Reservadas</option>
              <option value="vendida">Solo vendidas (cierres reales)</option>
              <option value="perdida">Perdidas</option>
            </select>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Las propiedades en estado <strong>vendida</strong> se agregan como cierre real;
            el resto como publicación.
          </p>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-[#ff007c]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center">
              <Building2 className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-700">
                {items.length === 0
                  ? 'No tenés propiedades cargadas todavía.'
                  : 'Ninguna propiedad coincide con los filtros.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map(p => {
                const stageInfo = STAGE_LABELS[(p.commercial_stage ?? '').toLowerCase()] ?? null
                const isVendida = (p.commercial_stage ?? '').toLowerCase() === 'vendida'
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => { onPick(mapPropertyToComparable(p)); onClose() }}
                      className="group flex w-full items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-[#ff007c]/60 hover:bg-rose-50/30"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-slate-800">{p.address}</span>
                          {stageInfo && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${stageInfo.cls}`}>
                              {stageInfo.label}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                          {p.neighborhood && (
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.neighborhood}</span>
                          )}
                          {p.property_type && <span>{p.property_type}</span>}
                          {typeof p.size_m2 === 'number' && <span>{p.size_m2} m²</span>}
                          {isVendida && p.updated_at && (
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(p.updated_at)}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">{isVendida ? 'Cierre' : 'Listado'}</p>
                        <p className="text-sm font-semibold text-slate-800">{formatPriceUsd(p.asking_price)}</p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
