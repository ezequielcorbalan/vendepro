'use client'
import { BlockField, BlockInput, BlockTextarea } from '../BlockField'
import ImageUpload from '@/components/landings/ImageUpload'

interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

export function MethodologyForm({ data, onPatch }: Props) {
  const body = data.body ?? data.description ?? ''

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
      <BlockField label="Cuerpo">
        <BlockTextarea
          rows={5}
          value={body}
          maxLength={2000}
          onChange={e => onPatch({ body: e.target.value })}
        />
      </BlockField>
      <BlockField label="Texto destacado">
        <BlockInput
          type="text"
          value={data.highlight_text ?? ''}
          maxLength={400}
          placeholder="Ej: 100% métricas en cada publicación."
          onChange={e => onPatch({ highlight_text: e.target.value })}
        />
      </BlockField>
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
