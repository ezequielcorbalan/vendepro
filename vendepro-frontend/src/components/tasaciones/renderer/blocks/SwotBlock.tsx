import { TrendingUp, AlertTriangle, Lightbulb, ShieldAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface SwotData {
  title?: string
  strengths?: string | null
  weaknesses?: string | null
  opportunities?: string | null
  threats?: string | null
}

interface Props {
  data: SwotData
  [key: `data-${string}`]: string | undefined
}

const QUADRANTS: { key: keyof SwotData; label: string; icon: LucideIcon }[] = [
  { key: 'strengths',     label: 'Fortalezas',    icon: TrendingUp },
  { key: 'opportunities', label: 'Oportunidades', icon: Lightbulb },
  { key: 'weaknesses',    label: 'Debilidades',   icon: AlertTriangle },
  { key: 'threats',       label: 'Amenazas',      icon: ShieldAlert },
]

const BRAND_GRADIENT =
  'linear-gradient(180deg, var(--brand-color, #ff007c) 0%, var(--brand-accent-color, #e17a2a) 100%)'

export function SwotBlock({ data, ...attrs }: Props) {
  return (
    <section {...attrs} className="bg-[#f2f2f2] px-6 py-16 md:px-12 md:py-24">
      <div className="mx-auto max-w-5xl">
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em] md:text-sm"
          style={{ color: 'var(--brand-color, #ff007c)' }}
        >
          Análisis de la propiedad
        </p>
        <h2 className="mt-2 font-poppins text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
          {data.title ?? 'FODA'}
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-16 md:grid-cols-2 md:mt-16">
          {QUADRANTS.map(q => {
            const Icon = q.icon
            const value = (data[q.key] as string | null | undefined) ?? ''
            return (
              <article
                key={q.key}
                className="relative rounded-3xl bg-white px-6 pb-8 pt-16 shadow-sm md:px-8 md:pb-10 md:pt-20"
              >
                <span
                  className="absolute -top-10 left-6 flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg md:left-8 md:h-24 md:w-24"
                  style={{ backgroundImage: BRAND_GRADIENT }}
                >
                  <Icon className="h-9 w-9 md:h-11 md:w-11" strokeWidth={1.75} />
                </span>
                <h3
                  className="text-xs font-semibold uppercase tracking-[0.18em] md:text-sm"
                  style={{ color: 'var(--brand-color, #ff007c)' }}
                >
                  {q.label}
                </h3>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700 md:text-base">
                  {value || <span className="italic text-slate-400">Sin datos cargados</span>}
                </p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
