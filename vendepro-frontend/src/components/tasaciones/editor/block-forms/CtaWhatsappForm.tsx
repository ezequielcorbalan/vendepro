'use client'
interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

export function CtaWhatsappForm({ data, onPatch }: Props) {
  return (
    <div className="space-y-3 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Título del CTA</span>
        <input type="text" value={data.title ?? ''} onChange={e => onPatch({ title: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Texto del botón</span>
        <input type="text" value={data.button_label ?? ''} onChange={e => onPatch({ button_label: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Escribime por WhatsApp" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Mensaje pre-cargado</span>
        <textarea rows={2} value={data.message ?? ''} onChange={e => onPatch({ message: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Hola, me interesa la tasación de..." />
      </label>
    </div>
  )
}
