'use client'

import { Plus, Trash2 } from 'lucide-react'
import type { AppraisalMarketSituation } from '../wizardTypes'

interface Props {
  value: AppraisalMarketSituation
  onChange: (v: AppraisalMarketSituation) => void
}

const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/20 focus:border-[#ff007c] outline-none'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

export default function MarketSituationStep({ value, onChange }: Props) {
  const v = value || {}
  const media = v.media_urls ?? []
  const set = (patch: Partial<AppraisalMarketSituation>) => onChange({ ...v, ...patch })

  const updateMedia = (i: number, url: string) => {
    const next = [...media]
    next[i] = url
    set({ media_urls: next })
  }
  const addMedia = () => set({ media_urls: [...media, ''] })
  const removeMedia = (i: number) => set({ media_urls: media.filter((_, idx) => idx !== i) })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">Situación del mercado</h2>
      <p className="text-xs text-gray-500 mb-3">
        <span className="mr-1">•</span>
        Contexto de mercado, gráficos y tendencias que acompañan la tasación.
      </p>

      <div className="rounded-xl border border-gray-200 p-4 space-y-3 bg-white">
        <div>
          <label className={labelClass}>Título</label>
          <input
            className={inputClass}
            value={v.title ?? ''}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="Situación del mercado"
          />
        </div>
        <div>
          <label className={labelClass}>Texto del bloque</label>
          <textarea
            className={`${inputClass} h-36`}
            value={v.body ?? ''}
            onChange={(e) => set({ body: e.target.value })}
            placeholder="Resumen de la situación actual del mercado, oferta/demanda, tendencias."
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 p-4 space-y-3 bg-white">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Imágenes / gráficos</h3>
          <button
            type="button"
            onClick={addMedia}
            className="flex items-center gap-1 text-xs text-[#ff007c] font-medium hover:underline"
          >
            <Plus className="w-3 h-3" /> Agregar URL
          </button>
        </div>
        {media.length === 0 && (
          <p className="text-xs text-gray-400">
            <span className="mr-1">•</span>
            Sin imágenes todavía. Agregá URLs públicas (Imgur, R2, etc.).
          </p>
        )}
        {media.map((url, i) => (
          <div key={i} className="flex gap-2">
            <input
              className={inputClass}
              value={url}
              onChange={(e) => updateMedia(i, e.target.value)}
              placeholder="https://..."
            />
            <button
              type="button"
              onClick={() => removeMedia(i)}
              className="text-red-400 hover:text-red-600 p-2"
              aria-label="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
