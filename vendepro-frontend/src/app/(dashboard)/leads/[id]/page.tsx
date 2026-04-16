'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Phone, MessageCircle, Edit3, Save, X, Trash2,
  MapPin, User, ChevronRight, Plus, Loader2
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  LEAD_STAGES, LEAD_STAGE_KEYS, LEAD_SOURCES, OPERATION_TYPES,
  getLeadChecklist, getLeadUrgency, formatWhatsApp, type LeadStage
} from '@/lib/crm-config'
import { formatDate } from '@/lib/utils'

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
  const urgency = getLeadUrgency(lead)
  const checklist = getLeadChecklist(lead)

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/leads" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm">
          <ArrowLeft className="w-4 h-4" /> Leads
        </Link>
        <div className="flex items-center gap-2">
          {!editing ? (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 border px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">
              <Edit3 className="w-3.5 h-3.5" /> Editar
            </button>
          ) : (
            <>
              <button onClick={() => { setEditing(false); setEditForm(lead) }} className="border px-3 py-1.5 rounded-lg text-sm">
                <X className="w-4 h-4" />
              </button>
              <button onClick={handleSave} disabled={saving} className="bg-[#ff007c] text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50">
                <Save className="w-3.5 h-3.5" /> Guardar
              </button>
            </>
          )}
          <button onClick={handleDelete} className="p-1.5 border rounded-lg text-gray-400 hover:text-red-500 hover:border-red-200">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Header */}
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
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{lead.full_name}</h1>
                {lead.contact_id && (
                  <Link
                    href="/contactos"
                    className="inline-flex items-center gap-2 text-sm text-gray-600 bg-gray-50 border rounded-lg px-3 py-1.5 hover:bg-gray-100 transition-colors mt-1"
                  >
                    <User className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="font-medium truncate max-w-[180px]">{lead.full_name}</span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-500 text-xs">Contacto</span>
                    <ChevronRight className="w-3 h-3 text-gray-400 ml-1" />
                  </Link>
                )}
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {lead.tags?.map((tag: any) => (
                    <button
                      key={tag.id}
                      onClick={() => handleRemoveTag(tag.id)}
                      className="group flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium text-white hover:opacity-80 transition-opacity"
                      style={{ background: tag.color }}
                      title="Quitar tag"
                    >
                      {tag.name}
                      <X className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                  <div className="relative">
                    <button
                      onClick={handleOpenTagPicker}
                      className="flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full font-medium border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Plus className="w-2.5 h-2.5" /> Tag
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
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stage.color}`}>{stage.label}</span>
                  {urgency === 'danger' && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">URGENTE</span>}
                  {urgency === 'warning' && <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium">Atención</span>}
                </div>
              </div>
              <div className="flex gap-2">
                {lead.phone && (
                  <>
                    <a href={`tel:${lead.phone}`} className="p-2 border rounded-lg hover:bg-blue-50 text-blue-500"><Phone className="w-4 h-4" /></a>
                    <a href={`https://wa.me/${formatWhatsApp(lead.phone)}`} target="_blank" rel="noreferrer"
                      className="p-2 border rounded-lg hover:bg-green-50 text-green-500"><MessageCircle className="w-4 h-4" /></a>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {lead.phone && <div><p className="text-xs text-gray-400 mb-0.5">Teléfono</p><p className="text-gray-700">{lead.phone}</p></div>}
              {lead.email && <div><p className="text-xs text-gray-400 mb-0.5">Email</p><p className="text-gray-700 truncate">{lead.email}</p></div>}
              {lead.operation && <div><p className="text-xs text-gray-400 mb-0.5">Operación</p><p className="text-gray-700 capitalize">{lead.operation}</p></div>}
              {lead.source && <div><p className="text-xs text-gray-400 mb-0.5">Origen</p><p className="text-gray-700">{LEAD_SOURCES[lead.source as keyof typeof LEAD_SOURCES]?.label || lead.source}</p></div>}
              {lead.neighborhood && <div><p className="text-xs text-gray-400 mb-0.5">Barrio</p><p className="text-gray-700 flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.neighborhood}</p></div>}
              {lead.estimated_value && <div><p className="text-xs text-gray-400 mb-0.5">Valor est.</p><p className="text-gray-700">USD {Number(lead.estimated_value).toLocaleString()}</p></div>}
              {lead.property_address && <div className="col-span-2 sm:col-span-3"><p className="text-xs text-gray-400 mb-0.5">Dirección</p><p className="text-gray-700">{lead.property_address}</p></div>}
              {lead.assigned_name && <div><p className="text-xs text-gray-400 mb-0.5">Agente</p><p className="text-gray-700 flex items-center gap-1"><User className="w-3 h-3" />{lead.assigned_name}</p></div>}
            </div>

            {lead.next_step && (
              <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
                <p className="text-xs text-yellow-600 font-medium mb-0.5">Próxima acción</p>
                <p className="text-sm text-yellow-800">{lead.next_step}</p>
                {lead.next_step_date && (
                  <p className="text-xs text-yellow-500 mt-1">{formatDate(lead.next_step_date)}</p>
                )}
              </div>
            )}

            {lead.notes && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-400 mb-0.5">Notas</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{lead.notes}</p>
              </div>
            )}

            {/* Checklist */}
            <div className="mt-3">
              <p className="text-xs text-gray-400 mb-2">Perfil completo</p>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(checklist).map(([k, v]) => (
                  <span key={k} className={`text-[10px] px-2 py-0.5 rounded-full ${v ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {k === 'contacto' ? 'Contacto' : k === 'necesidad' ? 'Necesidad' : k === 'operacion' ? 'Operación' : k === 'presupuesto' ? 'Presupuesto' : k === 'zona' ? 'Zona' : 'Próxima acción'}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Stage selector */}
      <div className="bg-white border rounded-xl p-4">
        <p className="text-xs text-gray-400 mb-3 font-medium">Etapa del lead</p>
        <div className="flex flex-wrap gap-2">
          {LEAD_STAGE_KEYS.map(s => (
            <button key={s} onClick={() => handleStageChange(s)} disabled={editing}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${lead.stage === s ? `${LEAD_STAGES[s].color} ring-2 ring-offset-1 ring-gray-300` : `${LEAD_STAGES[s].color} opacity-60 hover:opacity-100`} disabled:cursor-not-allowed`}>
              {LEAD_STAGES[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Activity */}
      {activities.length > 0 && (
        <div className="bg-white border rounded-xl p-4">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">Actividad reciente</h2>
          <div className="space-y-2">
            {activities.slice(0, 10).map(a => {
              const mins = Math.floor((Date.now() - new Date(a.completed_at || a.created_at).getTime()) / 60000)
              const timeAgo = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 1440)}d`
              return (
                <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <div className="w-2 h-2 bg-[#ff007c] rounded-full shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 truncate">{a.description || a.activity_type}</p>
                    <p className="text-[10px] text-gray-400">{a.agent_name}</p>
                  </div>
                  <span className="text-[10px] text-gray-300">{timeAgo}</span>
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
