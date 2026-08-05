'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, AlertCircle, Workflow, Zap, Hand, Pause, Play, Pencil, Trash2,
  Users, CheckCircle2, XCircle, Layers, UserPlus, Clock,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  type AutomationDetail, type Enrollment, type AutomationStep,
  AUTOMATION_STATUS, ENROLLMENT_STATUS, triggerLabel, parseSteps, describeDelay, fmtDateTime,
} from '@/lib/email-automations'
import type { CampaignSegment } from '@/lib/email-campaigns'
import AudienceStep, { type AudiencePreview } from '@/components/marketing/wizard/AudienceStep'

export default function AutomationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()

  const [automation, setAutomation] = useState<AutomationDetail | null>(null)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [working, setWorking] = useState(false)
  const [showEnroll, setShowEnroll] = useState(false)

  const load = useCallback(() => {
    Promise.all([
      apiFetch('crm', `/marketing/email/automations/${id}`).then(r => r.json() as Promise<any>),
      apiFetch('crm', `/marketing/email/automations/${id}/enrollments`).then(r => r.json() as Promise<any>).catch(() => []),
    ]).then(([a, e]) => {
      if (a?.id) setAutomation(a); else setError(true)
      setEnrollments(Array.isArray(e) ? e : [])
      setLoading(false)
    }).catch(() => { setError(true); setLoading(false) })
  }, [id])

  useEffect(() => { load() }, [load])

  async function setStatus(status: 'active' | 'paused') {
    setWorking(true)
    try {
      const res = await apiFetch('crm', `/marketing/email/automations/${id}/status`, {
        method: 'POST', body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error(((await res.json()) as any)?.error)
      toast(status === 'active' ? 'Automatización activada' : 'Automatización pausada')
      load()
    } catch (e: any) {
      toast(e?.message || 'No se pudo cambiar el estado', 'error')
    }
    setWorking(false)
  }

  async function remove() {
    if (!confirm('¿Borrar esta automatización y sus inscripciones? No se puede deshacer.')) return
    setWorking(true)
    try {
      const res = await apiFetch('crm', `/marketing/email/automations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(((await res.json()) as any)?.error)
      toast('Automatización borrada')
      router.push('/marketing/automations')
    } catch (e: any) {
      toast(e?.message || 'No se pudo borrar', 'error')
      setWorking(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-pink" /></div>
  if (error || !automation) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-gray-700 font-medium">Automatización no encontrada</p>
        <Link href="/marketing/automations" className="text-sm text-brand-pink hover:underline mt-2 inline-block">Volver</Link>
      </div>
    )
  }

  const st = AUTOMATION_STATUS[automation.status] ?? AUTOMATION_STATUS.draft
  const steps = parseSteps(automation.steps_json)
  const counts = automation.enrollment_counts ?? {}
  const isManual = !automation.trigger_event

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/marketing/automations" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-ink mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver a automatizaciones
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-ink truncate">{automation.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
            </div>
            <p className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
              {isManual ? <Hand className="w-4 h-4" /> : <Zap className="w-4 h-4 text-brand-orange" />}
              {triggerLabel(automation.trigger_event)}
              <span className="text-gray-300">·</span>
              <Layers className="w-4 h-4" /> {steps.length} paso{steps.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setShowEnroll(true)} className="inline-flex items-center gap-1.5 text-sm border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:border-gray-300">
              <UserPlus className="w-3.5 h-3.5" /> Inscribir
            </button>
            {automation.status === 'active' ? (
              <button onClick={() => setStatus('paused')} disabled={working} className="inline-flex items-center gap-1.5 text-sm border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:border-gray-300 disabled:opacity-50">
                <Pause className="w-3.5 h-3.5" /> Pausar
              </button>
            ) : (
              <button onClick={() => setStatus('active')} disabled={working} className="inline-flex items-center gap-1.5 bg-gradient-to-br from-brand-pink to-brand-orange text-white text-sm font-medium px-3.5 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50">
                <Play className="w-3.5 h-3.5" /> Activar
              </button>
            )}
            <Link href={`/marketing/automations/nueva?id=${automation.id}`} className="p-2 text-gray-400 hover:text-gray-700" title="Editar">
              <Pencil className="w-4 h-4" />
            </Link>
            <button onClick={remove} disabled={working} className="p-2 text-gray-400 hover:text-red-500" title="Borrar">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <Stat icon={<Users className="w-4 h-4" />} label="En curso" value={counts.active ?? 0} cls="text-blue-600" />
          <Stat icon={<CheckCircle2 className="w-4 h-4" />} label="Completadas" value={counts.completed ?? 0} cls="text-green-600" />
          <Stat icon={<CheckCircle2 className="w-4 h-4" />} label="Emails enviados" value={automation.sends?.sent ?? 0} cls="text-gray-700" />
          <Stat icon={<XCircle className="w-4 h-4" />} label="Bajas" value={counts.unsubscribed ?? 0} cls="text-red-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Secuencia */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Secuencia</h2>
          <div className="space-y-2">
            {steps.map((s: AutomationStep, i: number) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50">
                <span className="w-6 h-6 rounded-full bg-white border border-gray-200 text-gray-600 text-xs flex items-center justify-center shrink-0 font-medium">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink truncate">{s.subject || 'Sin asunto'}</p>
                  <p className="inline-flex items-center gap-1 text-xs text-gray-400"><Clock className="w-3 h-3" /> {i === 0 ? 'Al inscribirse' : describeDelay(s.delay_hours)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Inscriptos */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Inscriptos {enrollments.length > 0 && <span className="text-gray-400 font-normal">({enrollments.length})</span>}
          </h2>
          {enrollments.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">
              {isManual ? 'Inscribí un segmento con el botón “Inscribir”.' : 'Todavía no entró nadie a la secuencia.'}
            </p>
          ) : (
            <div className="overflow-y-auto max-h-[360px]">
              <table className="w-full text-sm">
                <tbody>
                  {enrollments.map(e => {
                    const es = ENROLLMENT_STATUS[e.status] ?? ENROLLMENT_STATUS.active
                    return (
                      <tr key={e.id} className="border-b border-gray-50">
                        <td className="py-1.5 pr-2 text-gray-700 truncate max-w-[180px]" title={e.email}>{e.email}</td>
                        <td className="py-1.5 pr-2 text-xs text-gray-400">Paso {e.current_step + 1}</td>
                        <td className={`py-1.5 text-right text-xs font-medium ${es.cls}`}>{es.label}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showEnroll && (
        <EnrollModal
          automationId={automation.id}
          onClose={() => setShowEnroll(false)}
          onDone={() => { setShowEnroll(false); load() }}
        />
      )}
    </div>
  )
}

function Stat({ icon, label, value, cls }: { icon: React.ReactNode; label: string; value: number; cls: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className={`flex items-center gap-1.5 ${cls}`}>{icon}<span className="text-lg font-semibold">{value}</span></div>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

function EnrollModal({ automationId, onClose, onDone }: { automationId: string; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast()
  const [segment, setSegment] = useState<CampaignSegment>({ source: 'contacts', contact_type: null })
  const [preview, setPreview] = useState<AudiencePreview | null>(null)
  const [enrolling, setEnrolling] = useState(false)

  async function enroll() {
    setEnrolling(true)
    try {
      const res = await apiFetch('crm', `/marketing/email/automations/${automationId}/enroll`, {
        method: 'POST', body: JSON.stringify({ segment }),
      })
      const data = (await res.json()) as any
      if (!res.ok) throw new Error(data?.error)
      toast(`${data.enrolled} inscriptos en la automatización`)
      onDone()
    } catch (e: any) {
      toast(e?.message || 'No se pudo inscribir', 'error')
      setEnrolling(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-ink mb-1">Inscribir un segmento</h3>
        <p className="text-sm text-gray-500 mb-4">Los que ya están en la secuencia no se reinician.</p>
        <AudienceStep segment={segment} onChange={setSegment} preview={preview} onPreview={setPreview} />
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="text-sm text-gray-600 px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-300">Cancelar</button>
          <button
            onClick={enroll}
            disabled={enrolling || (preview?.count ?? 0) === 0}
            className="inline-flex items-center gap-2 bg-gradient-to-br from-brand-pink to-brand-orange text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Inscribir {preview ? `(${preview.count})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
