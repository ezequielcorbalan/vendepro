'use client'
interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

export function ComparablesListForm({ data, onPatch }: Props) {
  return (
    <div className="space-y-3 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Título</span>
        <input type="text" value={data.title ?? ''} onChange={e => onPatch({ title: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Descripción</span>
        <textarea rows={2} value={data.description ?? ''} onChange={e => onPatch({ description: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
      </label>
      <p className="text-xs text-slate-400">Los comparables se completan desde el panel de datos de la propiedad.</p>
    </div>
  )
}
