'use client'
import { BlockField, BlockInput, BlockTextarea } from './BlockField'
interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

export function CtaWhatsappForm({ data, onPatch }: Props) {
  // Migración suave de claves legadas (title/button_label/message → text/pre_filled_message)
  const text = data.text ?? data.title ?? data.button_label ?? ''
  const preFilled = data.pre_filled_message ?? data.message ?? ''
  return (
    <div className="space-y-3 p-3">
      <BlockField label="Texto del CTA">
        <BlockInput
          type="text"
          value={text}
          maxLength={200}
          placeholder="¿Hablamos por WhatsApp?"
          onChange={e => onPatch({ text: e.target.value })}
        />
      </BlockField>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-gray-600">Teléfono (con código de país)</span>
        <BlockInput
          type="tel"
          value={data.phone ?? ''}
          minLength={6}
          maxLength={30}
          placeholder="5491158574005"
          onChange={e => onPatch({ phone: e.target.value })}
        />
        <span className="text-[11px] text-gray-500">Sin signos ni espacios. Ej: 5491158574005</span>
      </label>
      <BlockField label="Mensaje pre-cargado (opcional)">
        <BlockTextarea
          rows={2}
          value={preFilled}
          maxLength={500}
          placeholder="Hola, me interesa la tasación de…"
          onChange={e => onPatch({ pre_filled_message: e.target.value })}
        />
      </BlockField>
    </div>
  )
}
