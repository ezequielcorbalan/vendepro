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

function money(n: number | null): string {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function ComparablesListBlock({ data, ...attrs }: Props) {
  const list = data.comparables ?? []
  if (list.length === 0) return null
  return (
    <section {...attrs} className="px-6 py-10 md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'Propiedades comparables'}</h2>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {list.map(c => (
          <article key={c.id} className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">{c.address ?? 'Sin dirección'}</p>
            <dl className="mt-3 space-y-1 text-xs text-slate-600">
              {c.total_area !== null && <div className="flex justify-between"><dt>Superficie</dt><dd>{c.total_area} m²</dd></div>}
              {c.covered_area !== null && <div className="flex justify-between"><dt>Cubierta</dt><dd>{c.covered_area} m²</dd></div>}
              <div className="flex justify-between font-semibold text-slate-900"><dt>Precio</dt><dd>{money(c.price)}</dd></div>
              {c.usd_per_m2 !== null && <div className="flex justify-between"><dt>USD/m²</dt><dd>{c.usd_per_m2}</dd></div>}
            </dl>
            {c.zonaprop_url && (
              <a href={c.zonaprop_url} target="_blank" rel="noopener noreferrer" className="mt-3 block text-xs text-[var(--brand-color,#ff007c)] hover:underline">
                Ver publicación ↗
              </a>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
