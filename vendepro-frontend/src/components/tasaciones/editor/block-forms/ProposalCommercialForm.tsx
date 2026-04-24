'use client'
interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

export function ProposalCommercialForm({ data, onPatch }: Props) {
  const items: string[] = data.items ?? []

  const setItem = (i: number, val: string) => {
    const next = [...items]
    next[i] = val
    onPatch({ items: next })
  }
  const addItem = () => onPatch({ items: [...items, ''] })
  const removeItem = (i: number) => onPatch({ items: items.filter((_, idx) => idx !== i) })

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
        <span className="text-xs uppercase tracking-wide text-slate-600">Cuerpo</span>
        <textarea rows={4} value={data.body ?? ''} onChange={e => onPatch({ body: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
      </label>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-slate-600">Puntos destacados</span>
          <button onClick={addItem} className="text-xs text-[#ff007c]">+ Agregar</button>
        </div>
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex gap-1">
              <input value={item} onChange={e => setItem(i, e.target.value)} className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm" />
              <button onClick={() => removeItem(i)} className="text-xs text-rose-500">✕</button>
            </li>
          ))}
        </ul>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={data.show_agent_signature ?? true} onChange={e => onPatch({ show_agent_signature: e.target.checked })} />
        <span className="text-xs text-slate-600">Mostrar firma del agente</span>
      </label>
    </div>
  )
}
