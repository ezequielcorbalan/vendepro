'use client'
import { useState } from 'react'
import { Plus, Database, Building2 } from 'lucide-react'
import { ComparableCard, type ComparableData } from './ComparableCard'
import { SoldPropertiesPickerModal } from './SoldPropertiesPickerModal'
import { PropertiesPickerModal } from './PropertiesPickerModal'

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
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-pink to-brand-orange px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Agregar publicación
        </button>
        <button
          type="button"
          onClick={() => setSoldPickerOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
        >
          <Database className="h-4 w-4" /> Desde Cierres Reales
        </button>
        <button
          type="button"
          onClick={() => setPropsPickerOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
        >
          <Building2 className="h-4 w-4" /> Desde una propiedad
        </button>
        <button
          type="button"
          onClick={() => onAdd(emptyVenta())}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          title="Cargar un cierre real a mano (sin tomarlo de tu base)"
        >
          <Plus className="h-4 w-4" /> Cierre manual
        </button>
      </div>

      {/* Lista */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
          <p className="text-sm text-slate-500">
            Todavía no agregaste comparables.
          </p>
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
