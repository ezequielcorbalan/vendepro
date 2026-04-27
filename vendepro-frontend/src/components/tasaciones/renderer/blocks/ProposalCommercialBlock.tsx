interface ProposalItem { icon?: string; title: string; body: string }
interface Data { title?: string; subtitle?: string; items?: ProposalItem[] }
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

export function ProposalCommercialBlock({ data, ...attrs }: Props) {
  const items = data.items ?? []

  return (
    <section {...attrs} className="bg-white px-6 py-16 md:px-12 md:py-24">
      <div className="mx-auto max-w-5xl">
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em] md:text-sm"
          style={{ color: 'var(--brand-color, #ff007c)' }}
        >
          Nuestra propuesta
        </p>
        <h2 className="mt-2 font-poppins text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
          {data.title ?? 'Propuesta comercial'}
        </h2>
        {data.subtitle && (
          <p className="mt-3 max-w-3xl text-base text-slate-600 md:text-lg">{data.subtitle}</p>
        )}

        {items.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm italic text-slate-400">
            Sin items configurados todavía.
          </div>
        ) : (
          <div className="mt-12 grid grid-cols-1 gap-6 md:mt-16 md:grid-cols-2 lg:grid-cols-4">
            {items.map((it, i) => (
              <article
                key={i}
                className="relative rounded-3xl bg-[#f2f2f2] p-6 transition-shadow hover:shadow-md md:p-8"
              >
                <span
                  className="absolute -top-3 left-6 inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundImage: 'linear-gradient(180deg, var(--brand-color, #ff007c) 0%, var(--brand-accent-color, #e17a2a) 100%)' }}
                >
                  {i + 1}
                </span>
                <h3
                  className="text-xs font-bold uppercase tracking-[0.18em]"
                  style={{ color: 'var(--brand-color, #ff007c)' }}
                >
                  {it.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-700">{it.body}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
