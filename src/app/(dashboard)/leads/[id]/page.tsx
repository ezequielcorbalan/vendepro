'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, Phone, Mail, MapPin, Clock, Calendar,
  MessageCircle, User, AlertCircle, Loader2, CheckCircle,
  Activity, ChevronRight, ExternalLink, PlusCircle, Home,
  DollarSign, Briefcase, PawPrint, StickyNote, Target, X,
  Send, RefreshCw, Link2, Calculator,
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'
import {
  LEAD_STAGES, LEAD_STAGE_KEYS, LEAD_PIPELINE_STAGES,
  ACTIVITY_TYPES as CRM_ACTIVITY_TYPES, formatWhatsApp, type LeadStage
} from '@/lib/crm-config'

// Build stage array for pipeline visual
const STAGES = LEAD_STAGE_KEYS.map(key => ({
  key,
  label: LEAD_STAGES[key].label,
  color: key === 'nuevo' ? 'bg-blue-500' : key === 'asignado' ? 'bg-indigo-500' : key === 'contactado' ? 'bg-cyan-500' :
         key === 'calificado' ? 'bg-emerald-500' : key === 'seguimiento' ? 'bg-yellow-500' : key === 'en_tasacion' ? 'bg-purple-500' :
         key === 'presentada' ? 'bg-pink-500' : key === 'captado' ? 'bg-green-500' : 'bg-red-500',
  textColor: LEAD_STAGES[key].color.split(' ')[1] || 'text-gray-700',
  bgLight: LEAD_STAGES[key].color.split(' ')[0] || 'bg-gray-50',
}))

const ACTIVITY_TYPES_MAP: Record<string, { label: string; icon: typeof Phone }> = {
  llamada: { label: 'Llamada', icon: Phone },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
  reunion: { label: 'Reunión', icon: User },
  visita_captacion: { label: 'Visita captación', icon: Home },
  visita_comprador: { label: 'Visita comprador', icon: Home },
  tasacion: { label: 'Tasación', icon: DollarSign },
  presentacion: { label: 'Presentación', icon: Target },
  seguimiento: { label: 'Seguimiento', icon: RefreshCw },
  documentacion: { label: 'Documentación', icon: StickyNote },
  admin: { label: 'Administrativa', icon: Briefcase },
  cierre: { label: 'Cierre', icon: CheckCircle },
}

