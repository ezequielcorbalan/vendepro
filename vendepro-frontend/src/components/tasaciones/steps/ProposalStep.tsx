'use client'

import type { AppraisalProposal } from '../wizardTypes'

interface Props {
  value: AppraisalProposal
  onChange: (v: AppraisalProposal) => void
}

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/20 focus:border-[#ff007c] outline-none'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

export default function ProposalStep({ value, onChange }: Props) {
  const v = value || {}
  const set = (patch: Partial<AppraisalProposal>) => onChange({ ...v, ...patch })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">Propuesta comercial</h2>
      <p className="text-xs text-gray-500 mb-3">
        <span className="mr-1">•</span>
        Primer bloque que ve el propietario en la landing pública.
      </p>

      <div className="rounded-xl border border-gray-200 p-4 space-y-3 bg-white">
        <div>
          <label className={labelClass}>Título</label>
          <input
            className={inputClass}
            value={v.title ?? ''}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="Propuesta de Comercialización"
          />
        </div>

        <div>
          <label className={labelClass}>Subtítulo</label>
          <input
            className={inputClass}
            value={v.subtitle ?? ''}
            onChange={(e) => set({ subtitle: e.target.value })}
            placeholder="Opcional"
          />
        </div>

        <div>
          <label className={labelClass}>Cuerpo</label>
          <textarea
            className={`${inputClass} h-40`}
            value={v.body ?? ''}
            onChange={(e) => set({ body: e.target.value })}
            placeholder="Detalle de la propuesta, pasos del proceso, etc."
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={v.show_agent_signature !== false}
            onChange={(e) => set({ show_agent_signature: e.target.checked })}
            className="w-4 h-4 accent-[#ff007c]"
          />
          Mostrar firma del agente al pie
        </label>
      </div>
    </div>
  )
}
