interface Data { title?: string; body?: string; image_url?: string | null; highlight_text?: string }
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

const BRAND_GRADIENT =
  'linear-gradient(180deg, var(--brand-color, #ff007c) 0%, var(--brand-accent-color, #e17a2a) 100%)'

export function MethodologyBlock({ data, ...attrs }: Props) {
  return (
    <section {...attrs} className="bg-[#f2f2f2] px-6 py-16 md:px-12 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-16">
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-[0.2em] md:text-sm"
              style={{ color: 'var(--brand-color, #ff007c)' }}
            >
              Cómo trabajamos
            </p>
            <h2 className="mt-2 font-poppins text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
              {data.title ?? 'Nuestra metodología'}
            </h2>
            {data.body && (
              <p className="mt-6 whitespace-pre-line text-base leading-relaxed text-slate-700 md:text-lg">
                {data.body}
              </p>
            )}
            {data.highlight_text && (
              <div className="mt-8 rounded-2xl bg-white px-6 py-5 shadow-sm">
                <span
                  className="text-xs font-semibold uppercase tracking-[0.18em]"
                  style={{ color: 'var(--brand-color, #ff007c)' }}
                >
                  Lo que nos diferencia
                </span>
                <p className="mt-2 text-lg font-semibold leading-snug text-slate-900 md:text-xl">
                  {data.highlight_text}
                </p>
              </div>
            )}
          </div>

          <div className="relative">
            {data.image_url ? (
              <div className="relative">
                <img
                  src={data.image_url}
                  alt={data.title ?? ''}
                  className="w-full rounded-3xl object-cover shadow-lg"
                />
                <span
                  className="absolute -bottom-6 -left-6 hidden h-24 w-24 rounded-full md:block"
                  style={{ backgroundImage: BRAND_GRADIENT }}
                />
              </div>
            ) : (
              <div className="flex h-72 items-center justify-center rounded-3xl bg-white text-slate-400 md:h-96">
                <p className="text-xs italic">Sin imagen cargada</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
