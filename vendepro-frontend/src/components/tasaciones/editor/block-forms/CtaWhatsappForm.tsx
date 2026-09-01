'use client'
interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

export function CtaWhatsappForm({ data, onPatch }: Props) {
  // Migración suave de claves legadas (title/button_label/message → text/pre_filled_message)
  const text = data.text ?? data.title ?? data.button_label ?? ''
  const preFilled = data.pre_filled_message ?? data.message ?? ''
  return (
    <div className="space-y-3 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-gray-600">Texto del CTA</span>
        <input
          type="text"
          value={text}
          maxLength={200}
          placeholder="¿Hablamos por WhatsApp?"
          onChange={e => onPatch({ text: e.target.value })}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-gray-600">Teléfono (con código de país)</span>
        <input
          type="tel"
          value={data.phone ?? ''}
          minLength={6}
          maxLength={30}
          placeholder="5491158574005"
          onChange={e => onPatch({ phone: e.target.value })}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <span className="text-[11px] text-gray-500">Sin signos ni espacios. Ej: 5491158574005</span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-gray-600">Mensaje pre-cargado (opcional)</span>
        <textarea
          rows={2}
          value={preFilled}
          maxLength={500}
          placeholder="Hola, me interesa la tasación de…"
          onChange={e => onPatch({ pre_filled_message: e.target.value })}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </label>
    </div>
  )
}
