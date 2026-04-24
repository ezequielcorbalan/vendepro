interface FunnelItem { label: string; value: number }
interface Range { label: string; from: number; to: number; color?: string }
interface Data { title?: string; funnel?: FunnelItem[]; ranges?: Range[] }
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

export function FunnelChartBlock({ data, ...attrs }: Props) {
  const items = data.funnel ?? []
  const max = items.reduce((m, i) => Math.max(m, i.value), 0) || 1
  return (
    <section {...attrs} className="px-6 py-10 md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? '¿Por qué las visualizaciones importan?'}</h2>
      <div className="mt-6 space-y-2">
        {items.map((it, i) => {
          const pct = (it.value / max) * 100
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="w-32 flex-shrink-0 text-sm text-slate-600">{it.label}</span>
              <div className="relative h-8 flex-1 rounded bg-slate-100">
                <div className="h-full rounded bg-[var(--brand-color,#ff007c)]" style={{ width: `${pct}%` }} />
                <span className="absolute right-2 top-0 text-sm font-semibold leading-8 text-slate-700">{it.value}</span>
              </div>
            </div>
          )
        })}
      </div>
      {data.ranges && data.ranges.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2 text-xs">
          {data.ranges.map((r, i) => (
            <span key={i} className="rounded-full px-3 py-1 text-white" style={{ background: r.color ?? '#64748b' }}>{r.label}</span>
          ))}
        </div>
      )}
    </section>
  )
}
