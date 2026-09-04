'use client'
import { BlockField, BlockInput, BlockTextarea } from '../BlockField'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
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
      <BlockField label="Título">
        <BlockInput type="text" value={data.title ?? ''} onChange={e => onPatch({ title: e.target.value })} />
      </BlockField>
      <BlockField label="Descripción">
        <BlockTextarea rows={2} value={data.description ?? ''} onChange={e => onPatch({ description: e.target.value })} />
      </BlockField>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-gray-600">Variables (keys)</span>
          <Button variant="ghost" size="sm" onClick={add} className="p-0 text-xs text-brand-pink">+ Agregar</Button>
        </div>
        <ul className="space-y-1">
          {vars.map((v, i) => (
            <li key={i} className="flex gap-1">
              <BlockInput value={v} onChange={e => setVar(i, e.target.value)} placeholder="market.avg_price" className="flex-1 text-xs font-mono" />
              <Button variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Quitar" className="p-0 text-gray-400 hover:text-danger"><X className="w-3.5 h-3.5" /></Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
