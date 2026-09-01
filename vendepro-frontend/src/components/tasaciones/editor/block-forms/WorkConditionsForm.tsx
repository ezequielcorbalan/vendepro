'use client'
interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

export function WorkConditionsForm({ data, onPatch }: Props) {
  return (
    <div className="space-y-3 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-gray-600">Honorarios %</span>
        <input type="number" step="0.1" value={data.honorarios_pct ?? ''} onChange={e => onPatch({ honorarios_pct: e.target.value ? Number(e.target.value) : null })} className="rounded border border-gray-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-gray-600">Exclusividad (días)</span>
        <input type="number" value={data.exclusividad_dias ?? ''} onChange={e => onPatch({ exclusividad_dias: e.target.value ? Number(e.target.value) : null })} className="rounded border border-gray-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-gray-600">Texto legal</span>
        <textarea rows={3} value={data.legal_text ?? ''} onChange={e => onPatch({ legal_text: e.target.value })} className="rounded border border-gray-300 px-2 py-1 text-sm" />
      </label>
    </div>
  )
}
