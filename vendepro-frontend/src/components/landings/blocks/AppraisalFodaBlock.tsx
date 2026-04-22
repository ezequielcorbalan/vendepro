'use client'
import type { AppraisalFodaData } from '@/lib/landings/types'

const QUADRANTS = [
  { key: 'strengths' as const, label: 'Fortalezas', icon: '💪', color: 'bg-green-50 border-green-200 text-green-800' },
  { key: 'opportunities' as const, label: 'Oportunidades', icon: '🚀', color: 'bg-blue-50 border-blue-200 text-blue-800' },
  { key: 'weaknesses' as const, label: 'Debilidades', icon: '⚠️', color: 'bg-amber-50 border-amber-200 text-amber-800' },
  { key: 'threats' as const, label: 'Amenazas', icon: '🔴', color: 'bg-red-50 border-red-200 text-red-800' },
]

export default function AppraisalFodaBlock({ data, mode }: { data: AppraisalFodaData; mode?: string }) {
  const isEmpty = !data.strengths && !data.weaknesses && !data.opportunities && !data.threats

  return (
    <section className="py-12 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        {data.title && (
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">{data.title}</h2>
        )}
        {mode === 'editor' && isEmpty ? (
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center text-gray-400">
            <div className="text-4xl mb-3">📊</div>
            <p className="font-medium">Análisis FODA</p>
            <p className="text-sm mt-1">Se llenará automáticamente con los datos de la tasación</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {QUADRANTS.map(q => (
              <div key={q.key} className={`rounded-xl border-2 p-5 ${q.color}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{q.icon}</span>
                  <h3 className="font-bold text-sm uppercase tracking-wide">{q.label}</h3>
                </div>
                {data[q.key] ? (
                  <p className="text-sm leading-relaxed whitespace-pre-line">{data[q.key]}</p>
                ) : (
                  <p className="text-sm opacity-40 italic">Sin datos</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
