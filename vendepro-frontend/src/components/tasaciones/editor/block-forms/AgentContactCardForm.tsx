'use client'
import ImageUpload from '@/components/landings/ImageUpload'

interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

export function AgentContactCardForm({ data, onPatch }: Props) {
  return (
    <div className="space-y-3 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-gray-600">Título</span>
        <input type="text" value={data.title ?? ''} onChange={e => onPatch({ title: e.target.value })} className="rounded border border-gray-300 px-2 py-1 text-sm" placeholder="Contactá a tu agente" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-gray-600">Nombre</span>
        <input type="text" value={data.name ?? ''} onChange={e => onPatch({ name: e.target.value })} className="rounded border border-gray-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-gray-600">Teléfono</span>
        <input type="tel" value={data.phone ?? ''} onChange={e => onPatch({ phone: e.target.value })} className="rounded border border-gray-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-gray-600">Email</span>
        <input type="email" value={data.email ?? ''} onChange={e => onPatch({ email: e.target.value })} className="rounded border border-gray-300 px-2 py-1 text-sm" />
      </label>
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