const ACTIVE_STAGES = LEAD_PIPELINE_STAGES.filter(s => s !== 'captado')

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

  const { toast } = useToast()
  const [lead, setLead] = useState<any>(null)
  const [activities, setActivities] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [linkedAppraisal, setLinkedAppraisal] = useState<any>(null)
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stageUpdating, setStageUpdating] = useState(false)
  const [converting, setConverting] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({ title: '', date: '', time: '10:00', event_type: 'seguimiento' })
  const [editForm, setEditForm] = useState<any>({})

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
      setLinkedAppraisal(data.linkedAppraisal || null)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    fetchLead()
    fetch('/api/agents').then(r => r.json() as Promise<any>).then(d => { if (Array.isArray(d)) setAgents(d) }).catch(() => {})
  }, [fetchLead])

  // ------ Stage advance ------
  async function advanceStage(targetStage: string) {
    if (!lead) return
    setStageUpdating(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id, stage: targetStage }),
      })
      if (!res.ok) throw new Error('Error actualizando etapa')
      toast(`Etapa actualizada: ${targetStage}`)
      await fetchLead()
    } catch {
      toast('Error al avanzar etapa', 'error')
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
      toast('Actividad registrada')
      await fetchLead()
    } catch {
      toast('Error al registrar actividad', 'error')
    } finally {
      setSavingActivity(false)
    }
  }

  // ------ Edit lead ------
  function openEdit() {
    setEditForm({
      full_name: lead.full_name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      source: lead.source || 'manual',
      source_detail: lead.source_detail || '',
      operation: lead.operation || 'venta',
      property_address: lead.property_address || '',
      neighborhood: lead.neighborhood || '',
      estimated_value: lead.estimated_value || '',
      budget: lead.budget || '',
      timing: lead.timing || '',
      personas_trabajo: lead.personas_trabajo || '',
      mascotas: lead.mascotas || '',
      notes: lead.notes || '',
      next_step: lead.next_step || '',
      next_step_date: lead.next_step_date || '',
      lost_reason: lead.lost_reason || '',
      assigned_to: lead.assigned_to || '',
    })
    setShowEdit(true)
  }

  async function handleSaveEdit() {
    try {
      await fetch('/api/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, ...editForm }),
      })
      setShowEdit(false)
      toast('Lead actualizado')
      await fetchLead()
    } catch { toast('Error al guardar', 'error') }
  }

  async function handleScheduleFollowup() {
    if (!scheduleForm.date || !scheduleForm.title) return
    const startAt = `${scheduleForm.date}T${scheduleForm.time}:00`
    const endDate = new Date(startAt)
    endDate.setHours(endDate.getHours() + 1)
    const endAt = endDate.toISOString().replace('Z', '')
    try {
      await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: scheduleForm.title,
          event_type: scheduleForm.event_type,
          start_at: startAt,
          end_at: endAt,
          lead_id: leadId,
          description: `Seguimiento: ${lead.full_name}`,
        }),
      })
      // Also update lead next_step
      await fetch('/api/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, next_step: scheduleForm.title, next_step_date: scheduleForm.date }),
      })
      setShowSchedule(false)
      setScheduleForm({ title: '', date: '', time: '10:00', event_type: 'seguimiento' })
      toast('Seguimiento agendado')
      await fetchLead()
    } catch { toast('Error al agendar', 'error') }
  }

  // ------ Convert lead → tasación ------
  async function handleConvert() {
    if (!lead || converting) return
    if (!confirm('¿Crear tasación vinculada a este lead?')) return
    setConverting(true)
    try {
      // Advance stage to en_tasacion
      await fetch('/api/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, stage: 'en_tasacion' }),
      })
      // Create linked appraisal
      await fetch('/api/tasaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId,
          contact_name: lead.full_name,
          contact_phone: lead.phone,
          contact_email: lead.email,
          agent_id: lead.assigned_to,
          neighborhood: lead.neighborhood,
          property_address: lead.property_address,
        }),
      })
      toast('Tasación creada y vinculada')
      await fetchLead()
    } catch {
      toast('Error al crear tasación', 'error')
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
    const pipelineIdx = (LEAD_PIPELINE_STAGES as readonly string[]).indexOf(lead.stage)
    if (pipelineIdx === -1) return []
    const results: typeof STAGES = []
    // Allow linear forward (within pipeline stages)
    if (pipelineIdx < LEAD_PIPELINE_STAGES.length - 1) {
      const nextKey = LEAD_PIPELINE_STAGES[pipelineIdx + 1]
      const nextStage = STAGES.find(s => s.key === nextKey)
      if (nextStage) results.push(nextStage)
    }
    // Always allow perdido if currently active
    if (ACTIVE_STAGES.includes(lead.stage)) {
      const perdido = STAGES.find(s => s.key === 'perdido')
      if (perdido) results.push(perdido)
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
          <button onClick={openEdit} className="text-xs sm:text-sm font-medium border border-gray-300 text-gray-700 px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-1.5">
            <StickyNote className="w-4 h-4" /> Editar
          </button>
          {lead.stage !== 'captado' && lead.stage !== 'perdido' && lead.stage !== 'en_tasacion' && lead.stage !== 'presentada' && (
            <button
              onClick={handleConvert}
              disabled={converting}
              className="text-xs sm:text-sm font-medium bg-purple-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              <span className="hidden sm:inline">Crear tasación</span>
              <span className="sm:hidden">Tasación</span>
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
                href={`https://wa.me/${formatWhatsApp(lead.phone)}`}
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
              <PlusCircle className="w-4 h-4" /> <span className="hidden sm:inline">Actividad</span><span className="sm:hidden">Act.</span>
            </button>
            <button
              onClick={() => setShowSchedule(true)}
              className="flex items-center gap-1.5 text-xs font-medium border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50"
            >
              <Calendar className="w-4 h-4" /> <span className="hidden sm:inline">Agendar</span>
            </button>
          </div>
        </div>
      </div>

      {/* ---- Stage pipeline visual ---- */}
      <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5 mb-4 overflow-x-auto">
        <p className="text-xs font-medium text-gray-500 mb-3">Pipeline</p>
        <div className="flex items-center gap-1 min-w-max">
          {STAGES.filter(s => s.key !== 'perdido').map((stage, idx, arr) => {
            const isCurrent = stage.key === lead.stage
            const pipelineKeys = STAGES.filter(s => s.key !== 'perdido').map(s => s.key)
            const currentPipeIdx = pipelineKeys.indexOf(lead.stage)
            const isPast = idx < currentPipeIdx && currentPipeIdx >= 0
            return (
              <div key={stage.key} className="flex items-center">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition
                  ${isCurrent ? `${stage.color} text-white` : isPast ? `${stage.bgLight} ${stage.textColor}` : 'bg-gray-100 text-gray-400'}`}>
                  {isPast && <CheckCircle className="w-3.5 h-3.5" />}
                  {stage.label}
                </div>
                {idx < arr.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300 mx-0.5 flex-shrink-0" />}
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
                  ${ns.key === 'perdido'
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

          {/* Linked appraisal */}
          {linkedAppraisal && (
            <Link href={`/tasaciones/${linkedAppraisal.id}`} className="block bg-purple-50 border border-purple-200 rounded-2xl p-4 hover:bg-purple-100 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <Calculator className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-semibold text-purple-800">Tasación vinculada</h3>
              </div>
              <p className="text-xs text-purple-600">{linkedAppraisal.property_address || linkedAppraisal.neighborhood || 'Sin dirección'}</p>
              <p className="text-[10px] text-purple-400 mt-1 capitalize">Estado: {linkedAppraisal.status || 'draft'}</p>
            </Link>
          )}

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
                  const actType = ACTIVITY_TYPES_MAP[act.activity_type]
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
                  {Object.entries(ACTIVITY_TYPES_MAP).map(([key, val]) => (
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

      {/* ---- Edit lead modal ---- */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowEdit(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="font-semibold text-gray-800">Editar lead</h2>
              <button onClick={() => setShowEdit(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase">Nombre</label>
                  <input value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase">Teléfono</label>
                  <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase">Email</label>
                  <input value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase">Operación</label>
                  <select value={editForm.operation} onChange={e => setEditForm({ ...editForm, operation: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full">
                    <option value="venta">Venta</option><option value="alquiler">Alquiler</option><option value="tasacion">Tasación</option><option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase">Dirección</label>
                  <input value={editForm.property_address} onChange={e => setEditForm({ ...editForm, property_address: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase">Barrio</label>
                  <input value={editForm.neighborhood} onChange={e => setEditForm({ ...editForm, neighborhood: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase">Valor estimado (USD)</label>
                  <input type="number" value={editForm.estimated_value} onChange={e => setEditForm({ ...editForm, estimated_value: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 uppercase">Presupuesto</label>
                  <input value={editForm.budget} onChange={e => setEditForm({ ...editForm, budget: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
                </div>
              </div>
              {agents.length > 0 && (
                <div>
                  <label className="text-[10px] text-gray-400 uppercase">Agente asignado</label>
                  <select value={editForm.assigned_to} onChange={e => setEditForm({ ...editForm, assigned_to: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full">
                    <option value="">Sin asignar</option>
                    {agents.map((a: any) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[10px] text-gray-400 uppercase">Próxima acción</label>
                <input value={editForm.next_step} onChange={e => setEditForm({ ...editForm, next_step: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 uppercase">Fecha próxima acción</label>
                <input type="date" value={editForm.next_step_date} onChange={e => setEditForm({ ...editForm, next_step_date: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 uppercase">Notas</label>
                <textarea rows={3} value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
              </div>
              {lead.stage === 'perdido' && (
                <div>
                  <label className="text-[10px] text-gray-400 uppercase">Razón de pérdida</label>
                  <input value={editForm.lost_reason} onChange={e => setEditForm({ ...editForm, lost_reason: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
                </div>
              )}
            </div>
            <div className="sticky bottom-0 bg-white border-t px-4 py-3 flex gap-2">
              <button onClick={() => setShowEdit(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button onClick={handleSaveEdit} className="flex-1 px-4 py-2 bg-[#ff007c] text-white rounded-lg text-sm font-medium">Guardar</button>
            </div>
          </div>
        </div>
      )}
      {/* ---- Schedule followup modal ---- */}
      {showSchedule && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowSchedule(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Agendar seguimiento</h2>
              <button onClick={() => setShowSchedule(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input placeholder="Título (ej: Llamar para definir visita)" value={scheduleForm.title}
                onChange={e => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={scheduleForm.date}
                  onChange={e => setScheduleForm({ ...scheduleForm, date: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm" />
                <input type="time" value={scheduleForm.time}
                  onChange={e => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm" />
              </div>
              <select value={scheduleForm.event_type}
                onChange={e => setScheduleForm({ ...scheduleForm, event_type: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="seguimiento">Seguimiento</option>
                <option value="llamada">Llamada</option>
                <option value="reunion">Reunión</option>
                <option value="visita_captacion">Visita captación</option>
                <option value="tasacion">Tasación</option>
              </select>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowSchedule(false)} className="flex-1 border px-4 py-2 rounded-lg text-sm">Cancelar</button>
              <button onClick={handleScheduleFollowup} disabled={!scheduleForm.title || !scheduleForm.date}
                className="flex-1 bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                Agendar
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
