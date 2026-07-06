'use client'

import { Users, Mail, CalendarClock } from 'lucide-react'
import { type CampaignSegment, describeSegment } from '@/lib/email-campaigns'
import type { CampaignContent } from './ContentStep'
import type { AudiencePreview } from './AudienceStep'

export default function ReviewStep({
  name,
  content,
  segment,
  preview,
  scheduledAt,
  onScheduledAtChange,
}: {
  name: string
  content: CampaignContent
  segment: CampaignSegment
  preview: AudiencePreview | null
  scheduledAt: string
  onScheduledAtChange: (v: string) => void
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wide mb-2">
            <Users className="w-3.5 h-3.5" /> Audiencia
          </div>
          <p className="text-sm text-gray-800 font-medium">{describeSegment(segment)}</p>
          <p className="text-sm text-gray-500 mt-0.5">
            {preview ? `${preview.count} destinatarios` : 'Conteo al enviar'}
            <span className="text-gray-400"> · se excluyen bajas y rebotes</span>
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wide mb-2">
            <Mail className="w-3.5 h-3.5" /> Email
          </div>
          <p className="text-sm text-gray-800 font-medium truncate">{content.subject || '— sin asunto —'}</p>
          <p className="text-sm text-gray-500 mt-0.5 truncate">{name}</p>
        </div>
      </div>

      {/* Programación */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wide mb-2">
          <CalendarClock className="w-3.5 h-3.5" /> ¿Cuándo se envía?
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="radio"
              checked={!scheduledAt}
              onChange={() => onScheduledAtChange('')}
              className="text-brand-pink focus:ring-brand-pink/30"
            />
            Ahora
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="radio"
              checked={!!scheduledAt}
              onChange={() => {
                const d = new Date(Date.now() + 3600_000)
                d.setMinutes(0, 0, 0)
                onScheduledAtChange(toLocalInput(d))
              }}
              className="text-brand-pink focus:ring-brand-pink/30"
            />
            Programar
          </label>
          {!!scheduledAt && (
            <input
              type="datetime-local"
              value={scheduledAt}
              min={toLocalInput(new Date())}
              onChange={e => onScheduledAtChange(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-pink/20 focus:border-brand-pink outline-none"
            />
          )}
        </div>
      </div>

      {/* Vista previa final */}
      {content.html && (
        <iframe
          srcDoc={content.html}
          sandbox=""
          title="Vista previa final"
          className="w-full h-[360px] border border-gray-200 rounded-xl bg-white"
        />
      )}
    </div>
  )
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
