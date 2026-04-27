'use client'
interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

export function ComparablesListForm({ data, onPatch }: Props) {
  const variant: 'published' | 'reserved' = data.variant === 'reserved' ? 'reserved' : 'published'
  return (
    <div className="space-y-3 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Título</span>
        <input
          type="text"
          value={data.title ?? ''}
          maxLength={200}
          onChange={e => onPatch({ title: e.target.value })}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Tipo de comparables</span>
        <select
          value={variant}
          onChange={e => onPatch({ variant: e.target.value })}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="published">Publicados (en venta)</option>
          <option value="reserved">Reservados / vendidos</option>
        </select>
      </label>
      <p className="text-xs text-slate-400">Los comparables se cargan en cada tasación desde el paso "Competencia".</p>
    </div>
  )
}
