'use client'
interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

interface Service { icon?: string; label: string; description?: string }

export function ServicesGridForm({ data, onPatch }: Props) {
  const services: Service[] = data.services ?? []

  const setField = (i: number, field: keyof Service, val: string) => {
    const next = services.map((s, idx) => idx === i ? { ...s, [field]: val } : s)
    onPatch({ services: next })
  }
  const add = () => onPatch({ services: [...services, { label: '', description: '' }] })
  const remove = (i: number) => onPatch({ services: services.filter((_, idx) => idx !== i) })

  return (
    <div className="space-y-3 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Título de sección</span>
        <input type="text" value={data.title ?? ''} onChange={e => onPatch({ title: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
      </label>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-slate-600">Servicios</span>
          <button onClick={add} className="text-xs text-brand-pink">+ Agregar</button>
        </div>
        <div className="space-y-2">
          {services.map((svc, i) => (
            <div key={i} className="rounded border border-slate-200 p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Servicio {i + 1}</span>
                <button onClick={() => remove(i)} className="text-xs text-rose-500">Eliminar</button>
              </div>
              <input placeholder="Icono (emoji o nombre)" value={svc.icon ?? ''} onChange={e => setField(i, 'icon', e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1 text-xs" />
              <input placeholder="Nombre del servicio" value={svc.label} onChange={e => setField(i, 'label', e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1 text-xs" />
              <input placeholder="Descripción" value={svc.description ?? ''} onChange={e => setField(i, 'description', e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1 text-xs" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
