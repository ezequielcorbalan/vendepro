'use client'
import { useEffect, useState } from 'react'
import { Plus, AlertCircle, Loader2 } from 'lucide-react'
import { listTemplates } from '../../shared/api'

interface Props {
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export function StepTemplate({ selectedId, onSelect }: Props) {
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    listTemplates({ active: true })
      .then(setTemplates)
      .catch(() => setError('No se pudieron cargar las plantillas'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-slate-100 animate-pulse h-36" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-slate-500">{error}</p>
        <button
          onClick={load}
          className="rounded bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Elegí una plantilla para pre-cargar los bloques de la tasación, o empezá de cero.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* "Empezar de cero" card */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 p-6 text-center transition ${
            selectedId === null
              ? 'border-brand-pink bg-brand-pink/5'
              : 'border-dashed border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <Plus className={`h-8 w-8 ${selectedId === null ? 'text-brand-pink' : 'text-slate-300'}`} />
          <span className={`text-sm font-medium ${selectedId === null ? 'text-brand-pink' : 'text-slate-500'}`}>
            Empezar de cero
          </span>
          <span className="text-xs text-slate-400">Sin bloques pre-cargados</span>
        </button>

        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className={`flex flex-col gap-2 rounded-xl border-2 p-6 text-left transition ${
              selectedId === t.id
                ? 'border-brand-pink bg-brand-pink/5'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span className={`text-sm font-semibold ${selectedId === t.id ? 'text-brand-pink' : 'text-slate-800'}`}>
              {t.name}
            </span>
            {t.description && (
              <span className="text-xs text-slate-500 line-clamp-2">{t.description}</span>
            )}
            {t.block_count !== undefined && (
              <span className="text-xs text-slate-400">{t.block_count} bloques</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
