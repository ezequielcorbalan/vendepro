'use client'
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { WizardState } from '../use-wizard-form'
import type { AppraisalComparable } from '../../renderer/types'

type ComparableRow = Omit<AppraisalComparable, 'id' | 'appraisal_id' | 'sort_order'> & { sort_order?: number }

interface Props {
  details: WizardState['details']
  comparables: WizardState['comparables']
  onPatchDetails: (patch: Partial<WizardState['details']>) => void
  onAddComparable: (c: ComparableRow) => void
  onRemoveComparable: (index: number) => void
}

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#ff007c] focus:outline-none focus:ring-2 focus:ring-[#ff007c]/30'
const labelClass = 'mb-1 block text-sm font-medium text-slate-700'

const emptyModal: Omit<ComparableRow, 'sort_order'> = {
  zonaprop_url: null,
  address: null,
  total_area: null,
  covered_area: null,
  price: null,
  usd_per_m2: null,
}

export function StepDetails({ details, comparables, onPatchDetails, onAddComparable, onRemoveComparable }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [modal, setModal] = useState<typeof emptyModal>(emptyModal)

  function handleAddComparable() {
    onAddComparable({ ...modal })
    setModal(emptyModal)
    setShowModal(false)
  }

  return (
    <div className="space-y-8">
      {/* SWOT */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-slate-800">Análisis FODA</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(
            [
              { key: 'strengths', label: 'Fortalezas' },
              { key: 'weaknesses', label: 'Debilidades' },
              { key: 'opportunities', label: 'Oportunidades' },
              { key: 'threats', label: 'Amenazas' },
            ] as const
          ).map(({ key, label }) => (
            <div key={key}>
              <label className={labelClass}>{label}</label>
              <textarea
                rows={3}
                value={details[key] ?? ''}
                onChange={(e) => onPatchDetails({ [key]: e.target.value || null })}
                className={inputClass}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Prices */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-slate-800">Valuación</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Precio sugerido (USD)</label>
            <input
              type="number"
              min={0}
              value={details.suggested_price ?? ''}
              onChange={(e) =>
                onPatchDetails({ suggested_price: e.target.value ? Number(e.target.value) : null })
              }
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Precio de prueba (USD)</label>
            <input
              type="number"
              min={0}
              value={details.test_price ?? ''}
              onChange={(e) =>
                onPatchDetails({ test_price: e.target.value ? Number(e.target.value) : null })
              }
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Precio de cierre esperado (USD)</label>
            <input
              type="number"
              min={0}
              value={details.expected_close_price ?? ''}
              onChange={(e) =>
                onPatchDetails({ expected_close_price: e.target.value ? Number(e.target.value) : null })
              }
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>USD/m²</label>
            <input
              type="number"
              min={0}
              value={details.usd_per_m2 ?? ''}
              onChange={(e) =>
                onPatchDetails({ usd_per_m2: e.target.value ? Number(e.target.value) : null })
              }
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* Comparables */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">Comparables de mercado</h3>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#ff007c] px-3 py-1.5 text-sm text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Agregar
          </button>
        </div>

        {comparables.length === 0 ? (
          <p className="text-sm text-slate-400">Todavía no agregaste comparables.</p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border">
            {comparables.map((c, i) => (
              <div key={i} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {c.address ?? c.zonaprop_url ?? `Comparable ${i + 1}`}
                  </p>
                  <p className="text-xs text-slate-400">
                    {c.total_area ? `${c.total_area} m²` : ''}
                    {c.price ? ` · USD ${c.price.toLocaleString()}` : ''}
                    {c.usd_per_m2 ? ` · ${c.usd_per_m2} USD/m²` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveComparable(i)}
                  className="shrink-0 text-slate-300 hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add comparable modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-base font-semibold text-slate-800">Agregar comparable</h4>
              <button
                type="button"
                onClick={() => { setShowModal(false); setModal(emptyModal) }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelClass}>Dirección</label>
                <input
                  type="text"
                  value={modal.address ?? ''}
                  onChange={(e) => setModal((m) => ({ ...m, address: e.target.value || null }))}
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>URL Zonaprop</label>
                <input
                  type="url"
                  value={modal.zonaprop_url ?? ''}
                  onChange={(e) => setModal((m) => ({ ...m, zonaprop_url: e.target.value || null }))}
                  placeholder="https://www.zonaprop.com.ar/..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Sup. total (m²)</label>
                <input
                  type="number"
                  min={0}
                  value={modal.total_area ?? ''}
                  onChange={(e) =>
                    setModal((m) => ({ ...m, total_area: e.target.value ? Number(e.target.value) : null }))
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Sup. cubierta (m²)</label>
                <input
                  type="number"
                  min={0}
                  value={modal.covered_area ?? ''}
                  onChange={(e) =>
                    setModal((m) => ({ ...m, covered_area: e.target.value ? Number(e.target.value) : null }))
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Precio (USD)</label>
                <input
                  type="number"
                  min={0}
                  value={modal.price ?? ''}
                  onChange={(e) =>
                    setModal((m) => ({ ...m, price: e.target.value ? Number(e.target.value) : null }))
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>USD/m²</label>
                <input
                  type="number"
                  min={0}
                  value={modal.usd_per_m2 ?? ''}
                  onChange={(e) =>
                    setModal((m) => ({ ...m, usd_per_m2: e.target.value ? Number(e.target.value) : null }))
                  }
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowModal(false); setModal(emptyModal) }}
                className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddComparable}
                className="rounded-lg bg-[#ff007c] px-5 py-2 text-sm text-white hover:opacity-90"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
