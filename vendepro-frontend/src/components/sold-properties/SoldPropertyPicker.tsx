'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, MapPin, Database, Check, Calendar } from 'lucide-react'
import {
  type SoldProperty,
  type SoldPropertyFilters,
  PROPERTY_TYPES,
  listSoldProperties,
} from '@/lib/sold-properties/api'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PillRadioGroup } from '@/components/ui/ChoicePills'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { getSoldOrigin } from '@/lib/crm-config'

interface Props {
  /** Filtros pre-cargados (ej. desde la propiedad que se está tasando). */
  initialFilters?: SoldPropertyFilters
  onClose: () => void
  /** Cuando el usuario confirma una selección. */
  onPick: (selected: SoldProperty[]) => void
  /** Texto del botón de confirmación */
  ctaLabel?: string
  /** Máximo a seleccionar (1 = single). */
  maxSelect?: number
}

export default function SoldPropertyPicker({
  initialFilters,
  onClose,
  onPick,
  ctaLabel = 'Sumar como comparables',
  maxSelect = 6,
}: Props) {
  const [filters, setFilters] = useState<SoldPropertyFilters>({ origin: 'all', ...initialFilters })
  const [items, setItems] = useState<SoldProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function reload() {
    setLoading(true)
    listSoldProperties(filters)
      .then(setItems)
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [
    filters.origin, filters.property_type, filters.neighborhood,
    filters.min_covered_area, filters.max_covered_area,
  ])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < maxSelect) next.add(id)
      return next
    })
  }

  const chosen = useMemo(() => items.filter(i => selected.has(i.id)), [items, selected])

  return (
    <Modal
      open
      onClose={onClose}
      title="Cierres reales"
      icon={<Database className="w-5 h-5" />}
      padded={false}
      className="max-w-3xl max-h-[90vh] flex flex-col"
      footer={
        <>
          <p className="mr-auto text-xs text-gray-500">
            {selected.size} seleccionado{selected.size === 1 ? '' : 's'}
            {maxSelect && selected.size >= maxSelect ? ` (máx ${maxSelect})` : ''}
          </p>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onPick(chosen)} disabled={chosen.length === 0}>
            {ctaLabel} ({chosen.length})
          </Button>
        </>
      }
    >
        {/* Filtros */}
        <div className="p-4 border-b border-gray-100">
          {/* Elegir UN origen de una lista horizontal es exactamente
              PillRadioGroup; eran cuatro botones con su propio estado activo. */}
          <PillRadioGroup
            className="mb-3"
            value={filters.origin ?? 'all'}
            onChange={v => setFilters(f => ({ ...f, origin: v as SoldPropertyFilters['origin'] }))}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'mine', label: 'Míos' },
              { value: 'team', label: 'Equipo' },
              { value: 'external', label: 'Externos' },
            ]}
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Select
              value={filters.property_type ?? ''}
              onChange={e => setFilters(f => ({ ...f, property_type: e.target.value || undefined }))}
            >
              <option value="">Tipo: cualquiera</option>
              {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
            <Input
              placeholder="Barrio"
              value={filters.neighborhood ?? ''}
              onChange={e => setFilters(f => ({ ...f, neighborhood: e.target.value || undefined }))}
            />
            <Input
              type="number"
              placeholder="m² desde"
              value={filters.min_covered_area ?? ''}
              onChange={e => setFilters(f => ({ ...f, min_covered_area: e.target.value ? Number(e.target.value) : undefined }))}
            />
            <Input
              type="number"
              placeholder="m² hasta"
              value={filters.max_covered_area ?? ''}
              onChange={e => setFilters(f => ({ ...f, max_covered_area: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
        </div>

        {/* Listado */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Database className="w-6 h-6" />}
              title="No hay cierres reales que coincidan con estos filtros."
            />
          ) : (
            <div className="space-y-2">
              {items.map(sp => {
                const isSelected = selected.has(sp.id)
                const origin = getSoldOrigin(sp.origin)
                return (
                  <Button variant="ghost" size="sm"
                    key={sp.id}
                    type="button"
                    onClick={() => toggle(sp.id)}
                    className={`w-full text-left flex items-center gap-3 p-3 rounded-control border transition ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-control bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {sp.photos[0] ? <img src={sp.photos[0]} alt="" className="w-full h-full object-cover" /> : <MapPin className="w-5 h-5 text-gray-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-ink truncate">
                          {sp.address_approx || sp.neighborhood || sp.property_type}
                        </p>
                        <StatusBadge
                          size="sm"
                          label={origin.label}
                          color={origin.color}
                          className="text-[9px] px-1.5 py-0.5 uppercase"
                        />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                        {sp.neighborhood && <span>{sp.neighborhood}</span>}
                        {(sp.covered_area || sp.total_area) && <span>{sp.covered_area ?? sp.total_area} m²</span>}
                        {typeof sp.rooms === 'number' && <span>{sp.rooms} amb</span>}
                        {sp.closed_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {new Date(sp.closed_at).toLocaleDateString('es-AR')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-ink">
                        {sp.closing_price_usd ? `USD ${sp.closing_price_usd.toLocaleString('es-AR')}` : '—'}
                      </p>
                      {sp.usd_per_m2 && <p className="text-[10px] text-gray-500">{sp.usd_per_m2.toLocaleString('es-AR')}/m²</p>}
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'border-primary bg-primary' : 'border-gray-300'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </Button>
                )
              })}
            </div>
          )}
        </div>

    </Modal>
  )
}
