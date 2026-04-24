interface Data { text?: string; phone?: string; pre_filled_message?: string }
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

export function CtaWhatsappBlock({ data, ...attrs }: Props) {
  if (!data.phone) return null
  const cleaned = data.phone.replace(/[^0-9]/g, '')
  const href = `https://wa.me/${cleaned}${data.pre_filled_message ? `?text=${encodeURIComponent(data.pre_filled_message)}` : ''}`
  return (
    <section {...attrs} className="bg-[#25D366] px-6 py-8 text-white md:px-12 md:py-10">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
        <p className="text-lg font-semibold md:text-xl">{data.text ?? '¿Hablamos por WhatsApp?'}</p>
        <a href={href} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white px-6 py-3 font-semibold text-[#25D366]">
          Abrir WhatsApp →
        </a>
      </div>
    </section>
  )
}
