'use client'
import { Plus } from 'lucide-react'
import type { WizardState } from '../use-wizard-form'
import { ComparableCard } from '../../shared/ComparableCard'

type ComparableRow = WizardState['comparables'][number]

interface Props {
  comparables: WizardState['comparables']
  onAddComparable: (c: ComparableRow) => void
  onPatchComparable: (index: number, patch: Partial<ComparableRow>) => void
  onRemoveComparable: (index: number) => void
}

const EMPTY: ComparableRow = {
  zonaprop_url: null,
  address: null,
  total_area: null,
  covered_area: null,
  price: null,
  usd_per_m2: null,
  days_on_market: null,
  views_per_day: null,
  age: null,
}

export function StepCompetencia({
  comparables,
  onAddComparable,
  onPatchComparable,
  onRemoveComparable,
}: Props) {
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Competencia ZonaProp</h3>
          <p className="mt-1 text-sm text-slate-500">
            Sumá hasta 5–6 publicaciones similares de la zona como referencia. Pegá una captura
            (Ctrl+V) o subí una imagen y completamos los campos automáticamente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onAddComparable({ ...EMPTY })}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#ff007c] px-3 py-2 text-sm text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Agregar
        </button>
      </header>

      {comparables.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
          <p className="text-sm text-slate-500">
            Todavía no agregaste comparables. Click en <strong>Agregar</strong> para sumar el primero.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {comparables.map((c, i) => (
            <ComparableCard
              key={i}
              index={i}
              comparable={c}
              onPatch={(patch) => onPatchComparable(i, patch)}
              onRemove={() => onRemoveComparable(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
