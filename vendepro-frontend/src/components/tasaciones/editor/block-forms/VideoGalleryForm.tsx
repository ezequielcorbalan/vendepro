'use client'

interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }
type Provider = 'youtube' | 'vimeo' | 'r2'
interface VideoItem { url: string; caption?: string; provider: Provider }

const MAX_ITEMS = 12

function detectProvider(url: string): Provider {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube'
  if (/vimeo\.com/i.test(url)) return 'vimeo'
  return 'r2'
}

function normalize(raw: unknown): VideoItem {
  const o = (raw ?? {}) as any
  const url = typeof o.url === 'string' ? o.url : ''
  const provider: Provider = o.provider === 'youtube' || o.provider === 'vimeo' || o.provider === 'r2'
    ? o.provider
    : detectProvider(url)
  return {
    url,
    provider,
    caption: typeof o.caption === 'string' ? o.caption : (typeof o.label === 'string' ? o.label : ''),
  }
}

export function VideoGalleryForm({ data, onPatch }: Props) {
  const videos: VideoItem[] = (data.videos ?? []).map(normalize)

  const patchItem = (i: number, patch: Partial<VideoItem>) => {
    const next = videos.map((v, idx) => {
      if (idx !== i) return v
      const merged = { ...v, ...patch }
      if (patch.url !== undefined) merged.provider = detectProvider(patch.url)
      return merged
    })
    onPatch({ videos: next })
  }
  const add = () => {
    if (videos.length >= MAX_ITEMS) return
    onPatch({ videos: [...videos, { url: '', provider: 'youtube', caption: '' }] })
  }
  const remove = (i: number) => onPatch({ videos: videos.filter((_, idx) => idx !== i) })

  return (
    <div className="space-y-3 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Título</span>
        <input
          type="text"
          value={data.title ?? ''}
          maxLength={200}
          onChange={e => onPatch({ title: e.target.value })}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </label>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-slate-600">Videos</span>
          <button onClick={add} disabled={videos.length >= MAX_ITEMS} className="text-xs text-[#ff007c] disabled:opacity-40">+ Agregar</button>
        </div>
        <div className="space-y-2">
          {videos.map((vid, i) => (
            <div key={i} className="space-y-1 rounded border border-slate-200 p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Video {i + 1} · {vid.provider}</span>
                <button onClick={() => remove(i)} className="text-xs text-rose-500">Eliminar</button>
              </div>
              <input
                type="url"
                placeholder="URL de YouTube, Vimeo o archivo .mp4"
                value={vid.url}
                onChange={e => patchItem(i, { url: e.target.value })}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
              <input
                placeholder="Pie de video (opcional)"
                value={vid.caption ?? ''}
                maxLength={200}
                onChange={e => patchItem(i, { caption: e.target.value })}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
