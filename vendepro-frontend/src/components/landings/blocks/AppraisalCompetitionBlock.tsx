'use client'
import type { AppraisalCompetitionData } from '@/lib/landings/types'

export default function AppraisalCompetitionBlock({ data, mode }: { data: AppraisalCompetitionData; mode?: string }) {
  const hasItems = data.items && data.items.length > 0

  return (
    <section className="py-12 px-4 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {data.title || 'Análisis de Competencia'}
        </h2>
        <p className="text-gray-500 text-sm mb-6">Propiedades comparables en el mercado</p>

        {mode === 'editor' && !hasItems ? (
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center text-gray-400 bg-white">
            <div className="text-4xl mb-3">🏘️</div>
            <p className="font-medium">Competencia de mercado</p>
            <p className="text-sm mt-1">Se llenará con los comparables de la tasación</p>
          </div>
        ) : !hasItems ? null : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Dirección</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">m² tot.</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">m² cub.</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Precio</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">USD/m²</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Días</th>
                </tr>
              </thead>
              <tbody>
                {data.items!.map((item, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3 text-gray-800 max-w-[200px]">
                      {item.zonaprop_url ? (
                        <a href={item.zonaprop_url} target="_blank" rel="noopener noreferrer"
                          className="text-[#ff007c] hover:underline truncate block">
                          {item.address || 'Ver en ZonaProp'}
                        </a>
                      ) : (
                        <span className="truncate block">{item.address || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{item.total_area ? `${item.total_area} m²` : '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{item.covered_area ? `${item.covered_area} m²` : '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">
                      {item.price ? `${item.currency || 'USD'} ${Number(item.price).toLocaleString('es-AR')}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-[#ff007c] font-semibold">
                      {item.usd_per_m2 ? `USD ${Number(item.usd_per_m2).toLocaleString('es-AR')}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {item.days_on_market ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
