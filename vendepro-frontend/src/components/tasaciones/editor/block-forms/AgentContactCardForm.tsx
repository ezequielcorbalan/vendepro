'use client'
import { BlockField, BlockInput } from './BlockField'
import ImageUpload from '@/components/landings/ImageUpload'

interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

export function AgentContactCardForm({ data, onPatch }: Props) {
  return (
    <div className="space-y-3 p-3">
      <BlockField label="Título">
        <BlockInput type="text" value={data.title ?? ''} onChange={e => onPatch({ title: e.target.value })} placeholder="Contactá a tu agente" />
      </BlockField>
      <BlockField label="Nombre">
        <BlockInput type="text" value={data.name ?? ''} onChange={e => onPatch({ name: e.target.value })} />
      </BlockField>
      <BlockField label="Teléfono">
        <BlockInput type="tel" value={data.phone ?? ''} onChange={e => onPatch({ phone: e.target.value })} />
      </BlockField>
      <BlockField label="Email">
        <BlockInput type="email" value={data.email ?? ''} onChange={e => onPatch({ email: e.target.value })} />
      </BlockField>
      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-gray-600">Foto de perfil</span>
        <ImageUpload
          value={data.avatar_url ?? ''}
          onChange={(url) => onPatch({ avatar_url: url })}
        />
      </div>
    </div>
  )
}
