'use client'
interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

export function MethodologyForm({ data, onPatch }: Props) {
  const steps: string[] = data.steps ?? []

  const setStep = (i: number, val: string) => {
    const next = [...steps]
    next[i] = val
    onPatch({ steps: next })
  }
  const add = () => onPatch({ steps: [...steps, ''] })
  const remove = (i: number) => onPatch({ steps: steps.filter((_, idx) => idx !== i) })

  return (
    <div className="space-y-3 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Título</span>
        <input type="text" value={data.title ?? ''} onChange={e => onPatch({ title: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Descripción</span>
        <textarea rows={3} value={data.description ?? ''} onChange={e => onPatch({ description: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
      </label>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-slate-600">Pasos metodológicos</span>
          <button onClick={add} className="text-xs text-[#ff007c]">+ Agregar</button>
        </div>
        <ul className="space-y-1">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-1">
              <input value={step} onChange={e => setStep(i, e.target.value)} className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs" />
              <button onClick={() => remove(i)} className="text-xs text-rose-500">✕</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
