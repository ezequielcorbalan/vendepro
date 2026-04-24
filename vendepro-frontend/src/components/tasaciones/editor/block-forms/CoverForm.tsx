'use client'
interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

export function CoverForm({ data, onPatch }: Props) {
  return (
    <div className="space-y-3 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Título</span>
        <input type="text" value={data.title ?? ''} onChange={e => onPatch({ title: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Subtítulo</span>
        <input type="text" value={data.subtitle ?? ''} onChange={e => onPatch({ subtitle: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">URL imagen de portada</span>
        <input type="url" value={data.cover_image_url ?? ''} onChange={e => onPatch({ cover_image_url: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="https://..." />
      </label>
    </div>
  )
}
