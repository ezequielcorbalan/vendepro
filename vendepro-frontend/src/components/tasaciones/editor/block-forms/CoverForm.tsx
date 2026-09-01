'use client'
import { BlockField, BlockInput } from '../BlockField'
import ImageUpload from '@/components/landings/ImageUpload'

interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

export function CoverForm({ data, onPatch }: Props) {
  return (
    <div className="space-y-3 p-3">
      <BlockField label="Título">
        <BlockInput
          type="text"
          value={data.title ?? ''}
          onChange={e => onPatch({ title: e.target.value })}
        />
      </BlockField>
      <BlockField label="Subtítulo">
        <BlockInput
          type="text"
          value={data.subtitle ?? ''}
          onChange={e => onPatch({ subtitle: e.target.value })}
        />
      </BlockField>
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
