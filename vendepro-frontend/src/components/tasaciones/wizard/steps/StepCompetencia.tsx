'use client'
import type { WizardState } from '../use-wizard-form'
import { ComparablesSection, type ComparableItem } from '../../shared/ComparablesSection'
import type { ComparableData } from '../../shared/ComparableCard'

type ComparableRow = WizardState['comparables'][number]

interface Props {
  comparables: WizardState['comparables']
  onAddComparable: (c: ComparableRow) => void
  onPatchComparable: (index: number, patch: Partial<ComparableRow>) => void
  onRemoveComparable: (index: number) => void
  onMoveComparable: (index: number, delta: -1 | 1) => void
}

/** Comparable "vacío" para extender con un nuevo data — el row se completa al pisar onAdd. */
function rowFromData(data: ComparableData): ComparableRow {
  return {
    kind: data.kind ?? 'publicacion',
    zonaprop_url: data.zonaprop_url ?? null,
    address: data.address ?? null,
    total_area: data.total_area ?? null,
    covered_area: data.covered_area ?? null,
    price: data.price ?? null,
    usd_per_m2: data.usd_per_m2 ?? null,
    days_on_market: data.days_on_market ?? null,
    views_per_day: data.views_per_day ?? null,
    age: data.age ?? null,
    closing_price_usd: data.closing_price_usd ?? null,
    closed_at: data.closed_at ?? null,
    source_sold_property_id: data.source_sold_property_id ?? null,
  }
}

export function StepCompetencia({
  comparables,
  onAddComparable,
  onPatchComparable,
  onRemoveComparable,
  onMoveComparable,
}: Props) {
  // En el wizard usamos el índice como key (la lista solo vive en memoria).
  const items: ComparableItem<number>[] = comparables.map((c, i) => ({ ...c, key: i }))

  return (
    <div className="space-y-6">
      <header>
        <h3 className="text-lg font-semibold text-slate-900">Competencia</h3>
        <p className="mt-1 text-sm text-slate-500">
          Sumá hasta 5–6 referencias de la zona. Podés mezclar publicaciones (mercado activo
          de ZonaProp) y cierres reales (ventas efectivas, autorrellenadas desde tu base).
        </p>
      </header>

      <ComparablesSection<number>
        items={items}
        onAdd={(data) => onAddComparable(rowFromData(data))}
        onPatch={(key, patch) => onPatchComparable(key, patch as Partial<ComparableRow>)}
        onRemove={(key) => onRemoveComparable(key)}
        onMove={(index, delta) => onMoveComparable(index, delta)}
        hideHint
      />
    </div>
  )
}
