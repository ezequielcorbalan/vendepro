interface Data {
  title?: string
  suggested?: number | null
  test?: number | null
  expected_close?: number | null
  usd_per_m2?: number | null
  background_color?: string | null
}
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

const BRAND_GRADIENT =
  'linear-gradient(180deg, var(--brand-color, #ff007c) 0%, var(--brand-accent-color, #e17a2a) 100%)'

function money(n: number | null | undefined): string | null {
  if (n === null || n === undefined) return null
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function PriceProjectionBlock({ data, ...attrs }: Props) {
  const suggested = money(data.suggested)
  const test = money(data.test)
  const close = money(data.expected_close)
  const sectionStyle = data.background_color
    ? { backgroundColor: data.background_color }
    : { backgroundImage: BRAND_GRADIENT }

  return (
    <section
      {...attrs}
      className="relative overflow-hidden px-6 py-16 text-white md:px-12 md:py-24"
      style={sectionStyle}
    >
      <div className="relative z-10 mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80 md:text-sm">
          Estrategia de precio
        </p>
        <h2 className="mt-2 font-poppins text-3xl font-bold leading-tight md:text-5xl">
          {data.title ?? 'Tasación proyectada'}
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-white/80 md:text-base">
          Basada en el análisis de comparables, las condiciones del mercado y los objetivos comerciales acordados.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-6 md:mt-16 md:grid-cols-3">
          <article className="rounded-3xl bg-white/15 p-6 backdrop-blur-sm md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">Publicación sugerida</p>
            <p className="mt-3 font-poppins text-3xl font-bold leading-none md:text-4xl">
              {suggested ?? <span className="text-white/40">—</span>}
            </p>
            <p className="mt-3 text-xs text-white/70">Precio recomendado para salir al mercado.</p>
          </article>

          <article className="rounded-3xl bg-white/15 p-6 backdrop-blur-sm md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">Precio de prueba</p>
            <p className="mt-3 font-poppins text-3xl font-bold leading-none md:text-4xl">
              {test ?? <span className="text-white/40">—</span>}
            </p>
            <p className="mt-3 text-xs text-white/70">Valor inicial para testear interés del mercado.</p>
          </article>

          <article
            className="relative rounded-3xl bg-white p-6 text-ink shadow-xl md:p-8"
          >
            <p
              className="text-xs font-semibold uppercase tracking-[0.18em]"
              style={{ color: 'var(--brand-color, #ff007c)' }}
            >
              Cierre esperado
            </p>
            <p className="mt-3 font-poppins text-3xl font-bold leading-none md:text-4xl">
              {close ?? <span className="text-slate-300">—</span>}
            </p>
            <p className="mt-3 text-xs text-slate-500">Valor estimado al firmar la operación.</p>
          </article>
        </div>

        {data.usd_per_m2 != null && (
          <p className="mt-10 text-sm text-white/85 md:mt-12 md:text-base">
            <span className="font-semibold">{data.usd_per_m2}</span>
            <span className="ml-1 text-white/70">USD por m²</span>
          </p>
        )}
      </div>
    </section>
  )
}
