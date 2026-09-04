'use client'
import { BlockField, BlockInput } from '../BlockField'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

interface FunnelStep { label: string; value: number | null; color?: string }

export function FunnelChartForm({ data, onPatch }: Props) {
  const funnel: FunnelStep[] = data.funnel ?? []

  const setStep = (i: number, field: keyof FunnelStep, val: string) => {
    const next = funnel.map((s, idx) => idx === i ? { ...s, [field]: field === 'value' ? (val ? Number(val) : null) : val } : s)
    onPatch({ funnel: next })
  }
  const add = () => onPatch({ funnel: [...funnel, { label: '', value: null }] })
  const remove = (i: number) => onPatch({ funnel: funnel.filter((_, idx) => idx !== i) })

  return (
    <div className="space-y-3 p-3">
      <BlockField label="Título">
        <BlockInput type="text" value={data.title ?? ''} onChange={e => onPatch({ title: e.target.value })} />
      </BlockField>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-gray-600">Etapas del funnel</span>
          <Button variant="ghost" size="sm" onClick={add} className="p-0 text-xs text-brand-pink">+ Agregar</Button>
        </div>
        <div className="space-y-2">
          {funnel.map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <BlockInput placeholder="Etapa" value={step.label} onChange={e => setStep(i, 'label', e.target.value)} className="flex-1 text-xs" />
              <BlockInput type="number" placeholder="Valor" value={step.value ?? ''} onChange={e => setStep(i, 'value', e.target.value)} />
              {/* ds-todo: el DS no tiene selector de color — ver EditableCanvas. Candidato a "ColorInput". */}
              <input type="color" value={step.color ?? '#ff007c'} onChange={e => setStep(i, 'color', e.target.value)} className="h-7 w-7 rounded-control border border-gray-300 p-0.5" />
              <Button variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Quitar" className="p-0 text-gray-400 hover:text-danger"><X className="w-3.5 h-3.5" /></Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
