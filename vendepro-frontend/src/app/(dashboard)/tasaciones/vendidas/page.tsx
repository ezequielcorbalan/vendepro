'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Search, Loader2, MapPin, TrendingDown,
  Calendar, Pencil, Trash2, Database, Image as ImageIcon, User, Building,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Text } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import {
  type SoldProperty, type SoldPropertyFilters,
  PROPERTY_TYPES,
  listSoldProperties, deleteSoldProperty,
} from '@/lib/sold-properties/api'
import SoldPropertyForm from '@/components/sold-properties/SoldPropertyForm'

const ORIGIN_LABELS: Record<string, { label: string; cls: string }> = {
  mine: { label: 'Mías', cls: 'bg-pink-100 text-pink-800' },
  team: { label: 'Equipo', cls: 'bg-blue-100 text-blue-800' },
  external: { label: 'Externos', cls: 'bg-amber-100 text-amber-800' },
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
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-ink mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a Tasaciones
      </Link>

      {/* Header */}
      <PageHeader
        title="Cierres reales"
        subtitle="Base de propiedades vendidas — usalas como comparables para tasar."
        actions={
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setCreating(true)}>
            Cargar cierre
          </Button>
        }
        className="mb-5"
      />

      {/* Resumen */}
      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <Card className="p-3">
            <Text size="xs" tone="muted" className="uppercase tracking-wide">Cargados</Text>
            <Text size="lg" weight="semibold" className="mt-1">{totals.count}</Text>
          </Card>
          <Card className="p-3">
            <Text size="xs" tone="muted" className="uppercase tracking-wide">Cierre promedio</Text>
            <Text size="lg" weight="semibold" className="mt-1">{formatPrice(totals.avgClose)}</Text>
          </Card>
          <Card className="p-3">
            <Text size="xs" tone="muted" className="uppercase tracking-wide">USD/m² promedio</Text>
            <Text size="lg" weight="semibold" className="mt-1">{totals.avgUsdM2 ? `USD ${totals.avgUsdM2.toLocaleString('es-AR')}` : '—'}</Text>
          </Card>
          <Card className="p-3">
            <Text size="xs" tone="muted" className="uppercase tracking-wide">Descuento medio</Text>
            <Text size="lg" weight="semibold" className="mt-1">{totals.avgDiscount !== null ? `${totals.avgDiscount}%` : '—'}</Text>
          </Card>
        </div>
      )}

      {/* Origen: toggle de pertenencia */}
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'mine', 'team', 'external'] as const).map(o => {
          const active = (filters.origin ?? 'all') === o
          const labels = { all: 'Todos', mine: 'Míos', team: 'Equipo', external: 'Externos' }
          return (
            <button
              key={o}
              type="button"
              onClick={() => setFilters(f => ({ ...f, origin: o }))}
              className={`px-3 py-1.5 rounded-control text-xs font-medium ${
                active ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {labels[o]}
            </button>
          )
        })}
      </div>

      {/* Búsqueda + filtros: una sola fila compacta (sin labels ni card propio) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
          <Input
            placeholder="Buscar dirección, barrio..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') loadItems() }}
            className="pl-10"
          />
        </div>
        <Select
          aria-label="Tipo"
          value={filters.property_type ?? ''}
          onChange={e => setFilters(f => ({ ...f, property_type: e.target.value || undefined }))}
          className="w-auto"
        >
          <option value="">Tipo: cualquiera</option>
          {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
        <Input
          aria-label="Barrio"
          placeholder="Barrio"
          value={filters.neighborhood ?? ''}
          onChange={e => setFilters(f => ({ ...f, neighborhood: e.target.value || undefined }))}
          className="w-auto"
        />
        <Input
          aria-label="m² desde"
          type="number"
          placeholder="m² desde"
          value={filters.min_covered_area ?? ''}
          onChange={e => setFilters(f => ({ ...f, min_covered_area: e.target.value ? Number(e.target.value) : undefined }))}
          className="w-auto"
        />
        <Input
          aria-label="m² hasta"
          type="number"
          placeholder="m² hasta"
          value={filters.max_covered_area ?? ''}
          onChange={e => setFilters(f => ({ ...f, max_covered_area: e.target.value ? Number(e.target.value) : undefined }))}
          className="w-auto"
        />
        {(filters.property_type || filters.neighborhood || filters.min_covered_area != null || filters.max_covered_area != null || search) && (
          <button
            onClick={() => { setFilters(f => ({ origin: f.origin })); setSearch('') }}
            className="text-xs text-gray-500 hover:text-primary shrink-0"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Listado */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Database className="w-6 h-6" />}
            title="Todavía no cargaste ningún cierre real"
            description="Cargá ventas tuyas o de colegas para tener mejor contexto al tasar."
            action={
              <Button icon={<Plus className="w-4 h-4" />} onClick={() => setCreating(true)}>
                Cargar el primero
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(sp => {
            const origin = ORIGIN_LABELS[sp.origin] ?? ORIGIN_LABELS.external
            const discount = sp.listing_price_usd && sp.closing_price_usd
              ? Math.round((1 - sp.closing_price_usd / sp.listing_price_usd) * 1000) / 10
              : null
            return (
              <Card key={sp.id} padded={false} interactive className="overflow-hidden">
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
                      <Text as="h3" weight="semibold" className="truncate">
                        {sp.address_approx || sp.neighborhood || sp.property_type}
                      </Text>
                      {sp.neighborhood && (
                        <Text size="xs" tone="muted" className="flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" /> {sp.neighborhood}
                        </Text>
                      )}
                    </div>
                    <StatusBadge label={origin.label} color={origin.cls} className="whitespace-nowrap" />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div>
                      <p className="text-gray-400 text-[10px]">Cierre</p>
                      <p className="text-ink font-semibold">{formatPrice(sp.closing_price_usd)}</p>
                    </div>
                    {sp.usd_per_m2 && (
                      <div>
                        <p className="text-gray-400 text-[10px]">USD/m²</p>
                        <p className="text-ink font-semibold">{sp.usd_per_m2.toLocaleString('es-AR')}</p>
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
                    <Button
                      variant="ghost"
                      icon={<Pencil className="w-3 h-3" />}
                      onClick={() => setEditing(sp)}
                      className="flex-1 text-gray-600 hover:text-primary"
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      icon={<Trash2 className="w-3 h-3" />}
                      onClick={() => handleDelete(sp.id, sp.address_approx ?? sp.neighborhood ?? 'este cierre')}
                      className="flex-1 text-gray-600 hover:text-danger"
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal create/edit */}
      <Modal
        open={creating || editing !== null}
        onClose={() => { setCreating(false); setEditing(null) }}
        title={editing ? 'Editar cierre real' : 'Cargar cierre real'}
        className="max-w-2xl"
      >
        <div className="max-h-[75vh] overflow-y-auto">
          <SoldPropertyForm
            initial={editing}
            onCancel={() => { setCreating(false); setEditing(null) }}
            onSaved={() => { setCreating(false); setEditing(null); loadItems() }}
          />
        </div>
      </Modal>
    </div>
  )
}
