interface Service { icon?: string; label: string }
interface Data { title?: string; services?: Service[]; portals_logos?: string[]; badge_text?: string }
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

export function ServicesGridBlock({ data, ...attrs }: Props) {
  const services = data.services ?? []
  return (
    <section {...attrs} className="px-6 py-10 md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'Nuestros servicios'}</h2>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {services.map((s, i) => (
          <div key={i} className="rounded-lg border border-slate-200 p-4 text-center">
            <p className="text-sm font-medium text-slate-800">{s.label}</p>
          </div>
        ))}
      </div>
      {data.badge_text && (
        <p className="mt-6 inline-block rounded-full bg-[var(--brand-color,#ff007c)] px-4 py-1 text-sm font-semibold text-white">
          {data.badge_text}
        </p>
      )}
      {data.portals_logos && data.portals_logos.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-6">
          {data.portals_logos.map((url, i) => <img key={i} src={url} alt="" className="h-8 w-auto opacity-80" />)}
        </div>
      )}
    </section>
  )
}
