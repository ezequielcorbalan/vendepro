'use client'
import { BlockField, BlockInput, BlockSelect } from '../BlockField'
interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

export function ComparablesListForm({ data, onPatch }: Props) {
  const variant: 'published' | 'reserved' = data.variant === 'reserved' ? 'reserved' : 'published'
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
      <BlockField label="Tipo de comparables">
        <BlockSelect value={variant} onChange={e => onPatch({ variant: e.target.value })}>
          <option value="published">Publicados (en venta)</option>
          <option value="reserved">Reservados / vendidos</option>
        </BlockSelect>
      </BlockField>
      <p className="text-xs text-gray-400">Los comparables se cargan en cada tasación desde el paso &ldquo;Competencia&rdquo;.</p>
    </div>
  )
}
