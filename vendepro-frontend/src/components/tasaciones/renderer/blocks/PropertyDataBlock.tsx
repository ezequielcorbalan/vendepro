import { Home, MapPin, Building, Ruler } from 'lucide-react'

interface PropertyData {
  title?: string
  property_address?: string
  neighborhood?: string | null
  city?: string | null
  property_type?: string | null
  covered_area?: number | null
  total_area?: number | null
  semi_area?: number | null
  weighted_area?: number | null
}

interface Props {
  data: PropertyData
  [key: `data-${string}`]: string | undefined
}

export function PropertyDataBlock({ data, ...attrs }: Props) {
  const location: { label: string; value: string | null | undefined }[] = [
    { label: 'Dirección',  value: data.property_address },
    { label: 'Barrio',     value: data.neighborhood },
    { label: 'Ciudad',     value: data.city },
    { label: 'Tipología',  value: data.property_type },
  ]

  const areas: { label: string; value: number | null | undefined; suffix: string }[] = [
    { label: 'Cubierta',     value: data.covered_area,  suffix: 'm²' },
    { label: 'Total',        value: data.total_area,    suffix: 'm²' },
    { label: 'Semicubierta', value: data.semi_area,     suffix: 'm²' },
    { label: 'Ponderada',    value: data.weighted_area, suffix: 'm²' },
  ]

  const visibleLocation = location.filter(r => r.value)
  const visibleAreas = areas.filter(r => r.value !== null && r.value !== undefined)

  return (
    <section {...attrs} className="bg-white px-6 py-16 md:px-12 md:py-24">
      <div className="mx-auto max-w-5xl">
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em] md:text-sm"
          style={{ color: 'var(--brand-color, #ff007c)' }}
        >
          La propiedad
        </p>
        <h2 className="mt-2 font-poppins text-3xl font-bold leading-tight text-ink md:text-5xl">
          {data.title ?? 'Datos de la propiedad'}
        </h2>

        <div className="mt-10 grid grid-cols-1 gap-8 md:mt-12 md:grid-cols-5 md:gap-12">
          {visibleLocation.length > 0 && (
            <div className="md:col-span-2">
              <div
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]"
                style={{ color: 'var(--brand-color, #ff007c)' }}
              >
                <MapPin className="h-4 w-4" /> Ubicación
              </div>
              <dl className="mt-4 space-y-3">
                {visibleLocation.map(r => (
                  <div key={r.label} className="border-b border-slate-100 pb-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-400">{r.label}</dt>
                    <dd className="mt-1 text-base font-semibold text-ink md:text-lg">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {visibleAreas.length > 0 && (
            <div className="md:col-span-3">
              <div
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]"
                style={{ color: 'var(--brand-color, #ff007c)' }}
              >
                <Ruler className="h-4 w-4" /> Superficies
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-2 md:gap-6">
                {visibleAreas.map(r => (
                  <div key={r.label} className="rounded-2xl bg-[#f2f2f2] px-5 py-4">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{r.label}</dt>
                    <dd className="mt-2 font-poppins text-2xl font-bold leading-none text-ink md:text-3xl">
                      {r.value}
                      <span className="ml-1 text-sm font-medium text-slate-500">{r.suffix}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        {visibleLocation.length === 0 && visibleAreas.length === 0 && (
          <div className="mt-10 rounded-3xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm italic text-slate-400">
            Sin datos de la propiedad cargados.
          </div>
        )}
      </div>
    </section>
  )
}
