'use client'
interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

export function ZoneMapForm({ data, onPatch }: Props) {
  return (
    <div className="space-y-3 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Título</span>
        <input type="text" value={data.title ?? ''} onChange={e => onPatch({ title: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Latitud</span>
        <input type="number" step="0.000001" value={data.lat ?? ''} onChange={e => onPatch({ lat: e.target.value ? Number(e.target.value) : null })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Longitud</span>
        <input type="number" step="0.000001" value={data.lng ?? ''} onChange={e => onPatch({ lng: e.target.value ? Number(e.target.value) : null })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Zoom</span>
        <input type="number" min={1} max={20} value={data.zoom ?? 15} onChange={e => onPatch({ zoom: Number(e.target.value) })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Descripción de zona</span>
        <textarea rows={2} value={data.description ?? ''} onChange={e => onPatch({ description: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
      </label>
    </div>
  )
}
