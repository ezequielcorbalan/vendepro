import { MapPin, ImageIcon } from 'lucide-react'

interface Data {
  title?: string
  map_image_url?: string | null
  neighborhood_name?: string
  min_m2_price?: number
  avg_m2_price?: number
  median_m2_price?: number
  published_count?: number
}
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

const BRAND_GRADIENT =
  'linear-gradient(180deg, var(--brand-color, #ff007c) 0%, var(--brand-accent-color, #e17a2a) 100%)'

export function ZoneMapBlock({ data, ...attrs }: Props) {
  const stats = [
    { label: 'Mínimo USD/m²',  value: data.min_m2_price },
    { label: 'Promedio USD/m²', value: data.avg_m2_price },
    { label: 'Mediana USD/m²', value: data.median_m2_price },
    { label: 'Publicadas',      value: data.published_count },
  ].filter(s => s.value !== undefined && s.value !== null)

  return (
    <section {...attrs} className="bg-white px-6 py-16 md:px-12 md:py-24">
      <div className="mx-auto max-w-6xl">
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em] md:text-sm"
          style={{ color: 'var(--brand-color, #ff007c)' }}
        >
          La zona
        </p>
        <h2 className="mt-2 font-poppins text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
          {data.title ?? '¿Qué está pasando en tu zona?'}
        </h2>
        {data.neighborhood_name && (
          <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-slate-700 md:text-base">
            <MapPin className="h-4 w-4" style={{ color: 'var(--brand-color, #ff007c)' }} />
            {data.neighborhood_name}
          </p>
        )}

        <div className="mt-10 grid grid-cols-1 gap-8 md:mt-12 md:grid-cols-2 md:gap-12">
          <div className="overflow-hidden rounded-3xl bg-[#f2f2f2]">
            {data.map_image_url ? (
              <img
                src={data.map_image_url}
                alt={data.neighborhood_name ?? 'Mapa de la zona'}
                className="h-full max-h-[420px] w-full object-cover"
              />
            ) : (
              <div className="flex h-64 items-center justify-center text-slate-400 md:h-80">
                <div className="text-center">
                  <ImageIcon className="mx-auto h-10 w-10" strokeWidth={1.5} />
                  <p className="mt-2 text-xs italic">Sin mapa cargado</p>
                </div>
              </div>
            )}
          </div>

          {stats.length === 0 ? (
            <div className="flex items-center rounded-3xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm italic text-slate-400">
              Sin estadísticas de zona cargadas todavía.
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-10 self-center">
              {stats.map(s => (
                <div key={s.label}>
                  <dd
                    className="font-poppins text-3xl font-bold leading-none md:text-4xl"
                    style={{ color: 'var(--brand-accent-color, #e17a2a)' }}
                  >
                    {s.value}
                  </dd>
                  <dt className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                    {s.label}
                  </dt>
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* Linea de acento con gradient — toque visual */}
        <div
          className="mx-auto mt-12 h-1 w-24 rounded-full md:mt-16"
          style={{ backgroundImage: BRAND_GRADIENT }}
        />
      </div>
    </section>
  )
}
