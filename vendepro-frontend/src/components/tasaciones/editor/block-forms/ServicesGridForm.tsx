'use client'
import { BlockField, BlockInput } from './BlockField'
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
      <BlockField label="Título de sección">
        <BlockInput type="text" value={data.title ?? ''} onChange={e => onPatch({ title: e.target.value })} />
      </BlockField>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-gray-600">Servicios</span>
          <button onClick={add} className="text-xs text-brand-pink">+ Agregar</button>
        </div>
        <div className="space-y-2">
          {services.map((svc, i) => (
            <div key={i} className="rounded border border-gray-200 p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Servicio {i + 1}</span>
                <button onClick={() => remove(i)} className="text-xs text-rose-500">Eliminar</button>
              </div>
              <BlockInput placeholder="Icono (emoji o nombre)" value={svc.icon ?? ''} onChange={e => setField(i, 'icon', e.target.value)} />
              <BlockInput placeholder="Nombre del servicio" value={svc.label} onChange={e => setField(i, 'label', e.target.value)} />
              <BlockInput placeholder="Descripción" value={svc.description ?? ''} onChange={e => setField(i, 'description', e.target.value)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
