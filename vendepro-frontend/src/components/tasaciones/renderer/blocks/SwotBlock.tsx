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

const QUADRANTS: { key: keyof SwotData; label: string; bg: string; border: string }[] = [
  { key: 'strengths', label: 'Fortalezas', bg: 'bg-emerald-50', border: 'border-emerald-300' },
  { key: 'weaknesses', label: 'Debilidades', bg: 'bg-rose-50', border: 'border-rose-300' },
  { key: 'opportunities', label: 'Oportunidades', bg: 'bg-sky-50', border: 'border-sky-300' },
  { key: 'threats', label: 'Amenazas', bg: 'bg-amber-50', border: 'border-amber-300' },
]

export function SwotBlock({ data, ...attrs }: Props) {
  return (
    <section {...attrs} className="px-6 py-10 md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'FODA'}</h2>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {QUADRANTS.map(q => {
          const value = data[q.key] as string | null | undefined
          if (!value) return null
          return (
            <div key={q.key} className={`rounded-lg border ${q.border} ${q.bg} p-4`}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{q.label}</h3>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-900">{value}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
