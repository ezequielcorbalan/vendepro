'use client'
import { X } from 'lucide-react'
interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

export function MarketStatsForm({ data, onPatch }: Props) {
  const vars: string[] = data.vars ?? []

  const setVar = (i: number, val: string) => {
    const next = [...vars]
    next[i] = val
    onPatch({ vars: next })
  }
  const add = () => onPatch({ vars: [...vars, ''] })
  const remove = (i: number) => onPatch({ vars: vars.filter((_, idx) => idx !== i) })

  return (
    <div className="space-y-3 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-gray-600">Título</span>
        <input type="text" value={data.title ?? ''} onChange={e => onPatch({ title: e.target.value })} className="rounded border border-gray-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-gray-600">Descripción</span>
        <textarea rows={2} value={data.description ?? ''} onChange={e => onPatch({ description: e.target.value })} className="rounded border border-gray-300 px-2 py-1 text-sm" />
      </label>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-gray-600">Variables (keys)</span>
          <button onClick={add} className="text-xs text-brand-pink">+ Agregar</button>
        </div>
        <ul className="space-y-1">
          {vars.map((v, i) => (
            <li key={i} className="flex gap-1">
              <input value={v} onChange={e => setVar(i, e.target.value)} placeholder="market.avg_price" className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs font-mono" />
              <button onClick={() => remove(i)} aria-label="Quitar" className="text-gray-400 hover:text-danger"><X className="w-3.5 h-3.5" /></button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
