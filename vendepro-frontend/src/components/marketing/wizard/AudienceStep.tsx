'use client'

import { useState, useEffect } from 'react'
import { Users, Loader2, UserCheck, BookUser } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { type CampaignSegment, LEAD_STAGES, CONTACT_TYPES } from '@/lib/email-campaigns'

export interface AudiencePreview {
  count: number
  sample: Array<{ email: string; name: string | null }>
}

export default function AudienceStep({
  segment,
  onChange,
  preview,
  onPreview,
}: {
  segment: CampaignSegment
  onChange: (s: CampaignSegment) => void
  preview: AudiencePreview | null
  onPreview: (p: AudiencePreview | null) => void
}) {
  const [loading, setLoading] = useState(false)

  // Conteo en vivo cada vez que cambia el segmento.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    onPreview(null)
    apiFetch('crm', '/marketing/email/campaigns/preview-audience', {
      method: 'POST',
      body: JSON.stringify({ segment }),
    })
      .then(r => r.json() as Promise<any>)
      .then(d => { if (!cancelled) { onPreview(d?.count !== undefined ? d : null); setLoading(false) } })
      .catch(() => { if (!cancelled) { setLoading(false) } })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(segment)])

  const stages = segment.stages ?? []
  const toggleStage = (key: string) => {
    const next = stages.includes(key) ? stages.filter(s => s !== key) : [...stages, key]
    onChange({ ...segment, stages: next })
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">¿A quién le enviamos?</p>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <button
            onClick={() => onChange({ source: 'contacts', contact_type: null })}
            className={`flex items-center gap-2 border rounded-card px-4 py-3 text-sm font-medium transition-colors ${
              segment.source === 'contacts'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <UserCheck className="w-4 h-4" /> Contactos
          </button>
          <button
            onClick={() => onChange({ source: 'leads', stages: [] })}
            className={`flex items-center gap-2 border rounded-card px-4 py-3 text-sm font-medium transition-colors ${
              segment.source === 'leads'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <BookUser className="w-4 h-4" /> Leads
          </button>
        </div>
      </div>

      {segment.source === 'contacts' ? (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Tipo de contacto</p>
          <div className="flex flex-wrap gap-2">
            {CONTACT_TYPES.map(t => (
              <button
                key={t.key}
                onClick={() => onChange({ ...segment, contact_type: t.key || null })}
                className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                  (segment.contact_type ?? '') === t.key
                    ? 'border-primary bg-primary/5 text-primary font-medium'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Etapas del lead</p>
          <p className="text-xs text-gray-400 mb-2">Sin selección = todos los leads con email.</p>
          <div className="flex flex-wrap gap-2">
            {LEAD_STAGES.map(s => (
              <button
                key={s.key}
                onClick={() => toggleStage(s.key)}
                className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                  stages.includes(s.key)
                    ? 'border-primary bg-primary/5 text-primary font-medium'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conteo en vivo */}
      <div className="bg-gray-50 rounded-card p-4 flex items-center gap-3">
        <Users className="w-5 h-5 text-primary shrink-0" />
        {loading ? (
          <span className="text-sm text-gray-500 inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Calculando audiencia…
          </span>
        ) : preview ? (
          <div className="min-w-0">
            <p className="text-sm text-ink">
              <span className="font-semibold">{preview.count}</span> destinatario{preview.count === 1 ? '' : 's'} con email válido
              <span className="text-gray-400"> (excluye bajas y rebotes)</span>
            </p>
            {preview.sample.length > 0 && (
              <p className="text-xs text-gray-400 truncate mt-0.5">
                Ej: {preview.sample.map(s => s.email).join(', ')}
              </p>
            )}
          </div>
        ) : (
          <span className="text-sm text-gray-500">No pudimos calcular la audiencia.</span>
        )}
      </div>
    </div>
  )
}
