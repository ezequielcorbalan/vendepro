'use client'
import { BlockField, BlockInput } from '../BlockField'
import ImageUpload from '@/components/landings/ImageUpload'

interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v))

export function ZoneMapForm({ data, onPatch }: Props) {
  return (
    <div className="space-y-3 p-3">
      <BlockField label="Título">
        <BlockInput
          type="text"
          value={data.title ?? ''}
          maxLength={200}
          onChange={e => onPatch({ title: e.target.value })}
          placeholder="¿Qué está pasando en tu zona?"
        />
      </BlockField>
      <BlockField label="Subtítulo (barrio o zona)">
        <BlockInput
          type="text"
          value={data.neighborhood_name ?? ''}
          onChange={e => onPatch({ neighborhood_name: e.target.value })}
          placeholder="Ej: Casas — Monte Castro"
        />
      </BlockField>
      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-gray-600">Imagen del mapa</span>
        <ImageUpload
          value={data.map_image_url ?? ''}
          onChange={(url) => onPatch({ map_image_url: url })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <BlockField label="Mín USD/m²">
          <BlockInput
            type="number"
            min={0}
            value={data.min_m2_price ?? ''}
            onChange={e => onPatch({ min_m2_price: numOrNull(e.target.value) })}
          />
        </BlockField>
        <BlockField label="Promedio USD/m²">
          <BlockInput
            type="number"
            min={0}
            value={data.avg_m2_price ?? ''}
            onChange={e => onPatch({ avg_m2_price: numOrNull(e.target.value) })}
          />
        </BlockField>
        <BlockField label="Mediana USD/m²">
          <BlockInput
            type="number"
            min={0}
            value={data.median_m2_price ?? ''}
            onChange={e => onPatch({ median_m2_price: numOrNull(e.target.value) })}
          />
        </BlockField>
        <BlockField label="Publicadas">
          <BlockInput
            type="number"
            min={0}
            value={data.published_count ?? ''}
            onChange={e => onPatch({ published_count: numOrNull(e.target.value) })}
          />
        </BlockField>
      </div>
    </div>
  )
}
