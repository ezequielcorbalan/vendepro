'use client'

import { Plus, Trash2 } from 'lucide-react'
import type { AppraisalWorkConditions } from '../wizardTypes'

interface Props {
  value: AppraisalWorkConditions
  onChange: (v: AppraisalWorkConditions) => void
}

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/20 focus:border-[#ff007c] outline-none'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

function num(v: string): number | null {
  if (v === '' || v === null || v === undefined) return null
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : null
}

export default function WorkConditionsStep({ value, onChange }: Props) {
  const v = value || {}
  const extras = v.extras ?? []
  const set = (patch: Partial<AppraisalWorkConditions>) => onChange({ ...v, ...patch })

  const updateExtra = (i: number, text: string) => {
    const next = [...extras]
    next[i] = text
    set({ extras: next })
  }
  const addExtra = () => set({ extras: [...extras, ''] })
  const removeExtra = (i: number) => set({ extras: extras.filter((_, idx) => idx !== i) })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">Condiciones de trabajo</h2>
      <p className="text-xs text-gray-500 mb-3">
        <span className="mr-1">•</span>
        Honorarios, exclusividad y extras incluidos en el servicio.
      </p>

      <div className="rounded-xl border border-gray-200 p-4 space-y-3 bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Honorarios (%)</label>
            <input
              className={inputClass}
              type="number"
              step="0.1"
              value={v.honorarios_pct ?? ''}
              onChange={(e) => set({ honorarios_pct: num(e.target.value) })}
            />
          </div>
          <div>
            <label className={labelClass}>Honorarios (USD)</label>
            <input
              className={inputClass}
              type="number"
              value={v.honorarios_usd ?? ''}
              onChange={(e) => set({ honorarios_usd: num(e.target.value) })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={!!v.exclusividad}
              onChange={(e) => set({ exclusividad: e.target.checked })}
              className="w-4 h-4 accent-[#ff007c]"
            />
            Exclusividad
          </label>
          <div>
            <label className={labelClass}>Meses de exclusividad</label>
            <input
              className={inputClass}
              type="number"
              value={v.exclusividad_meses ?? ''}
              onChange={(e) => set({ exclusividad_meses: num(e.target.value) })}
              disabled={!v.exclusividad}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 p-4 space-y-3 bg-white">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Servicios incluidos</h3>
          <button
            type="button"
            onClick={addExtra}
            className="flex items-center gap-1 text-xs text-[#ff007c] font-medium hover:underline"
          >
            <Plus className="w-3 h-3" /> Agregar extra
          </button>
        </div>
        {extras.length === 0 && (
          <p className="text-xs text-gray-400">
            <span className="mr-1">•</span>
            Sin extras todavía (p. ej. producción fotográfica, tour 360, home staging).
          </p>
        )}
        {extras.map((text, i) => (
          <div key={i} className="flex gap-2">
            <input
              className={inputClass}
              value={text}
              onChange={(e) => updateExtra(i, e.target.value)}
              placeholder="Ej: Producción fotográfica profesional"
            />
            <button
              type="button"
              onClick={() => removeExtra(i)}
              className="text-red-400 hover:text-red-600 p-2"
              aria-label="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 p-4 space-y-3 bg-white">
        <div>
          <label className={labelClass}>Texto legal</label>
          <textarea
            className={`${inputClass} h-28`}
            value={v.legal_text ?? ''}
            onChange={(e) => set({ legal_text: e.target.value })}
            placeholder="Cláusulas legales, matrícula, etc."
          />
        </div>
      </div>
    </div>
  )
}
