'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, Phone, Mail, MapPin, Clock, Calendar,
  MessageCircle, User, AlertCircle, Loader2, CheckCircle,
  Activity, ChevronRight, ExternalLink, PlusCircle, Home,
  DollarSign, Briefcase, PawPrint, StickyNote, Target, X,
  Send, RefreshCw,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Stage & Activity definitions
// ---------------------------------------------------------------------------

const STAGES = [
  { key: 'nuevo', label: 'Nuevo', color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50' },
  { key: 'contactado', label: 'Contactado', color: 'bg-yellow-500', textColor: 'text-yellow-700', bgLight: 'bg-yellow-50' },
  { key: 'calificado', label: 'Calificado', color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50' },
  { key: 'visita', label: 'Visita', color: 'bg-purple-500', textColor: 'text-purple-700', bgLight: 'bg-purple-50' },
  { key: 'asignado', label: 'Asignado', color: 'bg-indigo-500', textColor: 'text-indigo-700', bgLight: 'bg-indigo-50' },
  { key: 'convertido', label: 'Convertido', color: 'bg-green-500', textColor: 'text-green-700', bgLight: 'bg-green-50' },
  { key: 'no_califica', label: 'No califica', color: 'bg-gray-400', textColor: 'text-gray-600', bgLight: 'bg-gray-50' },
  { key: 'perdido', label: 'Perdido', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50' },
]

const ACTIVITY_TYPES: Record<string, { label: string; icon: typeof Phone }> = {
  llamada: { label: 'Llamada', icon: Phone },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
  reunion: { label: 'Reunión', icon: User },
  visita_captacion: { label: 'Visita captacion', icon: Home },
  visita_comprador: { label: 'Visita comprador', icon: Home },
  tasacion_realizada: { label: 'Tasacion realizada', icon: DollarSign },
  presentacion_tasacion: { label: 'Presentacion tasacion', icon: Target },
  seguimiento: { label: 'Seguimiento', icon: RefreshCw },
  publicacion: { label: 'Publicacion', icon: ExternalLink },
  revision_docs: { label: 'Revision docs', icon: StickyNote },
  cierre_reserva: { label: 'Cierre / Reserva', icon: CheckCircle },
}

const ACTIVE_STAGES = ['nuevo', 'contactado', 'calificado', 'visita', 'asignado']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Ahora'
  if (diffMins < 60) return `Hace ${diffMins}m`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `Hace ${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Ayer'
  if (diffDays < 7) return `Hace ${diffDays} dias`
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function hoursSince(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / 3600000
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LeadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const leadId = params?.id as string

  const [lead, setLead] = useState<any>(null)
  const [activities, setActivities] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stageUpdating, setStageUpdating] = useState(false)
  const [converting, setConverting] = useState(false)

  // Activity form state
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [activityForm, setActivityForm] = useState({ activity_type: 'llamada', description: '' })
  const [savingActivity, setSavingActivity] = useState(false)

  // ------ Fetch lead data ------
  const fetchLead = useCallback(async () => {
    if (!leadId) return
    try {
      const res = await fetch(`/api/leads?id=${leadId}`)
      if (!res.ok) throw new Error('No se pudo cargar el lead')
      const data = (await res.json()) as any
      if (data.error) throw new Error(data.error)
      setLead(data.lead)
      setActivities(data.activities || [])
      setHistory(data.history || [])
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => { fetchLead() }, [fetchLead])

  // ------ Stage advance ------
  async function advanceStage(targetStage: string) {
    if (!lead) return
    setStageUpdating(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lead, stage: targetStage }),
      })
      if (!res.ok) throw new Error('Error actualizando etapa')
      await fetchLead()
    } catch {
      // silent fail, user can retry
    } finally {
      setStageUpdating(false)
    }
  }

  // ------ Register activity ------
  async function handleSaveActivity() {
    if (!activityForm.activity_type || !activityForm.description) return
    setSavingActivity(true)
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId,
          activity_type: activityForm.activity_type,
          description: activityForm.description,
          completed_at: new Date().toISOString(),
        }),
      })
      if (!res.ok) throw new Error('Error guardando actividad')
      setActivityForm({ activity_type: 'llamada', description: '' })
      setShowActivityForm(false)
      await fetchLead()
    } catch {
      // silent
    } finally {
      setSavingActivity(false)
    }
  }

  // ------ Convert lead ------
  async function handleConvert() {
    if (!lead || converting) return
    if (!confirm('Convertir este lead a contacto + tasacion?')) return
    setConverting(true)
    try {
      const res = await fetch('/api/leads/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      })
      if (res.ok) {
        await fetchLead()
      }
    } catch {
      // silent
    } finally {
      setConverting(false)
    }
  }

  // ------ SLA badge logic ------
  function getSLABadge() {
    if (!lead) return null
    const stage = lead.stage
    const hoursCreated = hoursSince(lead.created_at)
    const hoursUpdated = hoursSince(lead.updated_at || lead.created_at)
    const lastActivity = activities[0]
    const hoursLastActivity = lastActivity ? hoursSince(lastActivity.created_at) : hoursUpdated

    if (stage === 'nuevo' && hoursCreated > 24) {
      return { label: 'SLA vencido: >24h sin contacto', color: 'bg-red-100 text-red-700 border-red-200' }
    }
    if (ACTIVE_STAGES.includes(stage) && hoursLastActivity > 48) {
      return { label: 'Sin actividad >48h', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' }
    }
    if (stage === 'nuevo' && hoursCreated <= 24) {
      return { label: 'Dentro de SLA', color: 'bg-green-100 text-green-700 border-green-200' }
    }
    return null
  }

  // ------ Compute next stages ------
  function getNextStages(): typeof STAGES {
    if (!lead) return []
    const currentIdx = STAGES.findIndex(s => s.key === lead.stage)
    if (currentIdx === -1) return []
    const results: typeof STAGES = []
    // Allow linear forward (up to convertido)
    if (currentIdx < 5) {
      results.push(STAGES[currentIdx + 1])
    }
    // Always allow no_califica and perdido if currently active
    if (ACTIVE_STAGES.includes(lead.stage)) {
      results.push(STAGES.find(s => s.key === 'no_califica')!)
      results.push(STAGES.find(s => s.key === 'perdido')!)
    }
    return results
  }

  // ================================================================
  // RENDER
  // ================================================================

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff007c]" />
        <p className="text-sm text-gray-500">Cargando lead...</p>
      </div>
    )
  }

  if (error || !lead) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-gray-600 text-sm">{error || 'Lead no encontrado'}</p>
        <button
          onClick={() => router.push('/leads')}
          className="text-sm text-[#ff007c] hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Leads
        </button>
      </div>
    )
  }

  const currentStage = STAGES.find(s => s.key === lead.stage) || STAGES[0]
  const slaBadge = getSLABadge()
  const nextStages = getNextStages()

  return (
    <div className="max-w-4xl mx-auto">
      {/* ---- Top bar ---- */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push('/leads')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Leads
        </button>
        <div className="flex items-center gap-2">
          {lead.stage !== 'convertido' && lead.stage !== 'perdido' && lead.stage !== 'no_califica' && (
            <button
              onClick={handleConvert}
              disabled={converting}
              className="text-xs sm:text-sm font-medium bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              <span className="hidden sm:inline">Convertir a contacto</span>
              <span className="sm:hidden">Convertir</span>
            </button>
          )}
        </div>
      </div>

      {/* ---- Header card ---- */}
      <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-6 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{lead.full_name}</h1>
              <span className={`text-xs font-semibold text-white px-3 py-1 rounded-full ${currentStage.color}`}>
                {currentStage.label}
              </span>
            </div>

            {slaBadge && (
              <div className={`inline-flex items-center gap-1.5 mt-2 text-xs font-medium px-2.5 py-1 rounded-full border ${slaBadge.color}`}>
                <AlertCircle className="w-3.5 h-3.5" />
                {slaBadge.label}
              </div>
            )}

            <p className="text-xs text-gray-400 mt-2">
              Creado {formatDate(lead.created_at)}
              {lead.assigned_name && <> &middot; Asignado a <strong>{lead.assigned_name}</strong></>}
            </p>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                className="flex items-center gap-1.5 text-xs font-medium bg-[#ff007c] text-white px-3 py-2 rounded-lg hover:opacity-90"
              >
                <Phone className="w-4 h-4" /> Llamar
              </a>
            )}
            {lead.phone && (
              <a
                href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium bg-green-500 text-white px-3 py-2 rounded-lg hover:opacity-90"
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
            )}
            <button
              onClick={() => setShowActivityForm(true)}
              className="flex items-center gap-1.5 text-xs font-medium bg-[#ff8017] text-white px-3 py-2 rounded-lg hover:opacity-90"
            >
              <PlusCircle className="w-4 h-4" /> <span className="hidden sm:inline">Registrar actividad</span><span className="sm:hidden">Actividad</span>
            </button>
          </div>
        </div>
      </div>

      {/* ---- Stage pipeline visual ---- */}
      <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5 mb-4 overflow-x-auto">
        <p className="text-xs font-medium text-gray-500 mb-3">Pipeline</p>
        <div className="flex items-center gap-1 min-w-max">
          {STAGES.filter(s => !['no_califica', 'perdido'].includes(s.key)).map((stage, idx) => {
            const isCurrent = stage.key === lead.stage
            const currentIdx = STAGES.findIndex(s => s.key === lead.stage)
            const isPast = idx < currentIdx && currentIdx < 6
            return (
              <div key={stage.key} className="flex items-center">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition
                  ${isCurrent ? `${stage.color} text-white` : isPast ? `${stage.bgLight} ${stage.textColor}` : 'bg-gray-100 text-gray-400'}`}>
                  {isPast && <CheckCircle className="w-3.5 h-3.5" />}
                  {stage.label}
                </div>
                {idx < 5 && <ChevronRight className="w-4 h-4 text-gray-300 mx-0.5 flex-shrink-0" />}
              </div>
            )
          })}
        </div>
      </div>

      {/* ---- Stage transition buttons ---- */}
      {nextStages.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5 mb-4">
          <p className="text-xs font-medium text-gray-500 mb-3">Avanzar etapa</p>
          <div className="flex flex-wrap gap-2">
            {nextStages.map(ns => (
              <button
                key={ns.key}
                onClick={() => advanceStage(ns.key)}
                disabled={stageUpdating}
                className={`flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg border transition disabled:opacity-50
                  ${ns.key === 'perdido' || ns.key === 'no_califica'
                    ? 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    : 'border-[#ff007c]/30 text-[#ff007c] hover:bg-[#ff007c]/5'
                  }`}
              >
                {stageUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                {ns.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---- Two column layout: info + timeline ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* LEFT: Lead info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">Datos del lead</h2>
            <div className="space-y-3">
              <InfoRow icon={User} label="Nombre" value={lead.full_name} />
              <InfoRow icon={Phone} label="Telefono" value={lead.phone} href={lead.phone ? `tel:${lead.phone}` : undefined} />
              <InfoRow icon={Mail} label="Email" value={lead.email} href={lead.email ? `mailto:${lead.email}` : undefined} />
              <InfoRow icon={ExternalLink} label="Fuente" value={lead.source ? `${lead.source}${lead.source_detail ? ` - ${lead.source_detail}` : ''}` : null} />
              <InfoRow icon={Briefcase} label="Operacion" value={lead.operation} />
              <InfoRow icon={Home} label="Propiedad" value={lead.property_address} />
              <InfoRow icon={MapPin} label="Barrio" value={lead.neighborhood} />
              <InfoRow icon={DollarSign} label="Presupuesto" value={lead.budget ? `USD ${Number(lead.budget).toLocaleString('es-AR')}` : lead.estimated_value ? `USD ${Number(lead.estimated_value).toLocaleString('es-AR')}` : null} />
              <InfoRow icon={Clock} label="Timing" value={lead.timing} />
              <InfoRow icon={User} label="Personas/Trabajo" value={lead.personas_trabajo} />
              <InfoRow icon={PawPrint} label="Mascotas" value={lead.mascotas} />
              <InfoRow icon={StickyNote} label="Notas" value={lead.notes} multiline />
              <InfoRow icon={Target} label="Proximo paso" value={lead.next_step} />
              {lead.next_step_date && (
                <InfoRow icon={Calendar} label="Fecha prox. paso" value={formatDate(lead.next_step_date)} />
              )}
              {lead.lost_reason && (
                <InfoRow icon={AlertCircle} label="Razon de perdida" value={lead.lost_reason} />
              )}
            </div>
          </div>

          {/* Stage history */}
          {history.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-4">Historial de etapas</h2>
              <div className="space-y-3">
                {history.map((h: any, idx: number) => {
                  const toStage = STAGES.find(s => s.key === h.to_stage)
                  const fromStage = h.from_stage ? STAGES.find(s => s.key === h.from_stage) : null
                  return (
                    <div key={h.id || idx} className="flex gap-3 text-xs">
                      <div className="flex flex-col items-center">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ${toStage?.color || 'bg-gray-300'}`} />
                        {idx < history.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                      </div>
                      <div className="pb-3 min-w-0">
                        <p className="text-gray-700">
                          {fromStage ? (
                            <><span className="font-medium">{fromStage.label}</span> &rarr; <span className="font-medium">{toStage?.label}</span></>
                          ) : (
                            <>Ingreso como <span className="font-medium">{toStage?.label}</span></>
                          )}
                        </p>
                        <p className="text-gray-400 mt-0.5">
                          {h.changed_by_name || 'Sistema'} &middot; {timeAgo(h.created_at)}
                        </p>
                        {h.notes && <p className="text-gray-500 mt-1">{h.notes}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Activities timeline */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#ff007c]" /> Actividades
                {activities.length > 0 && (
                  <span className="text-xs font-normal text-gray-400">({activities.length})</span>
                )}
              </h2>
              <button
                onClick={() => setShowActivityForm(true)}
                className="text-xs font-medium text-[#ff007c] hover:underline flex items-center gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Nueva
              </button>
            </div>

            {activities.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Sin actividades registradas</p>
                <button
                  onClick={() => setShowActivityForm(true)}
                  className="text-xs text-[#ff007c] hover:underline mt-2"
                >
                  Registrar primera actividad
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {activities.map((act: any, idx: number) => {
                  const actType = ACTIVITY_TYPES[act.activity_type]
                  const Icon = actType?.icon || Activity
                  return (
                    <div key={act.id || idx} className="flex gap-3 group">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 group-hover:bg-[#ff007c]/10 transition">
                          <Icon className="w-4 h-4 text-gray-500 group-hover:text-[#ff007c] transition" />
                        </div>
                        {idx < activities.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
                      </div>
                      <div className="pb-4 min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-gray-800 font-medium">
                            {actType?.label || act.activity_type}
                          </p>
                          <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">
                            {timeAgo(act.completed_at || act.created_at)}
                          </span>
                        </div>
                        {act.description && (
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{act.description}</p>
                        )}
                        {act.agent_name && (
                          <p className="text-[10px] text-gray-400 mt-1">por {act.agent_name}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- Activity registration modal ---- */}
      {showActivityForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowActivityForm(false)}>
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-md max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Registrar actividad</h2>
              <button onClick={() => setShowActivityForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de actividad</label>
                <select
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 w-full"
                  value={activityForm.activity_type}
                  onChange={e => setActivityForm(f => ({ ...f, activity_type: e.target.value }))}
                >
                  {Object.entries(ACTIVITY_TYPES).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripcion</label>
                <textarea
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 w-full h-24 resize-none"
                  placeholder="Detalle de la actividad..."
                  value={activityForm.description}
                  onChange={e => setActivityForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={handleSaveActivity}
                disabled={savingActivity || !activityForm.description}
                className="flex-1 bg-[#ff007c] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingActivity ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Guardar
              </button>
              <button
                onClick={() => setShowActivityForm(false)}
                className="border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Info row sub-component
// ---------------------------------------------------------------------------

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
  multiline,
}: {
  icon: typeof User
  label: string
  value: string | null | undefined
  href?: string
  multiline?: boolean
}) {
  if (!value) return null
  return (
    <div className="flex gap-3 text-sm">
      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
        {href ? (
          <a href={href} className="text-[#ff007c] hover:underline break-all">{value}</a>
        ) : (
          <p className={`text-gray-700 ${multiline ? 'whitespace-pre-wrap' : 'truncate'}`}>{value}</p>
        )}
      </div>
    </div>
  )
}
