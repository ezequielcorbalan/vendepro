interface Data {
  title?: string
  suggested?: number | null
  test?: number | null
  expected_close?: number | null
  usd_per_m2?: number | null
}
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function PriceProjectionBlock({ data, ...attrs }: Props) {
  return (
    <section {...attrs} className="bg-gradient-to-br from-slate-900 to-slate-700 px-6 py-10 text-white md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'Tasación proyectada'}</h2>
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-white/10 p-6">
          <p className="text-xs uppercase tracking-wide opacity-70">Publicación sugerida</p>
          <p className="mt-2 text-3xl font-bold">{money(data.suggested)}</p>
        </div>
        <div className="rounded-lg bg-white/10 p-6">
          <p className="text-xs uppercase tracking-wide opacity-70">Precio de prueba</p>
          <p className="mt-2 text-3xl font-bold">{money(data.test)}</p>
        </div>
        <div className="rounded-lg bg-[var(--brand-color,#ff007c)] p-6">
          <p className="text-xs uppercase tracking-wide opacity-90">Cierre esperado</p>
          <p className="mt-2 text-3xl font-bold">{money(data.expected_close)}</p>
        </div>
      </div>
      {data.usd_per_m2 != null && <p className="mt-6 text-sm opacity-80">USD/m²: {data.usd_per_m2}</p>}
    </section>
  )
}
