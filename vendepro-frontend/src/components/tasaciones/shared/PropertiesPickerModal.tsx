'use client'
import { useEffect, useMemo, useState } from 'react'
import { Search, Loader2, Building2, MapPin, Calendar, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import type { ComparableData } from './ComparableCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input, Select } from '@/components/ui/Input'
import { PropertyStageBadge } from '@/components/ui/PropertyStageBadge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { OPERATION_TYPES } from '@/lib/crm-config'

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

/**
 * El listado trae `commercial_stage` del backend, que incluye un par de valores
 * que no son etapas de PROPERTY_STAGES: 'captacion' es como llega 'captada' en
 * registros viejos, y 'alquilada' es una etapa exclusiva de alquiler que vive
 * fuera del mapa. El resto sale del dominio, así que el color no se define acá:
 * antes este mapa local tenía reservada en ámbar y alquilada en violeta, cuando
 * el pipeline las muestra en violeta y cian.
 */
function normalizeStage(stage: string | null | undefined): string {
  const s = (stage ?? '').toLowerCase()
  return s === 'captacion' ? 'captada' : s
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
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-card bg-white shadow-pop"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-brand-pink to-brand-orange h-1" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-ink">Elegir desde una propiedad cargada</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filtros */}
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 z-10" />
              <Input
                placeholder="Buscar dirección, barrio, dueño…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={stage} onChange={e => setStage(e.target.value)}>
              <option value="">Estado: cualquiera</option>
              <option value="propuesta">Propuestas</option>
              <option value="captada">Captadas</option>
              <option value="publicada">Publicadas</option>
              <option value="reservada">Reservadas</option>
              <option value="vendida">Solo vendidas (cierres reales)</option>
              <option value="perdida">Perdidas</option>
            </Select>
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
              <Loader2 className="h-7 w-7 animate-spin text-brand-pink" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-card border border-dashed border-slate-200">
              <EmptyState
                icon={<Building2 className="w-6 h-6" />}
                title={items.length === 0
                  ? 'No tenés propiedades cargadas todavía.'
                  : 'Ninguna propiedad coincide con los filtros.'}
              />
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map(p => {
                const stage = normalizeStage(p.commercial_stage)
                const isVendida = stage === 'vendida'
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => { onPick(mapPropertyToComparable(p)); onClose() }}
                      className="group flex w-full items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-brand-pink/60 hover:bg-rose-50/30"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-ink">{p.address}</span>
                          {stage === 'alquilada' ? (
                            <StatusBadge
                              label="Alquilada"
                              color={OPERATION_TYPES.alquiler.color}
                              size="sm"
                              className="whitespace-nowrap"
                            />
                          ) : stage ? (
                            <PropertyStageBadge stage={stage} className="whitespace-nowrap" />
                          ) : null}
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
                        <p className="text-sm font-semibold text-ink">{formatPriceUsd(p.asking_price)}</p>
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
