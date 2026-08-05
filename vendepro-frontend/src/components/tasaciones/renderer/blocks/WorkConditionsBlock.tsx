import { FileCheck, Plus } from 'lucide-react'

interface WorkConditionsData {
  title?: string
  honorarios_pct?: number
  exclusividad_dias?: number
  required_docs?: string[]
  extras?: string[]
  legal_text?: string
  signature_image_url?: string | null
}

interface Props {
  data: WorkConditionsData
  [key: `data-${string}`]: string | undefined
}

const BRAND_GRADIENT =
  'linear-gradient(180deg, var(--brand-color, #ff007c) 0%, var(--brand-accent-color, #e17a2a) 100%)'

export function WorkConditionsBlock({ data, ...attrs }: Props) {
  return (
    <section {...attrs} className="bg-white px-6 py-16 md:px-12 md:py-24">
      <div className="mx-auto max-w-6xl">
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em] md:text-sm"
          style={{ color: 'var(--brand-color, #ff007c)' }}
        >
          Acuerdo de trabajo
        </p>
        <h2 className="mt-2 font-poppins text-3xl font-bold leading-tight text-ink md:text-5xl">
          {data.title ?? 'Condiciones de trabajo'}
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-8 md:mt-16 md:grid-cols-3 md:gap-10">
          <div
            className="rounded-3xl p-8 text-white shadow-lg md:p-10"
            style={{ backgroundImage: BRAND_GRADIENT }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/85">Honorarios</p>
            <p className="mt-4 font-poppins text-6xl font-bold leading-none md:text-7xl">
              {data.honorarios_pct ?? 3}<span className="text-3xl md:text-4xl">%</span>
            </p>
            <div className="mt-8 border-t border-white/30 pt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/85">Exclusividad</p>
              <p className="mt-2 font-poppins text-3xl font-bold md:text-4xl">
                {data.exclusividad_dias ?? 120}
                <span className="ml-2 text-base font-medium text-white/85">días</span>
              </p>
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {data.required_docs && data.required_docs.length > 0 && (
                <div className="rounded-2xl bg-[#f2f2f2] p-6">
                  <div
                    className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]"
                    style={{ color: 'var(--brand-color, #ff007c)' }}
                  >
                    <FileCheck className="h-4 w-4" /> Documentación
                  </div>
                  <ul className="mt-4 space-y-2 text-sm text-slate-700">
                    {data.required_docs.map((d, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span
                          className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: 'var(--brand-color, #ff007c)' }}
                        />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.extras && data.extras.length > 0 && (
                <div className="rounded-2xl bg-[#f2f2f2] p-6">
                  <div
                    className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]"
                    style={{ color: 'var(--brand-color, #ff007c)' }}
                  >
                    <Plus className="h-4 w-4" /> Adicionales
                  </div>
                  <ul className="mt-4 space-y-2 text-sm text-slate-700">
                    {data.extras.map((d, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span
                          className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: 'var(--brand-color, #ff007c)' }}
                        />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {data.signature_image_url && (
              <div className="mt-8 rounded-2xl border border-slate-200 px-6 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Firma</p>
                <img src={data.signature_image_url} alt="Firma" className="mt-2 h-16 w-auto" />
              </div>
            )}
          </div>
        </div>

        {data.legal_text && (
          <p className="mt-12 border-t border-slate-200 pt-6 text-xs leading-relaxed text-slate-500 md:mt-16">
            {data.legal_text}
          </p>
        )}
      </div>
    </section>
  )
}
