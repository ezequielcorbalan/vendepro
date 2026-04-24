'use client'
interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

interface VideoItem { url: string; label?: string }

export function VideoGalleryForm({ data, onPatch }: Props) {
  const videos: VideoItem[] = data.videos ?? []

  const setField = (i: number, field: keyof VideoItem, val: string) => {
    const next = videos.map((v, idx) => idx === i ? { ...v, [field]: val } : v)
    onPatch({ videos: next })
  }
  const add = () => onPatch({ videos: [...videos, { url: '', label: '' }] })
  const remove = (i: number) => onPatch({ videos: videos.filter((_, idx) => idx !== i) })

  return (
    <div className="space-y-3 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Título</span>
        <input type="text" value={data.title ?? ''} onChange={e => onPatch({ title: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
      </label>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-slate-600">Videos</span>
          <button onClick={add} className="text-xs text-[#ff007c]">+ Agregar</button>
        </div>
        <div className="space-y-2">
          {videos.map((vid, i) => (
            <div key={i} className="rounded border border-slate-200 p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Video {i + 1}</span>
                <button onClick={() => remove(i)} className="text-xs text-rose-500">Eliminar</button>
              </div>
              <input type="url" placeholder="URL del video (YouTube embed)" value={vid.url} onChange={e => setField(i, 'url', e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1 text-xs" />
              <input placeholder="Etiqueta (opcional)" value={vid.label ?? ''} onChange={e => setField(i, 'label', e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1 text-xs" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
