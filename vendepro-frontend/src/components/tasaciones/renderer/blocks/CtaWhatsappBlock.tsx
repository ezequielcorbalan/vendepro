import { MessageCircle, ArrowRight } from 'lucide-react'
import { InlineEditable } from './InlineEditable'

interface Data { text?: string; phone?: string; pre_filled_message?: string; background_color?: string | null }
interface Props {
  data: Data
  edit?: { onChange: (patch: Partial<Data>) => void }
  [key: `data-${string}`]: string | undefined
}

export function CtaWhatsappBlock({ data, edit, ...attrs }: Props) {
  if (!edit && !data.phone) return null
  const cleaned = (data.phone ?? '').replace(/[^0-9]/g, '')
  const href = cleaned ? `https://wa.me/${cleaned}${data.pre_filled_message ? `?text=${encodeURIComponent(data.pre_filled_message)}` : ''}` : undefined

  return (
    <section {...attrs} className="px-6 py-16 md:px-12 md:py-20">
      <div className="mx-auto max-w-4xl">
        <div className="relative overflow-hidden rounded-3xl bg-[#25D366] px-8 py-12 text-white shadow-lg md:px-16 md:py-16">
          <MessageCircle
            className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 opacity-15 md:-right-4 md:h-64 md:w-64"
            strokeWidth={1.5}
          />
          <div className="relative z-10 flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between md:gap-10">
            <div className="w-full">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/85 md:text-sm">
                Atención personalizada
              </p>
              {edit ? (
                <InlineEditable
                  as="p"
                  plaintext
                  value={data.text ?? ''}
                  placeholder="¿Hablamos por WhatsApp?"
                  className="mt-2 font-poppins text-2xl font-bold leading-tight md:text-4xl"
                  onCommit={(text) => edit.onChange({ text })}
                />
              ) : (
                <p className="mt-2 font-poppins text-2xl font-bold leading-tight md:text-4xl">
                  {data.text ?? '¿Hablamos por WhatsApp?'}
                </p>
              )}
              <p className="mt-2 text-sm text-white/85 md:text-base">
                Te respondemos en minutos, sin compromiso.
              </p>
              {edit && (
                <div className="mt-4 flex flex-col gap-2 rounded-xl bg-white/10 p-3">
                  <label className="flex flex-col gap-1 text-xs text-white/85">
                    Teléfono (con código de país)
                    <input
                      type="tel"
                      defaultValue={data.phone ?? ''}
                      placeholder="5491158574005"
                      onBlur={(e) => edit.onChange({ phone: e.target.value.trim() })}
                      className="rounded px-2 py-1 text-sm text-ink"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-white/85">
                    Mensaje pre-cargado (opcional)
                    <input
                      type="text"
                      defaultValue={data.pre_filled_message ?? ''}
                      placeholder="Hola, me interesa la tasación de…"
                      onBlur={(e) => edit.onChange({ pre_filled_message: e.target.value })}
                      className="rounded px-2 py-1 text-sm text-ink"
                    />
                  </label>
                </div>
              )}
            </div>
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => { if (edit) e.preventDefault() }}
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#25D366] shadow-sm transition-shadow hover:shadow-md md:px-8 md:py-4 md:text-base"
              >
                <MessageCircle className="h-4 w-4 md:h-5 md:w-5" />
                Abrir WhatsApp
                <ArrowRight className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
