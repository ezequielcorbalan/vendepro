'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Phone, Edit3, Save, X, Trash2,
  User, ChevronRight, Plus, Loader2, Calendar, Activity,
  Home, FileText, MapPin, Target, StickyNote, Building2,
  CheckCircle2, Mail, DollarSign
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { pushFromApiResponse } from '@/components/marketing/dataLayer'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/useConfirm'
import {
  LEAD_SOURCES, OPERATION_TYPES,
  getStageConfig, getStageDot,
  PROPERTY_STAGES, type PropertyStage,
} from '@/lib/crm-config'
import { formatDate } from '@/lib/utils'
import { CallButton, WhatsAppButton } from '@/components/ui/ContactButtons'
import { Card } from '@/components/ui/Card'
import { Heading } from '@/components/ui/Typography'
import { StageBadge } from '@/components/ui/StageBadge'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Timeline } from '@/components/ui/Timeline'
import { LeadStagePipeline } from '@/components/leads/LeadStagePipeline'
import { LeadPropertiesSection } from '@/components/leads/LeadPropertiesSection'
import { FichaLinkSection } from '@/components/fichas/FichaLinkSection'

// Etapas en las que conviene tener una propiedad/tasación vinculada: si el lead
// no tiene, ofrecemos crear/vincular antes de avanzar.
const NEEDS_PROPERTY_STAGES = ['en_tasacion', 'presentada', 'seguimiento']

