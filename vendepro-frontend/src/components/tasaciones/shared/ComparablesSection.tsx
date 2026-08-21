'use client'
import { useState } from 'react'
import { Plus, Database, Building2 } from 'lucide-react'
import { ComparableCard, type ComparableData } from './ComparableCard'
import { SoldPropertiesPickerModal } from './SoldPropertiesPickerModal'
import { PropertiesPickerModal } from './PropertiesPickerModal'
import { EmptyState } from '@/components/ui/EmptyState'

/**
 * Cualquier estructura que tenga al menos los campos de un ComparableData
 * y opcionalmente una clave estable para el list rendering.
 */
export type ComparableItem<Key = string | number> = ComparableData & { key: Key }

interface Props<Key extends string | number> {
  items: ComparableItem<Key>[]
  /** Se llama al agregar un comparable nuevo. */
  onAdd: (data: ComparableData) => void
  /** Patch parcial sobre el item identificado por su key. */
  onPatch: (key: Key, patch: Partial<ComparableData>) => void
  /** Eliminar item por key. */
  onRemove: (key: Key) => void
  /** Reordenar: swap del item en `index` con `index + delta` (delta = -1 o +1). */
  onMove?: (index: number, delta: -1 | 1) => void

  /** Texto introductorio sobre la sección (opcional). */
  hint?: React.ReactNode
  /** Si true, oculta el hint (en editor lo dejamos limpio). */
  hideHint?: boolean
}

export function ComparablesSection<Key extends string | number>({
  items, onAdd, onPatch, onRemove, onMove,
  hint, hideHint = false,
}: Props<Key>) {
  const [soldPickerOpen, setSoldPickerOpen] = useState(false)
  const [propsPickerOpen, setPropsPickerOpen] = useState(false)

  const emptyPublicacion = (): ComparableData => ({
    kind: 'publicacion',
    zonaprop_url: null,
    address: null,
    total_area: null,
    covered_area: null,
    price: null,
    usd_per_m2: null,
    days_on_market: null,
    views_per_day: null,
    age: null,
    closing_price_usd: null,
    closed_at: null,
    source_sold_property_id: null,
  })

  const emptyVenta = (): ComparableData => ({
    kind: 'venta',
    zonaprop_url: null,
    address: null,
    total_area: null,
    covered_area: null,
    price: null,
    usd_per_m2: null,
    days_on_market: null,
    views_per_day: null,
    age: null,
    closing_price_usd: null,
    closed_at: null,
    source_sold_property_id: null,
  })

  return (
    <div className="space-y-5">
      {!hideHint && (hint ?? (
        <p className="text-sm text-slate-500">
          Sumá comparables similares de la zona. Pueden ser <strong>publicaciones</strong>{' '}
          (mercado activo) o <strong>cierres reales</strong> (ventas efectivas) — los datos
          de cierres podés autorrellenarlos desde tu base.
        </p>
      ))}

      {/* Botones de agregar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onAdd(emptyPublicacion())}
          className="flex items-center gap-1.5 rounded-control bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Agregar publicación
        </button>
        {/* Regla 11: las tres fuentes alternativas son controles neutros — antes
            cada una tenía su propio color (verde, azul, gris) y competían con la
            acción primaria. Las distingue el ícono. */}
        <button
          type="button"
          onClick={() => setSoldPickerOpen(true)}
          className="flex items-center gap-1.5 rounded-control border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Database className="h-4 w-4" aria-hidden="true" /> Desde Cierres Reales
        </button>
        <button
          type="button"
          onClick={() => setPropsPickerOpen(true)}
          className="flex items-center gap-1.5 rounded-control border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Building2 className="h-4 w-4" aria-hidden="true" /> Desde una propiedad
        </button>
        <button
          type="button"
          onClick={() => onAdd(emptyVenta())}
          className="flex items-center gap-1.5 rounded-control border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          title="Cargar un cierre real a mano (sin tomarlo de tu base)"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Cierre manual
        </button>
      </div>

      {/* Lista */}
      {items.length === 0 ? (
        <div className="rounded-card border border-dashed border-slate-300">
          <EmptyState icon={<Building2 className="w-6 h-6" />} title="Todavía no agregaste comparables." />
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c, i) => (
            <ComparableCard
              key={c.key}
              index={i}
              comparable={c}
              onPatch={(patch) => onPatch(c.key, patch)}
              onRemove={() => onRemove(c.key)}
              onMoveUp={onMove ? () => onMove(i, -1) : undefined}
              onMoveDown={onMove ? () => onMove(i, +1) : undefined}
              canMoveUp={i > 0}
              canMoveDown={i < items.length - 1}
            />
          ))}
        </div>
      )}

      <SoldPropertiesPickerModal
        open={soldPickerOpen}
        onClose={() => setSoldPickerOpen(false)}
        onPick={(data) => onAdd(data)}
      />
      <PropertiesPickerModal
        open={propsPickerOpen}
        onClose={() => setPropsPickerOpen(false)}
        onPick={(data) => onAdd(data)}
      />
    </div>
  )
}
