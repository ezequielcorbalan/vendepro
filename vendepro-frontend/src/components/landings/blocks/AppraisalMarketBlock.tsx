'use client'
import type { AppraisalMarketData } from '@/lib/landings/types'

export default function AppraisalMarketBlock({ data, mode }: { data: AppraisalMarketData; mode?: string }) {
  const isEmpty = !data.body && (!data.media_urls || data.media_urls.length === 0)

  return (
    <section className="py-12 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {data.title || 'Situación del Mercado'}
        </h2>

        {mode === 'editor' && isEmpty ? (
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center text-gray-400">
            <div className="text-4xl mb-3">📈</div>
            <p className="font-medium">Situación del mercado</p>
            <p className="text-sm mt-1">Se llenará con el análisis de mercado de la tasación</p>
          </div>
        ) : (
          <div className="space-y-6">
            {data.body && (
              <div className="prose prose-gray max-w-none">
                <p className="text-gray-700 leading-relaxed whitespace-pre-line text-base">{data.body}</p>
              </div>
            )}
            {data.media_urls && data.media_urls.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.media_urls.map((url, i) => (
                  <img key={i} src={url} alt={`Mercado ${i + 1}`}
                    className="w-full rounded-xl object-cover aspect-video" />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
