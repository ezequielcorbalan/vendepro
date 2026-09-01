'use client'
import { Button } from '@/components/ui/Button'
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
        <p className="text-sm text-gray-500">
          Sumá comparables similares de la zona. Pueden ser <strong>publicaciones</strong>{' '}
          (mercado activo) o <strong>cierres reales</strong> (ventas efectivas) — los datos
          de cierres podés autorrellenarlos desde tu base.
        </p>
      ))}

      {/* Cuatro maneras de agregar un comparable. Antes eran cuatro botones de
          cuatro colores distintos —gradiente, verde, azul y gris— como si cada
          uno significara algo diferente: son la misma acción con distinta
          fuente. Una principal y tres secundarias; lo que distingue a cada una
          es el ícono. */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => onAdd(emptyPublicacion())} icon={<Plus className="h-4 w-4" />}>
          Agregar publicación
        </Button>
        <Button variant="outline" onClick={() => setSoldPickerOpen(true)} icon={<Database className="h-4 w-4" />}>
          Desde Cierres Reales
        </Button>
        <Button variant="outline" onClick={() => setPropsPickerOpen(true)} icon={<Building2 className="h-4 w-4" />}>
          Desde una propiedad
        </Button>
        <Button
          variant="outline"
          onClick={() => onAdd(emptyVenta())}
          icon={<Plus className="h-4 w-4" />}
          title="Cargar un cierre real a mano (sin tomarlo de tu base)"
        >
          Cierre manual
        </Button>
      </div>

      {/* Lista */}
      {items.length === 0 ? (
        <div className="rounded-card border border-dashed border-gray-300">
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
