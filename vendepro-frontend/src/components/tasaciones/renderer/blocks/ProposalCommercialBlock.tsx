interface ProposalItem { icon?: string; title: string; body: string }
interface Data { title?: string; subtitle?: string; items?: ProposalItem[] }
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

export function ProposalCommercialBlock({ data, ...attrs }: Props) {
  const items = data.items ?? []
  return (
    <section {...attrs} className="bg-slate-50 px-6 py-10 md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'Propuesta comercial'}</h2>
      {data.subtitle && <p className="mt-2 text-sm text-slate-600 md:text-base">{data.subtitle}</p>}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {items.map((it, i) => (
          <div key={i} className="rounded-lg bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--brand-color,#ff007c)]">{it.title}</h3>
            <p className="mt-2 text-sm text-slate-700">{it.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
