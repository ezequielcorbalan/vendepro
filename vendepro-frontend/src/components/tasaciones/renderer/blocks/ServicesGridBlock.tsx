import { Check } from 'lucide-react'

interface Service { icon?: string; label: string }
interface Data { title?: string; services?: Service[]; portals_logos?: string[]; badge_text?: string }
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

export function ServicesGridBlock({ data, ...attrs }: Props) {
  const services = data.services ?? []

  return (
    <section {...attrs} className="bg-white px-6 py-16 md:px-12 md:py-24">
      <div className="mx-auto max-w-6xl">
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em] md:text-sm"
          style={{ color: 'var(--brand-color, #ff007c)' }}
        >
          Todo incluido
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-poppins text-3xl font-bold leading-tight text-ink md:text-5xl">
            {data.title ?? 'Nuestros servicios'}
          </h2>
          {data.badge_text && (
            <span
              className="inline-block rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white"
              style={{ backgroundImage: 'linear-gradient(180deg, var(--brand-color, #ff007c) 0%, var(--brand-accent-color, #e17a2a) 100%)' }}
            >
              {data.badge_text}
            </span>
          )}
        </div>

        {services.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm italic text-slate-400">
            Sin servicios cargados todavía.
          </div>
        ) : (
          <ul className="mt-10 grid grid-cols-1 gap-3 md:mt-12 md:grid-cols-2 lg:grid-cols-3">
            {services.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-2xl bg-[#f2f2f2] px-5 py-4 transition-shadow hover:shadow-sm"
              >
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundImage: 'linear-gradient(180deg, var(--brand-color, #ff007c) 0%, var(--brand-accent-color, #e17a2a) 100%)' }}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <span className="text-sm font-medium text-ink md:text-base">{s.label}</span>
              </li>
            ))}
          </ul>
        )}

        {data.portals_logos && data.portals_logos.length > 0 && (
          <div className="mt-12 border-t border-slate-200 pt-8 md:mt-16">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Tu propiedad publicada en
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-6 md:gap-10">
              {data.portals_logos.map((url, i) => (
                <img key={i} src={url} alt="" className="h-8 w-auto opacity-80 md:h-10" />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
