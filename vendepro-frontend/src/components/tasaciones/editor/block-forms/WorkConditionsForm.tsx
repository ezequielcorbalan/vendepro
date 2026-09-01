'use client'
import { BlockField, BlockInput, BlockTextarea } from '../BlockField'
interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

export function WorkConditionsForm({ data, onPatch }: Props) {
  return (
    <div className="space-y-3 p-3">
      <BlockField label="Honorarios %">
        <BlockInput type="number" step="0.1" value={data.honorarios_pct ?? ''} onChange={e => onPatch({ honorarios_pct: e.target.value ? Number(e.target.value) : null })} />
      </BlockField>
      <BlockField label="Exclusividad (días)">
        <BlockInput type="number" value={data.exclusividad_dias ?? ''} onChange={e => onPatch({ exclusividad_dias: e.target.value ? Number(e.target.value) : null })} />
      </BlockField>
      <BlockField label="Texto legal">
        <BlockTextarea rows={3} value={data.legal_text ?? ''} onChange={e => onPatch({ legal_text: e.target.value })} />
      </BlockField>
    </div>
  )
}
