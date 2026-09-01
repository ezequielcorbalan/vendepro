'use client'
import ImageUpload from '@/components/landings/ImageUpload'

interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

export function CoverForm({ data, onPatch }: Props) {
  return (
    <div className="space-y-3 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-gray-600">Título</span>
        <input
          type="text"
          value={data.title ?? ''}
          onChange={e => onPatch({ title: e.target.value })}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-gray-600">Subtítulo</span>
        <input
          type="text"
          value={data.subtitle ?? ''}
          onChange={e => onPatch({ subtitle: e.target.value })}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </label>
      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-gray-600">Imagen de portada</span>
        <ImageUpload
          value={data.cover_image_url ?? ''}
          onChange={(url) => onPatch({ cover_image_url: url })}
          allowPropertyPicker
        />
      </div>
    </div>
  )
}
