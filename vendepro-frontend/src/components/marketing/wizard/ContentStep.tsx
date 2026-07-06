'use client'

import { useState } from 'react'
import { Sparkles, Loader2, Eye, Code } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { CAMPAIGN_KINDS, type CampaignSegment, describeSegment } from '@/lib/email-campaigns'

export interface CampaignContent {
  subject: string
  preheader: string
  html: string
  text: string
}

export default function ContentStep({
  content,
  onChange,
  segment,
}: {
  content: CampaignContent
  onChange: (c: CampaignContent) => void
  segment: CampaignSegment
}) {
  const { toast } = useToast()
  const [brief, setBrief] = useState('')
  const [kind, setKind] = useState('newsletter')
  const [generating, setGenerating] = useState(false)
  const [view, setView] = useState<'preview' | 'html'>('preview')

  async function generate() {
    if (brief.trim().length < 10) {
      toast('Contanos un poco más qué querés comunicar', 'error')
      return
    }
    setGenerating(true)
    try {
      const res = await apiFetch('ai', '/generate-email-campaign', {
        method: 'POST',
        body: JSON.stringify({
          brief: brief.trim(),
          kind,
          audience_description: describeSegment(segment),
        }),
      })
      const data = (await res.json()) as any
      if (!res.ok || !data.subject) throw new Error(data?.error || 'La IA no pudo generar el borrador')
      onChange({
        subject: data.subject,
        preheader: data.preheader ?? '',
        html: data.html,
        text: data.text ?? '',
      })
      setView('preview')
      toast('Borrador generado — revisalo y editá lo que quieras')
    } catch (e: any) {
      toast(e?.message || 'Error generando con IA', 'error')
    }
    setGenerating(false)
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-pink/20 focus:border-brand-pink outline-none'
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div className="space-y-5">
      {/* Generador IA */}
      <div className="border border-brand-pink/30 bg-brand-pink/[0.03] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-brand-pink" />
          <p className="text-sm font-semibold text-gray-800">Generar con IA</p>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {CAMPAIGN_KINDS.map(k => (
            <button
              key={k.key}
              onClick={() => setKind(k.key)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                kind === k.key
                  ? 'border-brand-pink bg-white text-brand-pink font-medium'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <textarea
          className={`${inputCls} min-h-[80px]`}
          placeholder="Ej: Acabamos de captar un 3 ambientes con balcón en Villa Urquiza, USD 145.000. Quiero avisarle a los compradores y invitarlos a coordinar visita esta semana."
          value={brief}
          onChange={e => setBrief(e.target.value)}
        />
        <div className="mt-3 flex justify-end">
          <button
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-2 bg-gradient-to-br from-brand-pink to-brand-orange text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {content.html ? 'Regenerar borrador' : 'Generar borrador'}
          </button>
        </div>
      </div>

      {/* Asunto / preheader */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Asunto</label>
          <input className={inputCls} value={content.subject} onChange={e => onChange({ ...content, subject: e.target.value })} placeholder="Nuevo 3 ambientes en Villa Urquiza" />
          <p className="text-xs text-gray-400 mt-1">Podés usar {'{{nombre}}'} para personalizar.</p>
        </div>
        <div>
          <label className={labelCls}>Preheader (opcional)</label>
          <input className={inputCls} value={content.preheader} onChange={e => onChange({ ...content, preheader: e.target.value })} placeholder="Texto que acompaña al asunto en la bandeja" />
        </div>
      </div>

      {/* Contenido */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelCls}>Contenido</label>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setView('preview')}
              className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md ${view === 'preview' ? 'bg-white shadow-sm text-brand-pink font-medium' : 'text-gray-500'}`}
            >
              <Eye className="w-3 h-3" /> Vista previa
            </button>
            <button
              onClick={() => setView('html')}
              className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md ${view === 'html' ? 'bg-white shadow-sm text-brand-pink font-medium' : 'text-gray-500'}`}
            >
              <Code className="w-3 h-3" /> HTML
            </button>
          </div>
        </div>
        {view === 'preview' ? (
          content.html ? (
            <iframe
              srcDoc={content.html}
              sandbox=""
              title="Vista previa del email"
              className="w-full h-[420px] border border-gray-200 rounded-xl bg-white"
            />
          ) : (
            <div className="h-[200px] border border-dashed border-gray-200 rounded-xl flex items-center justify-center text-sm text-gray-400">
              Generá un borrador con IA o escribí el HTML directamente.
            </div>
          )
        ) : (
          <textarea
            className={`${inputCls} font-mono text-xs min-h-[420px]`}
            value={content.html}
            onChange={e => onChange({ ...content, html: e.target.value })}
            placeholder="<html>…</html>"
          />
        )}
        <p className="text-xs text-gray-400 mt-1.5">
          El link de cancelar suscripción se agrega automáticamente al pie — no hace falta incluirlo.
        </p>
      </div>
    </div>
  )
}
