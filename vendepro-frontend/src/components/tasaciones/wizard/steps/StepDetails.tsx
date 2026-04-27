'use client'
import type { WizardState } from '../use-wizard-form'

interface Props {
  details: WizardState['details']
  onPatchDetails: (patch: Partial<WizardState['details']>) => void
}

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#ff007c] focus:outline-none focus:ring-2 focus:ring-[#ff007c]/30'
const labelClass = 'mb-1 block text-sm font-medium text-slate-700'

export function StepDetails({ details, onPatchDetails }: Props) {
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
    </div>
  )
}