export default function LeadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { confirmDialog, askConfirm } = useConfirm()
  const leadId = params.id as string

  const [lead, setLead] = useState<any>(null)
  const [activities, setActivities] = useState<any[]>([])
  const [fichas, setFichas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [propModal, setPropModal] = useState<{ targetStage: string; requireProperty: boolean } | null>(null)
  const [showReservaModal, setShowReservaModal] = useState(false)
  const [orgTags, setOrgTags] = useState<any[]>([])
  const [showTagPicker, setShowTagPicker] = useState(false)
  const [tagsLoading, setTagsLoading] = useState(false)
  const [stageHistory, setStageHistory] = useState<any[]>([])
  const [linkedProperty, setLinkedProperty] = useState<{ id: string; commercial_stage: string | null } | null>(null)

  function loadLead() {
    Promise.all([
      apiFetch('crm', `/leads?id=${leadId}`).then(r => r.json() as Promise<any>),
      apiFetch('crm', `/activities?lead_id=${leadId}`).then(r => r.json() as Promise<any>).catch(() => []),
      apiFetch('crm', `/stage-history?entity_type=lead&entity_id=${leadId}`).then(r => r.json() as Promise<any>).catch(() => []),
      apiFetch('properties', `/fichas?lead_id=${leadId}`).then(r => r.json() as Promise<any>).catch(() => []),
      apiFetch('properties', `/properties/by-lead/${leadId}`).then(r => r.json() as Promise<any>).catch(() => null),
    ]).then(([leadData, actsData, historyData, fichasData, propData]) => {
      const raw = Array.isArray(leadData) ? leadData[0] : leadData
      const l = raw && raw.id ? raw : null
      setLead(l)
      setEditForm(l || {})
      setActivities(Array.isArray(actsData) ? actsData : [])
      setStageHistory(Array.isArray(historyData) ? historyData : [])
      setFichas(Array.isArray(fichasData) ? fichasData : [])
      setLinkedProperty(propData && propData.id ? propData : null)
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
    const { confirmed } = await askConfirm({
      title: 'Eliminar lead',
      message: `¿Eliminar "${lead?.full_name}" permanentemente?\n\nSe borrarán sus eventos, actividades y tags. Las propiedades y tasaciones vinculadas se conservan (quedan sin lead).`,
      confirmLabel: 'Eliminar',
      variant: 'danger',
    })
    if (!confirmed) return
    try {
      await apiFetch('crm', `/leads?id=${leadId}`, { method: 'DELETE' })
      toast('Lead eliminado', 'warning')
      router.push('/leads')
    } catch { toast('Error al eliminar', 'error') }
  }

  const isBuyer = lead?.pipeline === 'comprador'

  const handleStageChange = async (stage: string) => {
    if (editing || stage === lead.stage) return
    if (isBuyer) {
      // Cerrado (oferta aceptada): sugerir crear la reserva vinculada.
      if (stage === 'cerrado') {
        setShowReservaModal(true)
        return
      }
      await applyStageChange(stage)
      return
    }
    if (stage === 'finalizado') {
      toast('Finalizado se asigna automáticamente cuando la propiedad se vende', 'warning')
      return
    }
    // Captado requiere una propiedad vinculada (bloqueante).
    if (stage === 'captado' && !linkedProperty) {
      setPropModal({ targetStage: 'captado', requireProperty: true })
      return
    }
    // En estas etapas conviene tener propiedad/tasación: si no hay, ofrecer crear/vincular.
    if (NEEDS_PROPERTY_STAGES.includes(stage) && !linkedProperty) {
      setPropModal({ targetStage: stage, requireProperty: false })
      return
    }
    await applyStageChange(stage)
  }

  // Ejecuta el cambio de etapa (avisa si hay property vinculada, pide motivo en
  // perdido/invalido). El override (bypass) se usa SOLO para mover hacia atrás
  // (corrección de errores); hacia adelante manda la máquina de estados, así que
  // solo se puede avanzar a la transición válida siguiente (no saltear etapas).
  const applyStageChange = async (stage: string) => {
    if (linkedProperty && !isBuyer) {
      const curLabel = PROPERTY_STAGES[linkedProperty.commercial_stage as PropertyStage]?.label || linkedProperty.commercial_stage || 'sin etapa'
      const { confirmed } = await askConfirm({
        title: 'Propiedad vinculada',
        message:
          `Este lead tiene una propiedad vinculada (etapa actual: «${curLabel}»).\n\n` +
          `Cambiar la etapa del lead puede modificar también la etapa de esa propiedad en su pipeline.\n\n¿Continuar?`,
        confirmLabel: 'Continuar',
      })
      if (!confirmed) return
    }
    try {
      if (stage === 'perdido' || stage === 'invalido') {
        const { confirmed, reason } = await askConfirm({
          title: stage === 'perdido' ? 'Marcar lead como perdido' : 'Marcar lead como inválido',
          message: stage === 'perdido'
            ? '¿Por qué se pierde este lead?'
            : 'Ej: propiedad no apta, datos duplicados, fake, etc.',
          confirmLabel: stage === 'perdido' ? 'Marcar perdido' : 'Marcar inválido',
          variant: 'danger',
          requireReason: true,
          reasonPlaceholder: 'Motivo (opcional)',
        })
        if (!confirmed) return
        const r = await apiFetch('crm', '/leads/stage', {
          method: 'POST',
          body: JSON.stringify({ id: leadId, stage, notes: reason || 'Sin motivo', override: true }),
        })
        pushFromApiResponse(await r.json().catch(() => ({})), { entity_type: 'lead', entity_id: leadId, event_name_fallback: stage })
        toast(`Lead marcado como ${stage === 'perdido' ? 'perdido' : 'inválido'}`, 'warning')
      } else {
        // Hacia atrás (orden menor) = corrección → bypass. Hacia adelante = la
        // máquina de estados valida (solo deja avanzar a la transición válida).
        const curOrder = getStageConfig(lead.stage, lead.pipeline).order
        const targetOrder = getStageConfig(stage, lead.pipeline).order
        const override = targetOrder < curOrder
        const res = await apiFetch('crm', '/leads/stage', {
          method: 'POST',
          body: JSON.stringify({ id: leadId, stage, override }),
        })
        const result = (await res.json()) as any
        if (!res.ok) { toast(result?.error || 'No se pudo avanzar a esa etapa', 'error'); return }
        pushFromApiResponse(result, { entity_type: 'lead', entity_id: leadId, event_name_fallback: stage })
        toast(`Etapa: ${getStageConfig(stage, lead.pipeline).label}`)
        if (result.autoFollowup) toast(`Seguimiento automático creado para ${formatDate(result.autoFollowup.start_at)}`)
        if (result.syncedPropertyId) {
          const propLabel = PROPERTY_STAGES[result.syncedPropertyStage as PropertyStage]?.label || result.syncedPropertyStage
          toast(`La propiedad vinculada también avanzó a "${propLabel}" en su pipeline`, 'info')
        }
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

  const handleQuickActivity = async (activity_type: 'llamada' | 'whatsapp') => {
    try {
      await apiFetch('crm', '/activities', {
        method: 'POST',
        body: JSON.stringify({ activity_type, lead_id: leadId }),
      })
      const stage = lead?.stage
      if (stage === 'nuevo' || stage === 'asignado') {
        await apiFetch('crm', '/leads/stage', {
          method: 'POST',
          body: JSON.stringify({ id: leadId, stage: 'contactado' }),
        }).catch(() => {})
      }
      toast(activity_type === 'llamada' ? 'Llamada registrada' : 'WhatsApp registrado')
      loadLead()
    } catch { /* link still opens — silent fail on log */ }
  }

  // Navega a crear la TASACIÓN vinculada (wizard /tasaciones/nueva con el lead
  // pre-vinculado en el step de propiedad).
  const goCreateAppraisal = () => {
    setPropModal(null)
    router.push(`/tasaciones/nueva?lead_id=${leadId}`)
  }

  // Navega a crear la PROPIEDAD vinculada (prefill con lead y ficha si existe).
  const goCreateProperty = () => {
    const qs = new URLSearchParams({ lead_id: leadId })
    if (fichas.length > 0) qs.set('ficha_id', fichas[0].id)
    if (lead?.property_address) qs.set('address', lead.property_address)
    setPropModal(null)
    router.push(`/propiedades/nueva?${qs.toString()}`)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <Button variant="outline" icon={<FileText className="w-3.5 h-3.5" />} onClick={() => router.push(`/fichas/nueva?lead_id=${leadId}`)}>
            Ficha de tasación
          </Button>
        </div>
        <div className="h-32 bg-gray-200 rounded-card animate-pulse" />
        <div className="h-48 bg-gray-200 rounded-card animate-pulse" />
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Lead no encontrado</p>
        <Link href="/leads" className="text-brand-pink hover:underline text-sm mt-2 block">Volver a Leads</Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {confirmDialog}
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link href="/leads" className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Volver a Leads
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          {!editing ? (
            <Button variant="outline" icon={<Edit3 className="w-3.5 h-3.5" />} onClick={() => setEditing(true)}>Editar</Button>
          ) : (
            <>
              <Button variant="outline" aria-label="Cancelar" onClick={() => { setEditing(false); setEditForm(lead) }}>
                <X className="w-4 h-4" />
              </Button>
              <Button loading={saving} icon={<Save className="w-3.5 h-3.5" />} onClick={handleSave}>Guardar</Button>
            </>
          )}
          {!isBuyer && (
            <>
              {/* ds-todo: candidato a variante "accent" (naranja de marca) — por ahora outline */}
              <Button
                variant="outline"                icon={<FileText className="w-3.5 h-3.5" />}
                disabled={editing}
                onClick={() => {
                  const qs = new URLSearchParams({ lead_id: leadId })
                  if (lead?.property_address) qs.set('address', lead.property_address)
                  if (lead?.neighborhood) qs.set('neighborhood', lead.neighborhood)
                  router.push(`/fichas/nueva?${qs.toString()}`)
                }}
              >
                Ficha de tasación
              </Button>
              {/* ds-todo: candidato a variante "success" (verde crear) — por ahora primary */}
              <Button                icon={<Home className="w-3.5 h-3.5" />}
                onClick={() => {
                  const qs = new URLSearchParams({ lead_id: leadId })
                  if (fichas.length > 0) qs.set('ficha_id', fichas[0].id)
                  router.push(`/propiedades/nueva?${qs.toString()}`)
                }}
              >
                Crear propiedad
              </Button>
            </>
          )}
          <Button variant="outline" size="icon" aria-label="Eliminar" onClick={handleDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Header card */}
      <Card padded={false} className="p-5 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-pink to-brand-orange" />
        <img
          src="/brand/GV-27.png"
          alt=""
          aria-hidden="true"
          className="absolute -top-8 -right-8 w-32 h-32 opacity-10 pointer-events-none"
        />
        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nombre" htmlFor="lf-name" required>
                <Input id="lf-name" value={editForm.full_name || ''} onChange={e => setEditForm((f: any) => ({ ...f, full_name: e.target.value }))} />
              </Field>
              <Field label="Teléfono" htmlFor="lf-phone">
                <Input id="lf-phone" value={editForm.phone || ''} onChange={e => setEditForm((f: any) => ({ ...f, phone: e.target.value }))} />
              </Field>
              <Field label="Email" htmlFor="lf-email">
                <Input id="lf-email" value={editForm.email || ''} onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))} />
              </Field>
              <Field label="Origen" htmlFor="lf-source">
                <Select id="lf-source" value={editForm.source || 'manual'} onChange={e => setEditForm((f: any) => ({ ...f, source: e.target.value }))}>
                  {Object.entries(LEAD_SOURCES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </Select>
              </Field>
              <Field label="Operación" htmlFor="lf-op">
                <Select id="lf-op" value={editForm.operation || 'venta'} onChange={e => setEditForm((f: any) => ({ ...f, operation: e.target.value }))}>
                  {Object.entries(OPERATION_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </Select>
              </Field>
              <Field label="Barrio" htmlFor="lf-hood">
                <Input id="lf-hood" value={editForm.neighborhood || ''} onChange={e => setEditForm((f: any) => ({ ...f, neighborhood: e.target.value }))} />
              </Field>
              <Field label="Dirección propiedad" htmlFor="lf-addr" className="sm:col-span-2">
                <Input id="lf-addr" value={editForm.property_address || ''} onChange={e => setEditForm((f: any) => ({ ...f, property_address: e.target.value }))} />
              </Field>
              <Field label="Valor estimado (USD)" htmlFor="lf-val">
                <Input id="lf-val" type="number" value={editForm.estimated_value || ''} onChange={e => setEditForm((f: any) => ({ ...f, estimated_value: e.target.value }))} />
              </Field>
            </div>
            <Field label="Próxima acción" htmlFor="lf-next">
              <Input id="lf-next" value={editForm.next_step || ''} onChange={e => setEditForm((f: any) => ({ ...f, next_step: e.target.value }))} />
            </Field>
            <Field label="Fecha próxima acción" htmlFor="lf-nextdate">
              <Input id="lf-nextdate" type="date" value={editForm.next_step_date || ''} onChange={e => setEditForm((f: any) => ({ ...f, next_step_date: e.target.value }))} />
            </Field>
            <Field label="Notas" htmlFor="lf-notes">
              <Textarea id="lf-notes" rows={3} value={editForm.notes || ''} onChange={e => setEditForm((f: any) => ({ ...f, notes: e.target.value }))} />
            </Field>
          </div>
        ) : (
          <>
            {/* Name + stage badge + contact type badge */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Heading level={2} as="h1">{lead.full_name}</Heading>
                <StageBadge stage={lead.stage} pipeline={lead.pipeline} />
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
                    <div className="absolute top-full left-0 mt-1 bg-white border rounded-card shadow-pop z-10 p-2 min-w-[160px]">
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
              <CallButton phone={lead.phone} onClick={() => handleQuickActivity('llamada')} />
              <WhatsAppButton phone={lead.phone} onClick={() => handleQuickActivity('whatsapp')} />
              <Link
                href={`/calendario?lead_id=${leadId}`}
                className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-control text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <Calendar className="w-4 h-4" /> Agendar
              </Link>
            </div>
          </>
        )}
      </Card>

      {/* Pipeline */}
      <LeadStagePipeline currentStage={lead.stage} pipeline={isBuyer ? 'comprador' : 'vendedor'} onSelect={handleStageChange} disabled={editing} />

      {/* Two-column: Datos + Actividades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Datos del lead */}
        <Card padded={false} className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-control bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center shadow-card">
              <User className="w-4 h-4 text-white" />
            </div>
            <Heading level={4}>Datos del lead</Heading>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Nombre</p>
                <p className="text-sm text-ink">{lead.full_name || '—'}</p>
              </div>
            </div>
            {lead.phone && (
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Teléfono</p>
                  <a href={`tel:${lead.phone}`} className="text-sm text-brand-pink hover:underline">{lead.phone}</a>
                </div>
              </div>
            )}
            {lead.email && (
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Email</p>
                  <a href={`mailto:${lead.email}`} className="text-sm text-brand-pink hover:underline">{lead.email}</a>
                </div>
              </div>
            )}
            {lead.source && (
              <div className="flex items-start gap-3">
                <Target className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Fuente</p>
                  <p className="text-sm text-ink">{LEAD_SOURCES[lead.source as keyof typeof LEAD_SOURCES]?.label || lead.source}</p>
                </div>
              </div>
            )}
            {lead.operation && (
              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Operación</p>
                  <p className="text-sm text-ink capitalize">{OPERATION_TYPES[lead.operation as keyof typeof OPERATION_TYPES]?.label || lead.operation}</p>
                </div>
              </div>
            )}
            {lead.estimated_value && (
              <div className="flex items-start gap-3">
                <DollarSign className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Valor estimado</p>
                  <p className="text-sm text-ink">USD {lead.estimated_value}</p>
                </div>
              </div>
            )}
            {(lead.property_address || lead.neighborhood) && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Propiedad</p>
                  <p className="text-sm text-ink">{lead.property_address || lead.neighborhood}</p>
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
                  <p className="text-sm text-ink">{lead.next_step}{lead.next_step_date && <span className="text-gray-400 text-xs ml-1">· {formatDate(lead.next_step_date)}</span>}</p>
                ) : (
                  <button onClick={() => setEditing(true)} className="text-sm text-gray-400 hover:text-brand-pink transition-colors">+ Definir próximo paso</button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Actividades */}
        <Card padded={false} className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-control bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center shadow-card">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <Heading level={4}>Actividades</Heading>
            </div>
            <Link
              href={`/actividades?lead_id=${leadId}`}
              className="flex items-center gap-1 text-xs text-brand-pink hover:underline font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Nueva
            </Link>
          </div>
          {activities.length === 0 ? (
            <EmptyState
              icon={<Activity className="w-6 h-6" />}
              title="Sin actividades registradas"
              action={<Link href={`/actividades?lead_id=${leadId}`} className="text-sm text-primary hover:underline">Registrar primera actividad</Link>}
            />
          ) : (
            <div className="space-y-2">
              {activities.slice(0, 10).map(a => {
                const mins = Math.floor((Date.now() - new Date(a.completed_at || a.created_at).getTime()) / 60000)
                const timeAgo = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 1440)}d`
                return (
                  <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50">
                    <div className="w-2 h-2 bg-brand-pink rounded-full shrink-0" />
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
        </Card>
      </div>

      {/* Comprador: propiedades de interés. Vendedor: fichas de tasación. */}
      {isBuyer && <LeadPropertiesSection leadId={leadId} />}

      {/* Link para que el propietario cargue la ficha antes de la visita. */}
      {!isBuyer && (
        <FichaLinkSection mode="single" leadId={leadId} ownerPhone={lead?.phone ?? null} />
      )}

      {/* Fichas de tasación */}
      {!isBuyer && (
      <Card padded={false} className="p-5">
        <div className="flex items-center justify-between mb-4">
          <Heading level={4} className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-600" /> Fichas de tasación
          </Heading>
          <button
            onClick={() => {
              const qs = new URLSearchParams({ lead_id: leadId })
              if (lead?.property_address) qs.set('address', lead.property_address)
              if (lead?.neighborhood) qs.set('neighborhood', lead.neighborhood)
              router.push(`/fichas/nueva?${qs.toString()}`)
            }}
            className="flex items-center gap-1 text-xs text-brand-pink hover:underline font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Nueva
          </button>
        </div>
        {fichas.length === 0 ? (
          <EmptyState icon={<FileText className="w-6 h-6" />} title="Sin fichas registradas" />
        ) : (
          <div className="space-y-2">
            {fichas.map((ficha: any) => (
              <div key={ficha.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{ficha.address || 'Sin dirección'}</p>
                  <p className="text-xs text-gray-400">
                    {ficha.inspection_date ? formatDate(ficha.inspection_date) : (ficha.created_at ? formatDate(ficha.created_at) : '—')}
                    {ficha.neighborhood ? ` · ${ficha.neighborhood}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => router.push(`/propiedades/nueva?lead_id=${leadId}&ficha_id=${ficha.id}`)}
                  className="flex items-center gap-1 text-xs text-green-700 hover:bg-green-50 font-medium px-2 py-1 rounded-lg shrink-0"
                >
                  <Home className="w-3.5 h-3.5" /> Crear propiedad
                </button>
                <Link
                  href={`/fichas/${ficha.id}`}
                  className="text-xs text-brand-pink hover:underline font-medium px-2 py-1 shrink-0"
                >
                  Editar
                </Link>
              </div>
            ))}
          </div>
        )}
      </Card>
      )}

      {/* Historial de etapas */}
      {stageHistory.length > 0 && (
        <Card padded={false} className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-control bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center shadow-card">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <Heading level={4}>Historial de etapas</Heading>
          </div>
          <Timeline
            items={stageHistory.map((h: any) => ({
              label: `${h.from_stage ? getStageConfig(h.from_stage, lead.pipeline).label : '—'} → ${getStageConfig(h.to_stage, lead.pipeline).label}`,
              meta: `${h.changed_by_name ?? 'Sistema'} · ${h.created_at ? formatDate(h.created_at) : ''}`,
              color: getStageDot(h.to_stage),
            }))}
          />
        </Card>
      )}

      {/* Vincular propiedad / tasación al cambiar de etapa */}
      {propModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setPropModal(null)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-ink mb-2">
              {propModal.requireProperty
                ? 'Necesitás una propiedad vinculada'
                : `Vincular propiedad o tasación`}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {propModal.requireProperty ? (
                <>Para marcar a <strong>{lead.full_name}</strong> como &ldquo;Captado&rdquo; primero tenés que crear y vincular una propiedad.</>
              ) : (
                <><strong>{lead.full_name}</strong> no tiene una propiedad ni tasación vinculada. Para &ldquo;{getStageConfig(propModal.targetStage, lead.pipeline).label}&rdquo; conviene tener una. ¿Qué querés hacer?</>
              )}
            </p>
            <div className="space-y-2">
              <button onClick={goCreateProperty} className="w-full px-4 py-3 bg-green-600 text-white rounded-control text-sm font-medium hover:bg-green-700 flex items-center justify-center gap-2">
                <Home className="w-4 h-4" /> Crear propiedad vinculada
              </button>
              <button onClick={goCreateAppraisal} className="w-full px-4 py-3 bg-gradient-to-br from-brand-pink to-brand-orange text-white rounded-control text-sm font-medium hover:opacity-90 flex items-center justify-center gap-2">
                <FileText className="w-4 h-4" /> Crear tasación vinculada
              </button>
              {!propModal.requireProperty && (
                <button onClick={() => { const t = propModal.targetStage; setPropModal(null); applyStageChange(t) }} className="w-full px-4 py-3 border rounded-control text-sm text-gray-600 hover:bg-gray-50">
                  Avanzar sin vincular
                </button>
              )}
              <button onClick={() => setPropModal(null)} className="w-full px-4 py-2 text-sm text-gray-400">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Comprador → Cerrado: sugerir crear la reserva (no obligatorio) */}
      {showReservaModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowReservaModal(false)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-ink mb-2">Cerrar comprador</h3>
            <p className="text-sm text-gray-500 mb-4">
              La oferta de <strong>{lead.full_name}</strong> fue aceptada. ¿Querés crear la reserva para seguir el cierre en Operaciones?
            </p>
            <div className="space-y-2">
              <button
                onClick={async () => { setShowReservaModal(false); await applyStageChange('cerrado'); router.push('/reservas') }}
                className="w-full px-4 py-3 bg-pink-600 text-white rounded-control text-sm font-medium hover:bg-pink-700"
              >
                Cerrar y crear reserva
              </button>
              <button
                onClick={async () => { setShowReservaModal(false); await applyStageChange('cerrado') }}
                className="w-full px-4 py-3 border rounded-control text-sm text-gray-600 hover:bg-gray-50"
              >
                Solo cerrar
              </button>
              <button onClick={() => setShowReservaModal(false)} className="w-full px-4 py-2 text-sm text-gray-400">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
