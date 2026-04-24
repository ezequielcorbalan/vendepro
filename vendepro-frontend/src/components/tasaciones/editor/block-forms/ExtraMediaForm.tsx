'use client'
interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

interface MediaItem { url: string; type?: string; label?: string }

export function ExtraMediaForm({ data, onPatch }: Props) {
  const media: MediaItem[] = data.media ?? []

  const setField = (i: number, field: keyof MediaItem, val: string) => {
    const next = media.map((m, idx) => idx === i ? { ...m, [field]: val } : m)
    onPatch({ media: next })
  }
  const add = () => onPatch({ media: [...media, { url: '', type: 'image', label: '' }] })
  const remove = (i: number) => onPatch({ media: media.filter((_, idx) => idx !== i) })

  return (
    <div className="space-y-3 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Título</span>
        <input type="text" value={data.title ?? ''} onChange={e => onPatch({ title: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
      </label>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-slate-600">Archivos multimedia</span>
          <button onClick={add} className="text-xs text-[#ff007c]">+ Agregar</button>
        </div>
        <div className="space-y-2">
          {media.map((item, i) => (
            <div key={i} className="rounded border border-slate-200 p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Media {i + 1}</span>
                <button onClick={() => remove(i)} className="text-xs text-rose-500">Eliminar</button>
              </div>
              <input type="url" placeholder="URL del archivo" value={item.url} onChange={e => setField(i, 'url', e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1 text-xs" />
              <select value={item.type ?? 'image'} onChange={e => setField(i, 'type', e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1 text-xs">
                <option value="image">Imagen</option>
                <option value="video">Video</option>
                <option value="document">Documento</option>
              </select>
              <input placeholder="Etiqueta (opcional)" value={item.label ?? ''} onChange={e => setField(i, 'label', e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1 text-xs" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
