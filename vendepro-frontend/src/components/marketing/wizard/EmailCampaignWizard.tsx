'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Loader2, Save, Send, Mail } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { type CampaignSegment, parseSegment } from '@/lib/email-campaigns'
import AudienceStep, { type AudiencePreview } from './AudienceStep'
import ContentStep, { type CampaignContent } from './ContentStep'
import ReviewStep from './ReviewStep'
import { Button } from '@/components/ui/Button'

import { Card } from '@/components/ui/Card'
import { IconMedallion } from '@/components/ui/IconMedallion'
const STEPS = [
  { n: 1, label: 'Audiencia' },
  { n: 2, label: 'Contenido' },
  { n: 3, label: 'Revisión y envío' },
]

export default function EmailCampaignWizard({ campaignId }: { campaignId?: string }) {
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(!!campaignId)
  const [step, setStep] = useState(1)
  const [id, setId] = useState<string | null>(campaignId ?? null)

  const [name, setName] = useState('')
  const [segment, setSegment] = useState<CampaignSegment>({ source: 'contacts', contact_type: null })
  const [preview, setPreview] = useState<AudiencePreview | null>(null)
  const [content, setContent] = useState<CampaignContent>({ subject: '', preheader: '', html: '', text: '' })
  const [scheduledAt, setScheduledAt] = useState('')

  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  // Modo edición: cargar el borrador existente.
  useEffect(() => {
    if (!campaignId) return
    apiFetch('crm', `/marketing/email/campaigns/${campaignId}`)
      .then(r => r.json() as Promise<any>)
      .then(c => {
        if (c?.id) {
          setName(c.name ?? '')
          setSegment(parseSegment(c.segment_json) ?? { source: 'contacts', contact_type: null })
          setContent({ subject: c.subject ?? '', preheader: c.preheader ?? '', html: c.html ?? '', text: c.text ?? '' })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [campaignId])

  async function saveDraft(silent = false): Promise<string | null> {
    if (!name.trim()) {
      toast('Poné un nombre a la campaña', 'error')
      return null
    }
    setSaving(true)
    try {
      const body = JSON.stringify({
        name: name.trim(),
        subject: content.subject || null,
        preheader: content.preheader || null,
        html: content.html || null,
        text: content.text || null,
        segment,
      })
      let campaignIdResult = id
      if (id) {
        const res = await apiFetch('crm', `/marketing/email/campaigns/${id}`, { method: 'PUT', body })
        if (!res.ok) throw new Error(((await res.json()) as any)?.error)
      } else {
        const res = await apiFetch('crm', '/marketing/email/campaigns', { method: 'POST', body })
        const data = (await res.json()) as any
        if (!res.ok || !data.id) throw new Error(data?.error)
        campaignIdResult = data.id
        setId(data.id)
      }
      if (!silent) toast('Borrador guardado')
      setSaving(false)
      return campaignIdResult
    } catch (e: any) {
      toast(e?.message || 'Error guardando la campaña', 'error')
      setSaving(false)
      return null
    }
  }

  async function send() {
    if (!content.subject.trim() || !content.html.trim()) {
      toast('Falta el asunto o el contenido del email', 'error')
      return
    }
    if (preview && preview.count === 0) {
      toast('La audiencia está vacía — ajustá el segmento', 'error')
      return
    }
    setSending(true)
    const savedId = await saveDraft(true)
    if (!savedId) { setSending(false); return }
    try {
      const res = await apiFetch('crm', `/marketing/email/campaigns/${savedId}/send`, {
        method: 'POST',
        body: JSON.stringify({
          scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        }),
      })
      const data = (await res.json()) as any
      if (!res.ok) throw new Error(data?.error)
      toast(data.status === 'scheduled'
        ? `Campaña programada para ${data.total_recipients} destinatarios`
        : `Enviando a ${data.total_recipients} destinatarios`)
      router.push(`/marketing/emails/${savedId}`)
    } catch (e: any) {
      toast(e?.message || 'No se pudo enviar la campaña', 'error')
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const canNext = step === 1 ? (preview?.count ?? 0) > 0 || preview === null : true

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/marketing/emails" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-ink mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver a campañas
      </Link>

      {/* Nombre + stepper */}
<Card className="p-6 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <IconMedallion size="lg">
            <Mail className="w-5 h-5" />
          </IconMedallion>
          <input
            className="flex-1 text-lg font-semibold text-ink border-0 border-b border-transparent outline-none placeholder:text-gray-300"
            placeholder="Nombre de la campaña (interno)"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <StepIndicator
          steps={STEPS.map(s => s.label)}
          current={step}
          onStepClick={setStep}
        />
      </Card>

      {/* Paso actual */}
<Card className="p-6">
        {step === 1 && (
          <AudienceStep segment={segment} onChange={setSegment} preview={preview} onPreview={setPreview} />
        )}
        {step === 2 && (
          <ContentStep content={content} onChange={setContent} segment={segment} />
        )}
        {step === 3 && (
          <ReviewStep
            name={name}
            content={content}
            segment={segment}
            preview={preview}
            scheduledAt={scheduledAt}
            onScheduledAtChange={setScheduledAt}
          />
        )}

        {/* Acciones */}
        <div className="flex items-center justify-between mt-6 pt-5 border-t border-gray-100">
          <button
            onClick={() => saveDraft()}
            disabled={saving}
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-ink disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar borrador
          </button>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="text-sm text-gray-600 px-4 py-2 rounded-control border border-gray-200 hover:border-gray-300"
              >
                Atrás
              </button>
            )}
            {step < 3 ? (
              <Button variant="neutral" onClick={() => setStep(step + 1)} disabled={!canNext}>
                Siguiente <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <button
                onClick={send}
                disabled={sending}
                className="inline-flex items-center gap-2 bg-brand-gradient text-white text-sm font-medium px-5 py-2 rounded-control hover:opacity-90 disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {scheduledAt ? 'Programar envío' : 'Enviar ahora'}
              </button>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
