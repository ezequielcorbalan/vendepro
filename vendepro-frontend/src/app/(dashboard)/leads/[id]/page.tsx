'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Phone, MessageCircle, Edit3, Save, X, Trash2,
  User, ChevronRight, Plus, Loader2, Calendar, Activity,
  Home, FileText, MapPin, Target, StickyNote, Building2,
  CheckCircle2, Circle, Mail, DollarSign
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  LEAD_STAGES, LEAD_STAGE_KEYS, LEAD_SOURCES, OPERATION_TYPES,
  formatWhatsApp, type LeadStage,
  LEAD_PIPELINE_STAGES
} from '@/lib/crm-config'
import { formatDate } from '@/lib/utils'

const STAGE_DOT_COLORS: Record<string, string> = {
  nuevo: '#3b82f6', asignado: '#6366f1', contactado: '#06b6d4',
  calificado: '#10b981', en_tasacion: '#8b5cf6', presentada: '#ec4899',
  seguimiento: '#f59e0b', captado: '#22c55e', perdido: '#ef4444',
}

export default function LeadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const leadId = params.id as string

  const [lead, setLead] = useState<any>(null)
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [orgTags, setOrgTags] = useState<any[]>([])
  const [showTagPicker, setShowTagPicker] = useState(false)
  const [tagsLoading, setTagsLoading] = useState(false)
  const [stageHistory, setStageHistory] = useState<any[]>([])
  const [moveToStage, setMoveToStage] = useState('')

  function loadLead() {
    Promise.all([
      apiFetch('crm', `/leads?id=${leadId}`).then(r => r.json() as Promise<any>),
      apiFetch('crm', `/activities?lead_id=${leadId}`).then(r => r.json() as Promise<any>).catch(() => []),
      apiFetch('crm', `/stage-history?entity_type=lead&entity_id=${leadId}`).then(r => r.json() as Promise<any>).catch(() => []),
    ]).then(([leadData, actsData, historyData]) => {
      const l = Array.isArray(leadData) ? leadData[0] : leadData
      setLead(l)
      setEditForm(l || {})
      setActivities(Array.isArray(actsData) ? actsData : [])
      setStageHistory(Array.isArray(historyData) ? historyData : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { loadLead() }, [leadId])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await apiFetch('crm', '/leads', {
        method: 'PUT',
        body: JSON.stringify({ id: leadId, ...editForm }),
      })
      const data = (await res.json()) as any
      if (data.error) toast(data.error, 'error')
      else {
        toast('Lead actualizado')
        setEditing(false)
        loadLead()
      }
    } catch { toast('Error de conexión', 'error') }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar "${lead?.full_name}" permanentemente?`)) return
    try {
      await apiFetch('crm', `/leads?id=${leadId}`, { method: 'DELETE' })
      toast('Lead eliminado', 'warning')
      router.push('/leads')
    } catch { toast('Error al eliminar', 'error') }
  }

  const handleStageChange = async (stage: string) => {
    if (editing) return
    if (stage === 'en_tasacion') { setShowConvertModal(true); return }
    try {
      if (stage === 'perdido') {
        const reason = prompt('¿Por qué se pierde este lead?')
        if (reason === null) return
        await apiFetch('crm', '/leads/stage', {
          method: 'POST',
          body: JSON.stringify({ id: leadId, stage: 'perdido', notes: reason || 'Sin motivo' }),
        })
        toast('Lead marcado como perdido', 'warning')
      } else {
        const res = await apiFetch('crm', '/leads/stage', {
          method: 'POST',
          body: JSON.stringify({ id: leadId, stage }),
        })
        const result = (await res.json()) as any
        toast(`Etapa: ${LEAD_STAGES[stage as LeadStage]?.label || stage}`)
        if (result.autoFollowup) toast(`Seguimiento automático creado para ${formatDate(result.autoFollowup.start_at)}`)
      }
      loadLead()
    } catch { toast('Error al cambiar etapa', 'error') }
  }

  const handleRemoveTag = async (tagId: string) => {
    try {
      await apiFetch('crm', `/lead-tags?lead_id=${leadId}&tag_id=${tagId}`, { method: 'DELETE' })
      loadLead()
    } catch { toast('Error al quitar tag', 'error') }
  }

  const handleAddTag = async (tagId: string) => {
    try {
      await apiFetch('crm', '/lead-tags', {
        method: 'POST',
        body: JSON.stringify({ lead_id: leadId, tag_id: tagId }),
      })
      setShowTagPicker(false)
      loadLead()
    } catch { toast('Error al agregar tag', 'error') }
  }

  const handleOpenTagPicker = async () => {
    if (!showTagPicker && orgTags.length === 0) {
      setTagsLoading(true)
      try {
        const res = await apiFetch('crm', '/tags')
        const data = (await res.json()) as any
        setOrgTags(Array.isArray(data) ? data : [])
      } catch {}
      setTagsLoading(false)
    }
    setShowTagPicker(prev => !prev)
  }

  const handleConvertToAppraisal = async (createAppraisal: boolean) => {
    try {
      await apiFetch('crm', '/leads/stage', {
        method: 'POST',
        body: JSON.stringify({ id: leadId, stage: 'en_tasacion' }),
      })
      if (createAppraisal && lead) {
        try {
          await apiFetch('properties', '/appraisals', {
            method: 'POST',
            body: JSON.stringify({
              lead_id: lead.id,
              contact_name: lead.full_name,
              contact_phone: lead.phone,
              contact_email: lead.email,
              agent_id: lead.assigned_to,
              neighborhood: lead.neighborhood,
              property_address: lead.property_address,
            }),
          })
          toast(`Tasación creada para ${lead.full_name}`)
        } catch {
          toast(`${lead.full_name} → En tasación (error al crear tasación)`, 'error')
        }
      } else {
        toast(`${lead?.full_name} → En tasación`)
      }
      setShowConvertModal(false)
      loadLead()
    } catch { toast('Error al cambiar etapa', 'error') }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="h-32 bg-gray-200 rounded-xl" />
        <div className="h-48 bg-gray-200 rounded-xl" />
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Lead no encontrado</p>
        <Link href="/leads" className="text-[#ff007c] hover:underline text-sm mt-2 block">Volver a Leads</Link>
      </div>
    )
  }

  const stage = LEAD_STAGES[lead.stage as LeadStage] || LEAD_STAGES.nuevo

  return (
    <div className="max-w-5xl space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link href="/leads" className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Volver a Leads
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          {!editing ? (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 border border-gray-300 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 text-gray-700">
              <Edit3 className="w-3.5 h-3.5" /> Editar
            </button>
          ) : (
            <>
              <button onClick={() => { setEditing(false); setEditForm(lead) }} className="border px-3 py-1.5 rounded-lg text-sm text-gray-600">
                <X className="w-4 h-4" />
              </button>
              <button onClick={handleSave} disabled={saving} className="bg-[#ff007c] text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50">
                <Save className="w-3.5 h-3.5" /> Guardar
              </button>
            </>
          )}
          <button
            onClick={() => handleStageChange('en_tasacion')}
            disabled={editing}
            className="flex items-center gap-1.5 border border-[#ff8017] text-[#ff8017] px-3 py-1.5 rounded-lg text-sm hover:bg-orange-50 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileText className="w-3.5 h-3.5" /> Ficha de tasación
          </button>
          <Link
            href={`/propiedades/nueva?lead_id=${leadId}`}
            className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-700 font-medium"
          >
            <Home className="w-3.5 h-3.5" /> Crear propiedad
          </Link>
          <button onClick={handleDelete} className="p-1.5 border rounded-lg text-gray-400 hover:text-red-500 hover:border-red-200">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Header card */}
      <div className="bg-white border rounded-xl p-5">
        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nombre *</label>
                <input value={editForm.full_name || ''} onChange={e => setEditForm((f: any) => ({ ...f, full_name: e.target.value }))}
                  className="border rounded-lg px-3 py-2 text-sm w-full" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Teléfono</label>
                <input value={editForm.phone || ''} onChange={e => setEditForm((f: any) => ({ ...f, phone: e.target.value }))}
                  className="border rounded-lg px-3 py-2 text-sm w-full" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Email</label>
                <input value={editForm.email || ''} onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))}
                  className="border rounded-lg px-3 py-2 text-sm w-full" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Origen</label>
                <select value={editForm.source || 'manual'} onChange={e => setEditForm((f: any) => ({ ...f, source: e.target.value }))}
                  className="border rounded-lg px-3 py-2 text-sm w-full">
                  {Object.entries(LEAD_SOURCES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Operación</label>
                <select value={editForm.operation || 'venta'} onChange={e => setEditForm((f: any) => ({ ...f, operation: e.target.value }))}
                  className="border rounded-lg px-3 py-2 text-sm w-full">
                  {Object.entries(OPERATION_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Barrio</label>
                <input value={editForm.neighborhood || ''} onChange={e => setEditForm((f: any) => ({ ...f, neighborhood: e.target.value }))}
                  className="border rounded-lg px-3 py-2 text-sm w-full" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Dirección propiedad</label>
                <input value={editForm.property_address || ''} onChange={e => setEditForm((f: any) => ({ ...f, property_address: e.target.value }))}
                  className="border rounded-lg px-3 py-2 text-sm w-full" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Valor estimado (USD)</label>
                <input type="number" value={editForm.estimated_value || ''} onChange={e => setEditForm((f: any) => ({ ...f, estimated_value: e.target.value }))}
                  className="border rounded-lg px-3 py-2 text-sm w-full" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Próxima acción</label>
              <input value={editForm.next_step || ''} onChange={e => setEditForm((f: any) => ({ ...f, next_step: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm w-full" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Fecha próxima acción</label>
              <input type="date" value={editForm.next_step_date || ''} onChange={e => setEditForm((f: any) => ({ ...f, next_step_date: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm w-full" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Notas</label>
              <textarea rows={3} value={editForm.notes || ''} onChange={e => setEditForm((f: any) => ({ ...f, notes: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm w-full" />
            </div>
          </div>
        ) : (
          <>
            {/* Name + stage badge + contact type badge */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{lead.full_name}</h1>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${stage.color}`}>{stage.label}</span>
                {lead.contact_id && (
                  <Link
                    href="/contactos"
                    className="inline-flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 border rounded-full px-2.5 py-1 hover:bg-gray-100 transition-colors"
                  >
                    <User className="w-3 h-3 text-gray-400" />
                    <span>Contacto</span>
                    <ChevronRight className="w-3 h-3 text-gray-400" />
                  </Link>
                )}
              </div>
            </div>

            {/* Tags row */}
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Etiquetas:</span>
              {lead.tags?.map((tag: any) => (
                <button
                  key={tag.id}
                  onClick={() => handleRemoveTag(tag.id)}
                  className="group flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium border hover:opacity-80 transition-opacity"
                  style={{ borderColor: tag.color, color: tag.color, background: `${tag.color}18` }}
                  title="Quitar tag"
                >
                  + {tag.name}
                  <X className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
              <div className="relative">
                <button
                  onClick={handleOpenTagPicker}
                  className="flex items-center gap-0.5 text-xs px-2.5 py-0.5 rounded-full font-medium border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Tag
                </button>
                {showTagPicker && (
                  <>
                    <div className="fixed inset-0 z-[9]" onClick={() => setShowTagPicker(false)} />
                    <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-10 p-2 min-w-[160px]">
                      {tagsLoading ? (
                        <div className="flex items-center gap-2 px-2 py-1"><Loader2 className="w-3 h-3 animate-spin text-gray-400" /><span className="text-xs text-gray-400">Cargando...</span></div>
                      ) : (
                        <>
                          {orgTags.filter(t => !lead.tags?.some((lt: any) => lt.id === t.id)).map(tag => (
                            <button
                              key={tag.id}
                              onClick={() => handleAddTag(tag.id)}
                              className="flex items-center gap-2 w-full text-left px-2 py-1 rounded hover:bg-gray-50 text-xs text-gray-700"
                            >
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tag.color }} />
                              {tag.name}
                            </button>
                          ))}
                          {orgTags.filter(t => !lead.tags?.some((lt: any) => lt.id === t.id)).length === 0 && (
                            <p className="text-xs text-gray-400 px-2 py-1">No hay más tags disponibles</p>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Date + agent */}
            <p className="text-xs text-gray-400 mb-4">
              Creado {lead.created_at ? formatDate(lead.created_at) : '—'}
              {lead.assigned_name && (
                <> · Asignado a <span className="font-semibold text-gray-600">{lead.assigned_name}</span></>
              )}
            </p>

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              {lead.phone ? (
                <a
                  href={`tel:${lead.phone}`}
                  className="flex items-center gap-1.5 bg-[#ff007c] text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <Phone className="w-4 h-4" /> Llamar
                </a>
              ) : (
                <button disabled className="flex items-center gap-1.5 bg-[#ff007c]/40 text-white px-4 py-2 rounded-xl text-sm font-medium cursor-not-allowed">
                  <Phone className="w-4 h-4" /> Llamar
                </button>
              )}
              {lead.phone ? (
                <a
                  href={`https://wa.me/${formatWhatsApp(lead.phone)}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
              ) : (
                <button disabled className="flex items-center gap-1.5 bg-green-500/40 text-white px-4 py-2 rounded-xl text-sm font-medium cursor-not-allowed">
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </button>
              )}
              <Link
                href={`/calendario?lead_id=${leadId}`}
                className="flex items-center gap-1.5 border border-gray-300 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <Calendar className="w-4 h-4" /> Agendar
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Pipeline */}
      <div className="bg-white border rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Pipeline</p>
        <div className="overflow-hidden">
          <div className="flex items-center gap-0 flex-wrap">
            {LEAD_PIPELINE_STAGES.map((s, i) => {
              const stageData = LEAD_STAGES[s]
              const rawOrder = LEAD_STAGES[lead.stage as LeadStage]?.order ?? 0
              const currentOrder = lead.stage === 'perdido' ? 0 : rawOrder
              const isCompleted = stageData.order < currentOrder
              const isCurrent = s === lead.stage
              const isLast = i === LEAD_PIPELINE_STAGES.length - 1
              return (
                <div key={s} className="flex items-center">
                  <button
                    onClick={() => handleStageChange(s)}
                    disabled={editing}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      isCurrent
                        ? 'bg-[#ff007c] text-white border-[#ff007c] shadow-sm'
                        : isCompleted
                        ? 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                        : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600'
                    } disabled:cursor-not-allowed`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-gray-400" />
                    ) : isCurrent ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Circle className="w-3.5 h-3.5" />
                    )}
                    {stageData.label}
                  </button>
                  {!isLast && (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 mx-0.5 shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Mover etapa */}
      <div className="bg-white border rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Mover etapa</p>
        <select
          value={moveToStage}
          disabled={editing}
          onChange={e => { const val = e.target.value; if (val) { handleStageChange(val); setMoveToStage('') } }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ff007c]/20 disabled:cursor-not-allowed disabled:opacity-50 min-w-[180px]"
        >
          <option value="" disabled>Mover a...</option>
          {LEAD_STAGE_KEYS.map(s => (
            <option key={s} value={s} disabled={s === lead.stage}>
              {LEAD_STAGES[s].label}{s === lead.stage ? ' (actual)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Two-column: Datos + Actividades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Datos del lead */}
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-bold text-gray-900 mb-4">Datos del lead</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Nombre</p>
                <p className="text-sm text-gray-800">{lead.full_name || '—'}</p>
              </div>
            </div>
            {lead.phone && (
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Teléfono</p>
                  <a href={`tel:${lead.phone}`} className="text-sm text-[#ff007c] hover:underline">{lead.phone}</a>
                </div>
              </div>
            )}
            {lead.email && (
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Email</p>
                  <a href={`mailto:${lead.email}`} className="text-sm text-[#ff007c] hover:underline">{lead.email}</a>
                </div>
              </div>
            )}
            {lead.source && (
              <div className="flex items-start gap-3">
                <Target className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Fuente</p>
                  <p className="text-sm text-gray-800">{LEAD_SOURCES[lead.source as keyof typeof LEAD_SOURCES]?.label || lead.source}</p>
                </div>
              </div>
            )}
            {lead.operation && (
              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Operación</p>
                  <p className="text-sm text-gray-800 capitalize">{OPERATION_TYPES[lead.operation as keyof typeof OPERATION_TYPES]?.label || lead.operation}</p>
                </div>
              </div>
            )}
            {lead.estimated_value && (
              <div className="flex items-start gap-3">
                <DollarSign className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Valor estimado</p>
                  <p className="text-sm text-gray-800">USD {lead.estimated_value}</p>
                </div>
              </div>
            )}
            {(lead.property_address || lead.neighborhood) && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Propiedad</p>
                  <p className="text-sm text-gray-800">{lead.property_address || lead.neighborhood}</p>
                </div>
              </div>
            )}
            {lead.notes && (
              <div className="flex items-start gap-3">
                <StickyNote className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Notas</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{lead.notes}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Próximo paso</p>
                {lead.next_step ? (
                  <p className="text-sm text-gray-800">{lead.next_step}{lead.next_step_date && <span className="text-gray-400 text-xs ml-1">· {formatDate(lead.next_step_date)}</span>}</p>
                ) : (
                  <button onClick={() => setEditing(true)} className="text-sm text-gray-400 hover:text-[#ff007c] transition-colors">+ Definir próximo paso</button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actividades */}
        <div className="bg-white border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#ff007c]" /> Actividades
            </h2>
            <Link
              href={`/actividades?lead_id=${leadId}`}
              className="flex items-center gap-1 text-xs text-[#ff007c] hover:underline font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Nueva
            </Link>
          </div>
          {activities.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Activity className="w-10 h-10 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400 mb-1">Sin actividades registradas</p>
              <Link href={`/actividades?lead_id=${leadId}`} className="text-sm text-[#ff007c] hover:underline">
                Registrar primera actividad
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {activities.slice(0, 10).map(a => {
                const mins = Math.floor((Date.now() - new Date(a.completed_at || a.created_at).getTime()) / 60000)
                const timeAgo = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 1440)}d`
                return (
                  <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50">
                    <div className="w-2 h-2 bg-[#ff007c] rounded-full shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 truncate">{a.description || a.activity_type}</p>
                      <p className="text-[10px] text-gray-400">{a.agent_name}</p>
                    </div>
                    <span className="text-[10px] text-gray-300 shrink-0">{timeAgo}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Historial de etapas */}
      {stageHistory.length > 0 && (
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-bold text-gray-900 mb-4">Historial de etapas</h2>
          <div className="space-y-3">
            {stageHistory.map((h: any) => {
              const toStage = LEAD_STAGES[h.to_stage as LeadStage]
              const dotColor = STAGE_DOT_COLORS[h.to_stage] ?? '#9ca3af'
              return (
                <div key={h.id ?? h.changed_at ?? h.created_at} className="flex items-start gap-3">
                  <span
                    className="w-3 h-3 rounded-full mt-0.5 shrink-0"
                    style={{ background: dotColor }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {LEAD_STAGES[h.from_stage as LeadStage]?.label ?? h.from_stage} → {toStage?.label ?? h.to_stage}
                    </p>
                    <p className="text-xs text-gray-400">
                      {h.changed_by_name ?? 'Sistema'} · {h.created_at ? formatDate(h.created_at) : ''}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Convert to Appraisal Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowConvertModal(false)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800 mb-2">Avanzar a tasación</h3>
            <p className="text-sm text-gray-500 mb-4">
              <strong>{lead.full_name}</strong> pasará a &ldquo;En tasación&rdquo;. ¿Querés crear una tasación vinculada?
            </p>
            <div className="space-y-2">
              <button onClick={() => handleConvertToAppraisal(true)} className="w-full px-4 py-3 bg-[#ff007c] text-white rounded-xl text-sm font-medium hover:opacity-90">
                Sí, crear tasación vinculada
              </button>
              <button onClick={() => handleConvertToAppraisal(false)} className="w-full px-4 py-3 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Solo avanzar etapa
              </button>
              <button onClick={() => setShowConvertModal(false)} className="w-full px-4 py-2 text-sm text-gray-400">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
