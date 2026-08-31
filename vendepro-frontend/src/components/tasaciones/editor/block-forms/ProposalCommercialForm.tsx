'use client'
import { X } from 'lucide-react'
interface ProposalItem { icon?: string; title: string; body: string }
interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

const MAX_ITEMS = 8

function normalize(raw: unknown): ProposalItem {
  if (typeof raw === 'string') return { title: raw, body: '' }
  if (raw && typeof raw === 'object') {
    const o = raw as any
    return { icon: o.icon, title: String(o.title ?? ''), body: String(o.body ?? '') }
  }
  return { title: '', body: '' }
}

export function ProposalCommercialForm({ data, onPatch }: Props) {
  const items: ProposalItem[] = (data.items ?? []).map(normalize)

  const patchItem = (i: number, patch: Partial<ProposalItem>) => {
    const next = items.map((it, idx) => (idx === i ? { ...it, ...patch } : it))
    onPatch({ items: next })
  }
  const addItem = () => {
    if (items.length >= MAX_ITEMS) return
    onPatch({ items: [...items, { title: '', body: '' }] })
  }
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
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-slate-600">Puntos destacados</span>
          <button onClick={addItem} disabled={items.length >= MAX_ITEMS} className="text-xs text-brand-pink disabled:opacity-40">+ Agregar</button>
        </div>
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li key={i} className="rounded border border-slate-200 p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">Punto {i + 1}</span>
                <button onClick={() => removeItem(i)} aria-label="Quitar" className="text-gray-400 hover:text-danger"><X className="w-3.5 h-3.5" /></button>
              </div>
              <input
                value={item.title}
                onChange={e => patchItem(i, { title: e.target.value })}
                placeholder="Título del punto"
                maxLength={120}
                className="mb-1 w-full rounded border border-slate-300 px-2 py-1 text-sm font-medium"
              />
              <textarea
                value={item.body}
                onChange={e => patchItem(i, { body: e.target.value })}
                placeholder="Descripción"
                rows={2}
                maxLength={600}
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
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
