'use client'
import { BlockField, BlockInput, BlockSelect } from './BlockField'
import ImageUpload from '@/components/landings/ImageUpload'

interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }
interface MediaItem { url: string; type: 'image' | 'video'; caption?: string }

const MAX_ITEMS = 24

function normalize(raw: unknown): MediaItem {
  const o = (raw ?? {}) as any
  const type: 'image' | 'video' = o.type === 'video' ? 'video' : 'image'
  return {
    url: typeof o.url === 'string' ? o.url : '',
    type,
    caption: typeof o.caption === 'string' ? o.caption : (typeof o.label === 'string' ? o.label : ''),
  }
}

export function ExtraMediaForm({ data, onPatch }: Props) {
  const media: MediaItem[] = (data.media ?? []).map(normalize)

  const patchItem = (i: number, patch: Partial<MediaItem>) => {
    const next = media.map((m, idx) => (idx === i ? { ...m, ...patch } : m))
    onPatch({ media: next })
  }
  const add = () => {
    if (media.length >= MAX_ITEMS) return
    onPatch({ media: [...media, { url: '', type: 'image', caption: '' }] })
  }
  const remove = (i: number) => onPatch({ media: media.filter((_, idx) => idx !== i) })

  return (
    <div className="space-y-3 p-3">
      <BlockField label="Título">
        <BlockInput
          type="text"
          value={data.title ?? ''}
          maxLength={200}
          onChange={e => onPatch({ title: e.target.value })}
        />
      </BlockField>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-gray-600">Archivos multimedia</span>
          <button onClick={add} disabled={media.length >= MAX_ITEMS} className="text-xs text-brand-pink disabled:opacity-40">+ Agregar</button>
        </div>
        <div className="space-y-2">
          {media.map((item, i) => (
            <div key={i} className="space-y-2 rounded border border-gray-200 p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Media {i + 1}</span>
                <button onClick={() => remove(i)} className="text-xs text-rose-500">Eliminar</button>
              </div>
              <BlockSelect
                value={item.type}
                onChange={e => patchItem(i, { type: e.target.value as 'image' | 'video' })}
              >
                <option value="image">Imagen</option>
                <option value="video">Video</option>
              </BlockSelect>
              {item.type === 'image' ? (
                <ImageUpload
                  value={item.url}
                  onChange={(url) => patchItem(i, { url })}
                  allowPropertyPicker
                />
              ) : (
                <BlockInput
                  type="url"
                  placeholder="URL del video"
                  value={item.url}
                  onChange={e => patchItem(i, { url: e.target.value })}
                />
              )}
              <BlockInput
                placeholder="Pie de foto (opcional)"
                value={item.caption ?? ''}
                maxLength={200}
                onChange={e => patchItem(i, { caption: e.target.value })}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
