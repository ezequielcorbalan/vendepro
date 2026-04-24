interface Data {
  title?: string
  vars?: string[]
  vars_resolved?: Record<string, { value: string; type: string }>
}
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

function formatVar(v: { value: string; type: string }): string {
  if (v.type === 'number') return new Intl.NumberFormat('es-AR').format(Number(v.value))
  if (v.type === 'percent') return `${v.value}%`
  return v.value
}

export function MarketStatsBlock({ data, ...attrs }: Props) {
  const vars = data.vars ?? []
  const resolved = data.vars_resolved ?? {}
  return (
    <section {...attrs} className="bg-slate-900 px-6 py-10 text-white md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'Datos del mercado'}</h2>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {vars.map(key => {
          const v = resolved[key]
          const displayKey = key.split('.').pop()?.replace(/_/g, ' ') ?? key
          return (
            <div key={key} className="rounded-lg bg-slate-800 p-5">
              <p className="text-3xl font-bold">{v ? formatVar(v) : <span className="text-amber-400">{`{{${key}}}`}</span>}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{displayKey}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
