'use client'
import { BlockField, BlockInput, BlockTextarea } from './BlockField'
import { X } from 'lucide-react'
import { Checkbox } from '@/components/ui/Choice'
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
      <BlockField label="Título">
        <BlockInput type="text" value={data.title ?? ''} onChange={e => onPatch({ title: e.target.value })} />
      </BlockField>
      <BlockField label="Subtítulo">
        <BlockInput type="text" value={data.subtitle ?? ''} onChange={e => onPatch({ subtitle: e.target.value })} />
      </BlockField>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-gray-600">Puntos destacados</span>
          <button onClick={addItem} disabled={items.length >= MAX_ITEMS} className="text-xs text-brand-pink disabled:opacity-40">+ Agregar</button>
        </div>
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li key={i} className="rounded border border-gray-200 p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-gray-500">Punto {i + 1}</span>
                <button onClick={() => removeItem(i)} aria-label="Quitar" className="text-gray-400 hover:text-danger"><X className="w-3.5 h-3.5" /></button>
              </div>
              <BlockInput
                value={item.title}
                onChange={e => patchItem(i, { title: e.target.value })}
                placeholder="Título del punto"
                maxLength={120}
                className="mb-1 font-medium"
              />
              <BlockTextarea
                value={item.body}
                onChange={e => patchItem(i, { body: e.target.value })}
                placeholder="Descripción"
                rows={2}
                maxLength={600}
              />
            </li>
          ))}
        </ul>
      </div>
      <Checkbox
        checked={data.show_agent_signature ?? true}
        onChange={v => onPatch({ show_agent_signature: v })}
        label="Mostrar firma del agente"
      />
    </div>
  )
}
