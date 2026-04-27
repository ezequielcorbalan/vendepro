import { MessageCircle, ArrowRight } from 'lucide-react'

interface Data { text?: string; phone?: string; pre_filled_message?: string }
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

export function CtaWhatsappBlock({ data, ...attrs }: Props) {
  if (!data.phone) return null
  const cleaned = data.phone.replace(/[^0-9]/g, '')
  const href = `https://wa.me/${cleaned}${data.pre_filled_message ? `?text=${encodeURIComponent(data.pre_filled_message)}` : ''}`

  return (
    <section {...attrs} className="px-6 py-16 md:px-12 md:py-20">
      <div className="mx-auto max-w-4xl">
        <div className="relative overflow-hidden rounded-3xl bg-[#25D366] px-8 py-12 text-white shadow-lg md:px-16 md:py-16">
          <MessageCircle
            className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 opacity-15 md:-right-4 md:h-64 md:w-64"
            strokeWidth={1.5}
          />
          <div className="relative z-10 flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between md:gap-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/85 md:text-sm">
                Atención personalizada
              </p>
              <p className="mt-2 font-poppins text-2xl font-bold leading-tight md:text-4xl">
                {data.text ?? '¿Hablamos por WhatsApp?'}
              </p>
              <p className="mt-2 text-sm text-white/85 md:text-base">
                Te respondemos en minutos, sin compromiso.
              </p>
            </div>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#25D366] shadow-sm transition-shadow hover:shadow-md md:px-8 md:py-4 md:text-base"
            >
              <MessageCircle className="h-4 w-4 md:h-5 md:w-5" />
              Abrir WhatsApp
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
