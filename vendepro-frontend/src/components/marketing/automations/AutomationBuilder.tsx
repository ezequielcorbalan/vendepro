'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, Save, Sparkles, Workflow, Zap, Hand, Plus, Trash2,
  ChevronDown, ChevronUp, Eye, Code, Clock,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  type AutomationStep, TRIGGER_OPTIONS, describeDelay, parseSteps,
} from '@/lib/email-automations'

const emptyStep = (delay = 72): AutomationStep => ({ delay_hours: delay, subject: '', preheader: '', html: '', text: '' })

export default function AutomationBuilder({ automationId }: { automationId?: string }) {
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(!!automationId)
  const [id, setId] = useState<string | null>(automationId ?? null)

  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState('')
  const [steps, setSteps] = useState<AutomationStep[]>([emptyStep(0)])
  const [openStep, setOpenStep] = useState(0)

  const [brief, setBrief] = useState('')
  const [stepCount, setStepCount] = useState(3)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!automationId) return
    apiFetch('crm', `/marketing/email/automations/${automationId}`)
      .then(r => r.json() as Promise<any>)
      .then(a => {
        if (a?.id) {
          setName(a.name ?? '')
          setTrigger(a.trigger_event ?? '')
          const parsed = parseSteps(a.steps_json)
          setSteps(parsed.length ? parsed : [emptyStep(0)])
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [automationId])

  async function generateSequence() {
    if (brief.trim().length < 10) {
      toast('Contanos el objetivo de la secuencia', 'error')
      return
    }
    setGenerating(true)
    try {
      const res = await apiFetch('ai', '/generate-email-sequence', {
        method: 'POST',
        body: JSON.stringify({ brief: brief.trim(), step_count: stepCount }),
      })
      const data = (await res.json()) as any
      if (!res.ok || !Array.isArray(data.steps)) throw new Error(data?.error || 'La IA no pudo generar la secuencia')
      setSteps(data.steps.map((s: any, i: number) => ({
        delay_hours: typeof s.delay_hours === 'number' ? s.delay_hours : (i === 0 ? 0 : 72),
        subject: s.subject ?? '', preheader: s.preheader ?? '', html: s.html ?? '', text: s.text ?? '',
      })))
      setOpenStep(0)
      toast('Secuencia generada — revisá y editá cada email')
    } catch (e: any) {
      toast(e?.message || 'Error generando con IA', 'error')
    }
    setGenerating(false)
  }

  function patchStep(i: number, patch: Partial<AutomationStep>) {
    setSteps(steps.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  }
  function addStep() {
    setSteps([...steps, emptyStep(72)])
    setOpenStep(steps.length)
  }
  function removeStep(i: number) {
    setSteps(steps.filter((_, idx) => idx !== i))
  }

  async function save(activate = false): Promise<void> {
    if (!name.trim()) { toast('Poné un nombre a la automatización', 'error'); return }
    if (activate && steps.some(s => !s.subject.trim() || !s.html.trim())) {
      toast('Cada paso necesita asunto y contenido para activar', 'error'); return
    }
    setSaving(true)
    try {
      const body = JSON.stringify({ name: name.trim(), trigger_event: trigger || null, steps })
      let savedId = id
      if (id) {
        const res = await apiFetch('crm', `/marketing/email/automations/${id}`, { method: 'PUT', body })
        if (!res.ok) throw new Error(((await res.json()) as any)?.error)
      } else {
        const res = await apiFetch('crm', '/marketing/email/automations', { method: 'POST', body })
        const data = (await res.json()) as any
        if (!res.ok || !data.id) throw new Error(data?.error)
        savedId = data.id
        setId(data.id)
      }
      if (activate && savedId) {
        const res = await apiFetch('crm', `/marketing/email/automations/${savedId}/status`, {
          method: 'POST', body: JSON.stringify({ status: 'active' }),
        })
        if (!res.ok) throw new Error(((await res.json()) as any)?.error)
        toast('Automatización activada')
      } else {
        toast('Borrador guardado')
      }
      router.push(`/marketing/automations/${savedId}`)
    } catch (e: any) {
      toast(e?.message || 'Error guardando', 'error')
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-pink" /></div>
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none'
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1'
  const selectedTrigger = TRIGGER_OPTIONS.find(t => t.value === trigger)

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/marketing/automations" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-ink mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver a automatizaciones
      </Link>

      {/* Nombre + disparador */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center shrink-0">
            <Workflow className="w-5 h-5 text-white" />
          </div>
          <input
            className="flex-1 text-lg font-semibold text-ink border-0 border-b border-transparent outline-none placeholder:text-gray-300"
            placeholder="Nombre de la automatización"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <label className={labelCls}>¿Cuándo se inscribe la gente?</label>
        <select className={inputCls} value={trigger} onChange={e => setTrigger(e.target.value)}>
          {TRIGGER_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {selectedTrigger && (
          <p className="flex items-center gap-1.5 text-xs text-gray-500 mt-1.5">
            {trigger ? <Zap className="w-3.5 h-3.5 text-brand-orange" /> : <Hand className="w-3.5 h-3.5" />}
            {selectedTrigger.hint}. {trigger && 'También podés inscribir un segmento a mano desde el detalle.'}
          </p>
        )}
      </div>

      {/* Generador IA */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
        <div className="border border-brand-pink/30 bg-brand-pink/[0.03] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-brand-pink" />
            <p className="text-sm font-semibold text-ink">Generar la secuencia con IA</p>
          </div>
          <textarea
            className={`${inputCls} min-h-[70px]`}
            placeholder="Ej: Secuencia de bienvenida para compradores nuevos: presentarnos, mostrar cómo trabajamos y ofrecer una primera reunión sin compromiso."
            value={brief}
            onChange={e => setBrief(e.target.value)}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              Emails:
              <select className="border border-gray-300 rounded-lg px-2 py-1 text-sm" value={stepCount} onChange={e => setStepCount(Number(e.target.value))}>
                {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button
              onClick={generateSequence}
              disabled={generating}
              className="inline-flex items-center gap-2 bg-gradient-to-br from-brand-pink to-brand-orange text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generar secuencia
            </button>
          </div>
        </div>
      </div>

      {/* Pasos */}
      <div className="space-y-3">
        {steps.map((step, i) => (
          <StepCard
            key={i}
            index={i}
            step={step}
            open={openStep === i}
            onToggle={() => setOpenStep(openStep === i ? -1 : i)}
            onPatch={patch => patchStep(i, patch)}
            onRemove={steps.length > 1 ? () => removeStep(i) : undefined}
            isFirst={i === 0}
          />
        ))}
        <button
          onClick={addStep}
          className="w-full border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 hover:border-brand-pink hover:text-brand-pink inline-flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Agregar email a la secuencia
        </button>
      </div>

      {/* Acciones */}
      <div className="sticky bottom-4 mt-5 bg-white rounded-xl border border-gray-200 shadow-lg p-3 flex items-center justify-between">
        <button onClick={() => save(false)} disabled={saving} className="inline-flex items-center gap-2 text-sm text-gray-600 px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-300 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar borrador
        </button>
        <button onClick={() => save(true)} disabled={saving} className="inline-flex items-center gap-2 bg-gradient-to-br from-brand-pink to-brand-orange text-white text-sm font-medium px-5 py-2 rounded-lg hover:opacity-90 disabled:opacity-50">
          <Zap className="w-4 h-4" /> Activar
        </button>
      </div>
    </div>
  )
}

function StepCard({
  index, step, open, onToggle, onPatch, onRemove, isFirst,
}: {
  index: number
  step: AutomationStep
  open: boolean
  onToggle: () => void
  onPatch: (p: Partial<AutomationStep>) => void
  onRemove?: () => void
  isFirst: boolean
}) {
  const [view, setView] = useState<'preview' | 'html'>('preview')
  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none'

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={onToggle}>
        <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 text-sm flex items-center justify-center shrink-0 font-medium">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink truncate">{step.subject || 'Email sin asunto'}</p>
          <p className="inline-flex items-center gap-1 text-xs text-gray-400 mt-0.5">
            <Clock className="w-3 h-3" /> {isFirst ? 'Al inscribirse' : describeDelay(step.delay_hours)}
          </p>
        </div>
        {onRemove && (
          <button onClick={e => { e.stopPropagation(); onRemove() }} className="p-1.5 text-gray-300 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </div>

      {open && (
        <div className="p-4 pt-0 space-y-4 border-t border-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Demora</label>
              {isFirst ? (
                <div className="text-sm text-gray-500 py-2">Al inscribirse</div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0}
                    className={inputCls}
                    value={Math.round(step.delay_hours / 24) || 0}
                    onChange={e => onPatch({ delay_hours: Math.max(0, Number(e.target.value)) * 24 })}
                  />
                  <span className="text-sm text-gray-500">días</span>
                </div>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Asunto</label>
              <input className={inputCls} value={step.subject} onChange={e => onPatch({ subject: e.target.value })} placeholder="Asunto del email" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-600">Contenido</label>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => setView('preview')} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md ${view === 'preview' ? 'bg-white shadow-sm text-brand-pink font-medium' : 'text-gray-500'}`}>
                  <Eye className="w-3 h-3" /> Vista
                </button>
                <button onClick={() => setView('html')} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md ${view === 'html' ? 'bg-white shadow-sm text-brand-pink font-medium' : 'text-gray-500'}`}>
                  <Code className="w-3 h-3" /> HTML
                </button>
              </div>
            </div>
            {view === 'preview' ? (
              step.html ? (
                <iframe srcDoc={step.html} sandbox="" title={`Paso ${index + 1}`} className="w-full h-[320px] border border-gray-200 rounded-xl bg-white" />
              ) : (
                <div className="h-[120px] border border-dashed border-gray-200 rounded-xl flex items-center justify-center text-sm text-gray-400">Generá con IA o escribí el HTML.</div>
              )
            ) : (
              <textarea className={`${inputCls} font-mono text-xs min-h-[320px]`} value={step.html} onChange={e => onPatch({ html: e.target.value })} placeholder="<html>…</html>" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
