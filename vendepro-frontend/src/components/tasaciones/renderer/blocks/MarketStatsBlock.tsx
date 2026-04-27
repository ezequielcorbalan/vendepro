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

// Diccionario de etiquetas en español para variables conocidas. Si la variable
// no está en el mapa, cae al fallback (último segmento del key con guiones bajos
// reemplazados por espacios).
const VAR_LABELS: Record<string, string> = {
  'market.properties_on_sale': 'Propiedades en venta',
  'market.properties_sold': 'Propiedades vendidas',
  'market.conversion_rate': 'Tasa de conversión',
  'market.reference_period': 'Período de referencia',
  'market.avg_days_on_market': 'Días promedio de venta',
  'market.avg_price_m2': 'Precio promedio m²',
  'market.median_price_m2': 'Precio mediana m²',
  'market.min_price_m2': 'Precio mínimo m²',
  'market.published_count': 'Publicadas',
  'market.sold_count': 'Vendidas',
  'notary.sales_chart': 'Ventas por mes',
  'notary.semester_chart': 'Ventas por semestre',
}

function labelFor(key: string): string {
  return VAR_LABELS[key] ?? (key.split('.').pop()?.replace(/_/g, ' ') ?? key)
}

export function MarketStatsBlock({ data, ...attrs }: Props) {
  const vars = data.vars ?? []
  const resolved = data.vars_resolved ?? {}

  return (
    <section {...attrs} className="bg-[#f2f2f2] px-6 py-16 md:px-12 md:py-24">
      <div className="mx-auto max-w-6xl">
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em] md:text-sm"
          style={{ color: 'var(--brand-color, #ff007c)' }}
        >
          Indicadores de mercado
        </p>
        <h2 className="mt-2 font-poppins text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
          {data.title ?? 'Datos del mercado'}
        </h2>

        {vars.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm italic text-slate-400">
            Sin indicadores configurados todavía.
          </div>
        ) : (
          <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 md:mt-16 md:grid-cols-4 md:gap-x-8">
            {vars.map(key => {
              const v = resolved[key]
              const displayKey = labelFor(key)
              return (
                <div key={key} className="text-center md:text-left">
                  <dd
                    className="font-poppins text-4xl font-bold leading-none md:text-5xl"
                    style={{ color: 'var(--brand-accent-color, #e17a2a)' }}
                  >
                    {v ? formatVar(v) : <span className="text-slate-300">—</span>}
                  </dd>
                  <dt className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 md:text-sm">
                    {displayKey}
                  </dt>
                </div>
              )
            })}
          </dl>
        )}
      </div>
    </section>
  )
}
