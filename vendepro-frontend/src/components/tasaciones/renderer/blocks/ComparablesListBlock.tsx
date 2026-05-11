import { Building2, ExternalLink, Database } from 'lucide-react'
import type { AppraisalComparable } from '../types'

interface ComparablesData {
  title?: string
  variant?: 'published' | 'reserved'
  comparables?: AppraisalComparable[]
}

interface Props {
  data: ComparablesData
  [key: `data-${string}`]: string | undefined
}

const BRAND_GRADIENT =
  'linear-gradient(180deg, var(--brand-color, #ff007c) 0%, var(--brand-accent-color, #e17a2a) 100%)'

function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatDate(d: string | null | undefined): string | null {
  if (!d) return null
  try { return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return d }
}

export function ComparablesListBlock({ data, ...attrs }: Props) {
  const list = data.comparables ?? []
  const hasVentas = list.some(c => c.kind === 'venta')

  return (
    <section {...attrs} className="bg-white px-6 py-16 md:px-12 md:py-24">
      <div className="mx-auto max-w-6xl">
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em] md:text-sm"
          style={{ color: 'var(--brand-color, #ff007c)' }}
        >
          Referencias de mercado
        </p>
        <h2 className="mt-2 font-poppins text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
          {data.title ?? 'Propiedades comparables'}
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-slate-600 md:text-base">
          {hasVentas
            ? 'Inmuebles similares — publicaciones en venta y cierres reales recientes usados como referencia.'
            : 'Inmuebles similares en venta usados como referencia para definir el precio sugerido.'}
        </p>

        {list.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm italic text-slate-400">
            Sin propiedades comparables cargadas todavía.
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 md:mt-12 lg:grid-cols-3">
            {list.map(c => {
              const isVenta = c.kind === 'venta'
              const headlinePrice = isVenta ? c.closing_price_usd : c.price
              const closedAt = formatDate(c.closed_at)
              return (
                <article
                  key={c.id}
                  className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100 transition-shadow hover:shadow-lg"
                >
                  <div
                    className="relative flex h-32 items-center justify-center text-white/90 md:h-40"
                    style={{ backgroundImage: BRAND_GRADIENT }}
                  >
                    <Building2 className="h-12 w-12 md:h-14 md:w-14" strokeWidth={1.5} />
                    {/* Pill kind, esquina superior */}
                    <span
                      className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm ${
                        isVenta
                          ? 'bg-emerald-500/90 text-white'
                          : 'bg-white/90 text-[#ff007c]'
                      }`}
                    >
                      {isVenta ? (<><Database className="h-3 w-3" /> Cierre real</>) : 'Publicación'}
                    </span>
                  </div>
                  <div className="p-5 md:p-6">
                    {c.usd_per_m2 !== null && c.usd_per_m2 !== undefined && (
                      <p
                        className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                        style={{ color: 'var(--brand-color, #ff007c)' }}
                      >
                        {c.usd_per_m2} USD/m²
                      </p>
                    )}
                    <p className="mt-1 font-poppins text-2xl font-bold text-slate-900 md:text-3xl">
                      {money(headlinePrice ?? null)}
                    </p>
                    <p className="mt-2 text-sm text-slate-700">{c.address ?? 'Sin dirección'}</p>

                    {/* Subtítulo contextual según kind */}
                    {isVenta && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        {c.price ? <>Publicado a {money(c.price)}</> : 'Cierre efectivo'}
                        {closedAt && <> · {closedAt}</>}
                      </p>
                    )}

                    <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs text-slate-600">
                      {c.total_area !== null && c.total_area !== undefined && (
                        <div>
                          <dt className="uppercase tracking-wide text-slate-400">Total</dt>
                          <dd className="mt-0.5 font-medium text-slate-900">{c.total_area} m²</dd>
                        </div>
                      )}
                      {c.covered_area !== null && c.covered_area !== undefined && (
                        <div>
                          <dt className="uppercase tracking-wide text-slate-400">Cubierta</dt>
                          <dd className="mt-0.5 font-medium text-slate-900">{c.covered_area} m²</dd>
                        </div>
                      )}
                    </dl>

                    {c.zonaprop_url && (
                      <a
                        href={c.zonaprop_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                        style={{ color: 'var(--brand-color, #ff007c)' }}
                      >
                        Ver publicación <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
