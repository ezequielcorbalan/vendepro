'use client'
import ImageUpload from '@/components/landings/ImageUpload'

interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

export function MethodologyForm({ data, onPatch }: Props) {
  const body = data.body ?? data.description ?? ''

  return (
    <div className="space-y-3 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-gray-600">Título</span>
        <input
          type="text"
          value={data.title ?? ''}
          maxLength={200}
          onChange={e => onPatch({ title: e.target.value })}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-gray-600">Cuerpo</span>
        <textarea
          rows={5}
          value={body}
          maxLength={2000}
          onChange={e => onPatch({ body: e.target.value })}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-gray-600">Texto destacado</span>
        <input
          type="text"
          value={data.highlight_text ?? ''}
          maxLength={400}
          placeholder="Ej: 100% métricas en cada publicación."
          onChange={e => onPatch({ highlight_text: e.target.value })}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </label>
      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-gray-600">Imagen</span>
        <ImageUpload
          value={data.image_url ?? ''}
          onChange={(url) => onPatch({ image_url: url })}
          allowPropertyPicker
        />
      </div>
    </div>
  )
}
