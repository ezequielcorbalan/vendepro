'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Plus, Search, Phone, X,
  AlertTriangle, User, MapPin, ArrowRight, ChevronDown, Download, Sparkles, Trash2, GripVertical,
  ChevronRight, Check, Tag, Loader2
} from 'lucide-react'
import {
  LEAD_SOURCES, LEAD_FLAGS,
  LEAD_AGENT_FINAL_STAGES, BUYER_LEAD_TERMINAL_STAGES,
  OPERATION_TYPES, getLeadChecklist,
  getLeadUrgency, getUrgencyBadge,
  getStagesForPipeline, getStageConfig, type LeadPipelineKey
} from '@/lib/crm-config'
import type { Contact } from '@/lib/types'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/useConfirm'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Tabs } from '@/components/ui/Tabs'
import { StageBadge } from '@/components/ui/StageBadge'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Heading, Text } from '@/components/ui/Typography'
import { CallButton, WhatsAppButton } from '@/components/ui/ContactButtons'
import AIChatPanel from '@/components/ai/AIChatPanel'
import { apiFetch } from '@/lib/api'
import { loadStickyFilters, saveStickyFilters } from '@/lib/sticky-filters'
import { scopeQueryString } from '@/lib/agent-scope'
import { pushFromApiResponse } from '@/components/marketing/dataLayer'
import { DndContext, DragOverlay, useDraggable, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'

/** Lo que se recuerda de la pantalla entre visitas (ver lib/sticky-filters). */
const LEADS_FILTERS_KEY = 'vendepro:leads-filters:v1'

interface StickyLeadFilters {
  search: string
  stage: string
  source: string
  operation: string
  agent: string
  sort: 'recent' | 'name' | 'urgency'
  view: 'list' | 'kanban'
}

/** Etapas que cierran el trabajo del agente según el pipeline del lead. */
function isAgentFinalStage(lead: any): boolean {
  if (lead?.pipeline === 'comprador') return (BUYER_LEAD_TERMINAL_STAGES as readonly string[]).includes(lead.stage)
  return (LEAD_AGENT_FINAL_STAGES as readonly string[]).includes(lead.stage)
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 60000
  if (diff < 60) return `${Math.floor(diff)}m`
  if (diff < 1440) return `${Math.floor(diff / 60)}h`
  const days = Math.floor(diff / 1440)
  if (days === 1) return 'Ayer'
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export default function LeadsPage() {
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { confirmDialog, askConfirm } = useConfirm()
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [pipeline, setPipeline] = useState<LeadPipelineKey>(
    searchParams.get('pipeline') === 'comprador' ? 'comprador' : 'vendedor'
  )
  const stages = getStagesForPipeline(pipeline)
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState<string>(searchParams.get('stage') || '')
  const [filterSource, setFilterSource] = useState('')
  const [filterOperation, setFilterOperation] = useState('')
  const [filterAgent, setFilterAgent] = useState('')
  const [agents, setAgents] = useState<any[]>([])
  const sortParam = searchParams.get('sort')
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'urgency'>(
    (['recent', 'name', 'urgency'] as const).includes(sortParam as any) ? sortParam as 'recent' | 'name' | 'urgency' : 'recent'
  )
  // Los filtros se recuerdan por 8h (ver sticky-filters): entrar a un lead y
  // volver no tiene que resetear lo que el agente estaba mirando. Se aplican
  // en un efecto y no en el useState inicial porque localStorage no existe en
  // el render del servidor y eso rompería la hidratación.
  const [filtersRestored, setFiltersRestored] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const [saving, setSaving] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState<any>(null)

  // ── Modal de creación — 2 pasos ──────────────────────────────
  const [createStep, setCreateStep] = useState<1 | 2>(1)
  const [contactSearch, setContactSearch] = useState('')
  const [contactResults, setContactResults] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [showNewContactForm, setShowNewContactForm] = useState(false)
  const [contactForm, setContactForm] = useState({
    full_name: '', phone: '', email: '',
    contact_type: searchParams.get('pipeline') === 'comprador' ? 'comprador' : 'propietario'
  })
  const contactSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [form, setForm] = useState({
    source: 'manual', source_detail: '',
    property_address: '', neighborhood: '', operation: 'venta', budget: '',
    notes: '', estimated_value: '', assigned_to: '', next_step: '', next_step_date: ''
  })

  const loadLeads = useCallback((p: LeadPipelineKey = pipeline) => {
    const scope = scopeQueryString()
    apiFetch('crm', `/leads${scope}${scope ? '&' : '?'}pipeline=${p}`)
      .then(r => r.json() as Promise<any>)
      .then(d => { setLeads(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [pipeline])

  useEffect(() => {
    setLoading(true)
    loadLeads()
  }, [pipeline]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    apiFetch('admin', '/agents').then(r => r.json() as Promise<any>).then(d => { if (Array.isArray(d)) setAgents(d) }).catch(() => {})
  }, [])

  // Restaura lo último que el agente estaba mirando. La URL gana: si venís de
  // un link con ?stage= o ?sort= (dashboard, notificaciones), ese filtro es el
  // que se quiso mostrar y no lo pisa el recuerdo.
  useEffect(() => {
    const saved = loadStickyFilters<StickyLeadFilters>(LEADS_FILTERS_KEY)
    if (saved) {
      // La etapa guardada puede ser de otro pipeline (vendedor ↔ comprador):
      // si no existe en el actual se descarta, si no el filtro dejaría la
      // lista vacía sin explicación.
      if (!searchParams.get('stage') && saved.stage && getStagesForPipeline(pipeline).keys.includes(saved.stage)) {
        setFilterStage(saved.stage)
      }
      if (!sortParam && saved.sort) setSortBy(saved.sort)
      if (saved.search) setSearch(saved.search)
      if (saved.source) setFilterSource(saved.source)
      if (saved.operation) setFilterOperation(saved.operation)
      if (saved.agent) setFilterAgent(saved.agent)
      if (saved.view) setView(saved.view)
    }
    setFiltersRestored(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Recién después de restaurar: si no, el primer render guardaría los
    // defaults encima de lo que había.
    if (!filtersRestored) return
    saveStickyFilters<StickyLeadFilters>(LEADS_FILTERS_KEY, {
      search, stage: filterStage, source: filterSource,
      operation: filterOperation, agent: filterAgent, sort: sortBy, view,
    })
  }, [filtersRestored, search, filterStage, filterSource, filterOperation, filterAgent, sortBy, view])

  const switchPipeline = (p: LeadPipelineKey) => {
    if (p === pipeline) return
    setPipeline(p)
    setFilterStage('')
    // Refleja la pestaña en la URL sin re-render de Next
    const url = new URL(window.location.href)
    if (p === 'comprador') url.searchParams.set('pipeline', 'comprador')
    else url.searchParams.delete('pipeline')
    window.history.replaceState(null, '', url.toString())
  }

  // Auto-open create modal when coming from contact detail (?new=1&contact_id=X)
  useEffect(() => {
    const newParam = searchParams.get('new')
    const contactIdParam = searchParams.get('contact_id')
    if (newParam !== '1' || !contactIdParam) return

    apiFetch('crm', `/contacts/${contactIdParam}`)
      .then(r => r.json() as Promise<any>)
      .then(data => {
        if (data?.id) {
          setSelectedContact(data as Contact)
          setCreateStep(2)
          setShowCreate(true)
        }
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!contactSearch.trim() || selectedContact) {
      setContactResults([])
      return
    }
    if (contactSearchRef.current) clearTimeout(contactSearchRef.current)
    contactSearchRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch('crm', `/contacts?search=${encodeURIComponent(contactSearch)}`)
        const data = (await res.json()) as any
        setContactResults(Array.isArray(data) ? data.slice(0, 5) : [])
      } catch {
        setContactResults([])
      }
    }, 300)
  }, [contactSearch, selectedContact])

  const filtered = useMemo(() => {
    const result = leads.filter(l => {
      if (search) {
        const q = search.toLowerCase()
        if (!((l.full_name || '').toLowerCase().includes(q) ||
              (l.phone || '').includes(q) ||
              (l.email || '').toLowerCase().includes(q) ||
              (l.property_address || '').toLowerCase().includes(q) ||
              (l.neighborhood || '').toLowerCase().includes(q))) return false
      }
      if (filterStage && l.stage !== filterStage) return false
      if (filterSource && l.source !== filterSource) return false
      if (filterOperation && l.operation !== filterOperation) return false
      if (filterAgent && l.assigned_to !== filterAgent) return false
      return true
    })
    // Sort
    if (sortBy === 'name') result.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
    else if (sortBy === 'urgency') result.sort((a, b) => {
      const ua = getLeadUrgency(a), ub = getLeadUrgency(b)
      const order = { danger: 0, warning: 1, ok: 2, lost: 3 }
      return (order[ua] || 2) - (order[ub] || 2)
    })
    // 'recent' is already sorted by updated_at DESC from API
    return result
  }, [leads, search, filterStage, filterSource, filterOperation, filterAgent, sortBy])


  const closeCreateModal = () => {
    setShowCreate(false)
    setCreateStep(1)
    setContactSearch('')
    setContactResults([])
    setSelectedContact(null)
    setShowNewContactForm(false)
    setContactForm({ full_name: '', phone: '', email: '', contact_type: pipeline === 'comprador' ? 'comprador' : 'propietario' })
    setForm({
      source: 'manual', source_detail: '', property_address: '', neighborhood: '',
      operation: 'venta', budget: '', notes: '', estimated_value: '', assigned_to: '',
      next_step: '', next_step_date: ''
    })
  }

  const handleCreate = async () => {
    setSaving(true)
    try {
      const payload: any = { ...form }

      if (pipeline === 'comprador') payload.pipeline = 'comprador'

      if (selectedContact?.id) {
        payload.contact_id = selectedContact.id
      } else {
        payload.contact_data = {
          full_name: contactForm.full_name.trim(),
          phone: contactForm.phone || null,
          email: contactForm.email || null,
          contact_type: contactForm.contact_type,
        }
      }

      const res = await apiFetch('crm', '/leads', { method: 'POST', body: JSON.stringify(payload) })
      const data = (await res.json()) as any
      if (data.id) {
        closeCreateModal()
        toast('Lead creado correctamente')
        loadLeads()
      } else {
        toast(data.error || 'Error al crear lead', 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    }
    setSaving(false)
  }

  const advanceStage = async (lead: any) => {
    const leadStages = getStagesForPipeline(lead.pipeline === 'comprador' ? 'comprador' : 'vendedor')
    const pipelineStages = leadStages.pipelineStages
    const currentIdx = pipelineStages.indexOf(lead.stage)
    if (currentIdx < 0 || currentIdx >= pipelineStages.length - 1) return
    const nextStage = pipelineStages[currentIdx + 1]

    // en_tasacion → show convert modal (solo pipeline vendedor)
    if (nextStage === 'en_tasacion') {
      setShowConvertModal(lead)
      return
    }

    try {
      const res = await apiFetch('crm', '/leads/stage', {
        method: 'POST',
        body: JSON.stringify({ id: lead.id, stage: nextStage })
      })
      const result = (await res.json()) as any
      pushFromApiResponse(result, { entity_type: 'lead', entity_id: lead.id, event_name_fallback: nextStage })
      const stageLabel = getStageConfig(nextStage, lead.pipeline).label
      toast(`${lead.full_name} → ${stageLabel}`)
      loadLeads()
    } catch { toast('Error al cambiar etapa', 'error') }
  }

  const handleConvertToAppraisal = async (lead: any, createAppraisal: boolean) => {
    try {
      const stageRes = await apiFetch('crm', '/leads/stage', {
        method: 'POST',
        body: JSON.stringify({ id: lead.id, stage: 'en_tasacion' })
      })
      pushFromApiResponse(await stageRes.json().catch(() => ({})), { entity_type: 'lead', entity_id: lead.id, event_name_fallback: 'en_tasacion' })
      if (createAppraisal) {
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
            })
          })
          toast(`Tasación creada para ${lead.full_name}`)
        } catch {
          toast(`${lead.full_name} → En tasación (error al crear tasación)`, 'error')
        }
      } else {
        toast(`${lead.full_name} → En tasación`)
      }
      setShowConvertModal(null)
      loadLeads()
    } catch { toast('Error al cambiar etapa', 'error') }
  }

  const moveToStage = useCallback(async (leadId: string, stage: string) => {
    if (stage === 'finalizado') {
      toast('Finalizado se asigna automáticamente cuando la propiedad se vende', 'warning')
      return
    }
    if (stage === 'en_tasacion') {
      const lead = leads.find(l => l.id === leadId)
      if (lead) { setShowConvertModal(lead); return }
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
          body: JSON.stringify({ id: leadId, stage, notes: reason || 'Sin motivo' })
        })
        pushFromApiResponse(await r.json().catch(() => ({})), { entity_type: 'lead', entity_id: leadId, event_name_fallback: stage })
        toast(`Lead marcado como ${stage === 'perdido' ? 'perdido' : 'inválido'}`, 'warning')
      } else {
        const r = await apiFetch('crm', '/leads/stage', {
          method: 'POST',
          body: JSON.stringify({ id: leadId, stage })
        })
        pushFromApiResponse(await r.json().catch(() => ({})), { entity_type: 'lead', entity_id: leadId, event_name_fallback: stage })
        const movedLead = leads.find(l => l.id === leadId)
        const stageLabel = getStageConfig(stage, movedLead?.pipeline).label
        toast(`Movido a ${stageLabel}`)
      }
      loadLeads()
    } catch { toast('Error al mover etapa', 'error') }
  }, [leads])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)
    if (!over || !active) return
    const leadId = active.id as string
    const targetStage = over.id as string
    const lead = leads.find(l => l.id === leadId)
    if (!lead || lead.stage === targetStage) return
    moveToStage(leadId, targetStage)
  }, [leads, moveToStage])

  const markLost = async (leadId: string) => {
    const { confirmed, reason } = await askConfirm({
      title: 'Marcar lead como perdido',
      message: 'Ej: no responde, presupuesto fuera de rango, eligió otra inmobiliaria, etc.',
      confirmLabel: 'Marcar perdido',
      variant: 'danger',
      requireReason: true,
      reasonPlaceholder: 'Motivo (opcional)',
    })
    if (!confirmed) return
    try {
      const r = await apiFetch('crm', '/leads/stage', {
        method: 'POST',
        body: JSON.stringify({ id: leadId, stage: 'perdido', notes: reason || 'Sin motivo especificado' })
      })
      pushFromApiResponse(await r.json().catch(() => ({})), { entity_type: 'lead', entity_id: leadId, event_name_fallback: 'perdido' })
      toast('Lead marcado como perdido', 'warning')
      loadLeads()
    } catch { toast('Error al marcar como perdido', 'error') }
  }

  const deleteLead = async (leadId: string, leadName: string) => {
    const { confirmed } = await askConfirm({
      title: 'Eliminar lead',
      message: `¿Eliminar "${leadName}" permanentemente?\n\nSe borran sus eventos, actividades y tags. Las propiedades y tasaciones vinculadas se conservan. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      variant: 'danger',
    })
    if (!confirmed) return
    try {
      await apiFetch('crm', `/leads?id=${leadId}`, { method: 'DELETE' })
      toast('Lead eliminado', 'warning')
      loadLeads()
    } catch { toast('Error al eliminar', 'error') }
  }

  const canProceedStep1 = selectedContact !== null ||
    (showNewContactForm && contactForm.full_name.trim().length >= 2)

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {confirmDialog}
      {/* Header */}
      <PageHeader
        title="Leads"
        subtitle={`${leads.length} lead${leads.length !== 1 ? 's' : ''} en el pipeline ${pipeline === 'comprador' ? 'de compradores' : 'de captación'}`}
        actions={
          <>
            <Button
              variant="outline"
              icon={<Download className="w-4 h-4" />}
              className="hidden sm:inline-flex"
              onClick={() => {
                const rows = [
                  ['Nombre', 'Teléfono', 'Email', 'Operación', 'Etapa', 'Barrio', 'Valor USD', 'Agente', 'Próximo paso', 'Creado'],
                  ...filtered.map(l => [
                    l.full_name, l.phone || '', l.email || '', l.operation || '',
                    getStageConfig(l.stage, l.pipeline).label,
                    l.neighborhood || '', l.estimated_value || '', l.assigned_name || '',
                    l.next_step || '', new Date(l.created_at).toLocaleDateString('es-AR')
                  ])
                ]
                const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'
                document.body.appendChild(a); a.click(); document.body.removeChild(a)
                URL.revokeObjectURL(url)
              }}
            >
              CSV
            </Button>
            <Button variant="outline" icon={<Sparkles className="w-4 h-4" />} onClick={() => setShowAI(true)} className="border-primary/30 text-primary hover:bg-primary/5">
              <span className="hidden sm:inline">con IA</span>
            </Button>
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>
              <span className="hidden sm:inline">Nuevo lead</span><span className="sm:hidden">Nuevo</span>
            </Button>
          </>
        }
      />

      {/* Pestañas de pipeline: Vendedores | Compradores */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <Tabs
          className="border-b-0"
          value={pipeline}
          onChange={v => switchPipeline(v as LeadPipelineKey)}
          items={[
            { value: 'vendedor', label: 'Vendedores' },
            { value: 'comprador', label: 'Compradores' },
          ]}
        />
        <SegmentedControl
          className="hidden sm:inline-flex mb-1"
          options={[{ value: 'list', label: 'Lista' }, { value: 'kanban', label: 'Kanban' }]}
          value={view}
          onChange={v => setView(v as 'list' | 'kanban')}
        />
      </div>

      {/* Búsqueda + filtros: una sola fila compacta (sin labels ni card propio) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input type="text" placeholder="Buscar nombre, teléfono, dirección..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-10" />
        </div>
        <Select aria-label="Ordenar" value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="w-auto">
          <option value="recent">Recientes</option>
          <option value="urgency">Urgencia</option>
          <option value="name">Nombre A-Z</option>
        </Select>
        <Select aria-label="Etapa" value={filterStage} onChange={e => setFilterStage(e.target.value)} className="w-auto">
          <option value="">Etapa: todas</option>
          {stages.keys.map(s => <option key={s} value={s}>{stages.config[s].label}</option>)}
        </Select>
        <Select aria-label="Origen" value={filterSource} onChange={e => setFilterSource(e.target.value)} className="w-auto">
          <option value="">Origen: todos</option>
          {Object.entries(LEAD_SOURCES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Select aria-label="Operación" value={filterOperation} onChange={e => setFilterOperation(e.target.value)} className="w-auto">
          <option value="">Operación: todas</option>
          {Object.entries(OPERATION_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Select aria-label="Agente" value={filterAgent} onChange={e => setFilterAgent(e.target.value)} className="w-auto">
          <option value="">Agente: todos</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setFilterStage(''); setFilterSource(''); setFilterOperation(''); setFilterAgent('') }}
          className="shrink-0 text-gray-500 px-0"
        >
          Limpiar
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3 animate-pulse">{[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-card border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-5 w-28 bg-gray-200 rounded" />
                <div className="h-5 w-20 bg-gray-100 rounded-full" />
              </div>
              <div className="h-5 w-16 bg-gray-100 rounded-full" />
            </div>
            <div className="flex gap-3 mb-2">
              <div className="h-4 w-24 bg-gray-100 rounded" />
              <div className="h-4 w-16 bg-gray-100 rounded" />
              <div className="h-4 w-20 bg-gray-100 rounded" />
            </div>
            <div className="flex gap-1">{[1,2,3,4].map(j => <div key={j} className="w-2 h-2 bg-gray-200 rounded-full" />)}</div>
          </div>
        ))}</div>
      ) : view === 'list' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.length === 0 ? (
            <EmptyState
              className="col-span-2"
              icon={<User className="w-7 h-7" />}
              title="Sin leads"
              description="Creá tu primer lead para comenzar"
              action={<Button onClick={() => setShowCreate(true)}>Crear primer lead</Button>}
            />
          ) : filtered.map(lead => <LeadCard key={lead.id} lead={lead} onAdvance={() => advanceStage(lead)} onLost={() => markLost(lead.id)} onDelete={() => deleteLead(lead.id, lead.full_name)} onRefresh={loadLeads} />)}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={e => setActiveDragId(e.active.id as string)} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDragId(null)}>
        <div className="overflow-x-auto pb-4 -mx-2 px-2">
          <div className="flex gap-3" style={{ minWidth: `${stages.pipelineStages.length * 300}px` }}>
            {stages.pipelineStages.map(stage => {
              const stageLeads = filtered.filter(l => l.stage === stage)
              const hasOverdue = stageLeads.some(l => getLeadUrgency(l) === 'danger')
              return (
                <DroppableColumn key={stage} id={stage}>
                  <div className="flex items-center justify-between mb-2 px-3 py-2 rounded-control bg-white">
                    <span className="flex items-center gap-2 text-sm font-medium text-ink">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stages.config[stage].dot }} aria-hidden />
                      {stages.config[stage].label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {hasOverdue && <AlertTriangle className="w-3 h-3 text-red-500" />}
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${stages.config[stage].color}`}>{stageLeads.length}</span>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {stageLeads.map(lead => <DraggableKanbanCard key={lead.id} lead={lead} onAdvance={() => advanceStage(lead)} onMoveTo={(s) => moveToStage(lead.id, s)} isDragging={activeDragId === lead.id} />)}
                  </div>
                </DroppableColumn>
              )
            })}
          </div>
          {(() => {
            const perdidos = leads.filter(l => l.stage === 'perdido').length
            const invalidos = leads.filter(l => l.stage === 'invalido').length
            const finalizados = pipeline === 'vendedor' ? leads.filter(l => l.stage === 'finalizado').length : 0
            const total = perdidos + invalidos + finalizados
            if (total === 0) return null
            const parts: string[] = []
            if (perdidos) parts.push(`Perdidos: ${perdidos}`)
            if (invalidos) parts.push(`Inválidos: ${invalidos}`)
            if (finalizados) parts.push(`Finalizados: ${finalizados}`)
            return (
              <div className="mt-4 p-3 bg-gray-50 rounded-card">
                <Text size="xs" tone="muted" weight="medium">{parts.join(' · ')}</Text>
              </div>
            )
          })()}
        </div>
        <DragOverlay>
          {activeDragId ? (() => {
            const lead = leads.find(l => l.id === activeDragId)
            return lead ? <div className="bg-white rounded-card shadow-pop border-2 border-primary p-3 w-60 opacity-90">
              <p className="text-sm font-medium text-ink truncate">{lead.full_name}</p>
              <p className="text-[10px] text-gray-400 truncate">{lead.operation}{lead.property_address ? ` · ${lead.property_address}` : lead.neighborhood ? ` · ${lead.neighborhood}` : ''}</p>
            </div> : null
          })() : null}
        </DragOverlay>
        </DndContext>
      )}

      {/* CREATE MODAL */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={closeCreateModal}
        >
          <div
            className="bg-white w-full sm:max-w-lg sm:rounded-card rounded-t-card max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between rounded-t-card z-10">
              <div>
                <Heading level={4} as="h3">Nuevo lead</Heading>
                <p className="text-xs text-gray-400">
                  {createStep === 1 ? 'Paso 1 de 2 — Contacto' : 'Paso 2 de 2 — Pipeline'}
                </p>
              </div>
              <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={closeCreateModal}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* PASO 1: Contacto */}
            {createStep === 1 && (
              <div className="p-4 space-y-3">
                {selectedContact ? (
                  <Alert
                    tone="success"
                    className="p-3"
                    onDismiss={() => { setSelectedContact(null); setContactSearch('') }}
                    dismissLabel="Quitar contacto seleccionado"
                  >
                    <span className="font-medium text-ink">{selectedContact.full_name}</span>
                    <span className="text-gray-500"> · </span>
                    <span className="text-gray-500 capitalize">{selectedContact.contact_type}</span>
                  </Alert>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Buscar por nombre, teléfono o email..."
                        value={contactSearch}
                        onChange={e => { setContactSearch(e.target.value); setShowNewContactForm(false) }}
                        className="pl-9"
                        autoFocus
                      />
                    </div>

                    {contactResults.length > 0 && !showNewContactForm && (
                      <div className="border rounded-control overflow-hidden">
                        {contactResults.map(ct => (
                          <button
                            key={ct.id}
                            onClick={() => { setSelectedContact(ct); setContactSearch(''); setContactResults([]) }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left border-b last:border-b-0"
                          >
                            <User className="w-4 h-4 text-gray-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ink truncate">{ct.full_name}</p>
                              <p className="text-xs text-gray-500 truncate">{[ct.phone, ct.contact_type].filter(Boolean).join(' · ')}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {showNewContactForm ? (
                      <div className="border rounded-card p-3 space-y-2 bg-gray-50">
                        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Nuevo contacto</p>
                        <Input
                          placeholder="Nombre completo *"
                          value={contactForm.full_name}
                          onChange={e => setContactForm({ ...contactForm, full_name: e.target.value })}
                          autoFocus
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Teléfono"
                            value={contactForm.phone}
                            onChange={e => setContactForm({ ...contactForm, phone: e.target.value })}
                          />
                          <Input
                            placeholder="Email"
                            type="email"
                            value={contactForm.email}
                            onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                          />
                        </div>
                        <Select
                          value={contactForm.contact_type}
                          onChange={e => setContactForm({ ...contactForm, contact_type: e.target.value })}
                        >
                          <option value="propietario">Propietario</option>
                          <option value="comprador">Comprador</option>
                          <option value="inversor">Inversor</option>
                          <option value="inquilino">Inquilino</option>
                          <option value="otro">Otro</option>
                        </Select>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        fullWidth
                        onClick={() => { setShowNewContactForm(true); setContactSearch(''); setContactResults([]) }}
                        className="justify-start px-1"
                      >
                        + Crear contacto nuevo
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* PASO 2: Pipeline */}
            {createStep === 2 && (
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                    {Object.entries(LEAD_SOURCES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </Select>
                  <Select value={form.operation} onChange={e => setForm({ ...form, operation: e.target.value })}>
                    {Object.entries(OPERATION_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </Select>
                  {pipeline === 'comprador' ? (
                    <>
                      <Input placeholder="Zona de interés" value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} />
                      <Input placeholder="Presupuesto (ej: hasta 150.000 USD)" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} />
                    </>
                  ) : (
                    <>
                      <Input placeholder="Barrio/Zona" value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} />
                      <Input placeholder="Dirección propiedad" value={form.property_address} onChange={e => setForm({ ...form, property_address: e.target.value })} />
                      <Input placeholder="Valor estimado (USD)" type="number" value={form.estimated_value} onChange={e => setForm({ ...form, estimated_value: e.target.value })} />
                    </>
                  )}
                  {agents.length > 0 && (
                    <Select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}>
                      <option value="">Asignar agente...</option>
                      {agents.map((a: any) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                    </Select>
                  )}
                </div>
                <Input placeholder="Próxima acción" value={form.next_step} onChange={e => setForm({ ...form, next_step: e.target.value })} />
                <Input type="date" value={form.next_step_date} onChange={e => setForm({ ...form, next_step_date: e.target.value })} />
                <Textarea placeholder="Notas" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="min-h-0" />
              </div>
            )}

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t px-4 py-3 flex gap-2">
              {createStep === 1 ? (
                <>
                  <Button variant="outline" className="flex-1" onClick={closeCreateModal}>Cancelar</Button>
                  <Button
                    className="flex-1"
                    onClick={() => setCreateStep(2)}
                    disabled={!canProceedStep1}
                  >
                    Siguiente <ChevronRight className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" className="flex-1" onClick={() => setCreateStep(1)}>← Atrás</Button>
                  <Button
                    className="flex-1"
                    onClick={handleCreate}
                    loading={saving}
                  >
                    {saving ? 'Guardando...' : 'Crear lead'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONVERT TO APPRAISAL MODAL */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowConvertModal(null)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-card rounded-t-card p-5" onClick={e => e.stopPropagation()}>
            <Heading level={4} as="h3" className="mb-2">Avanzar a tasación</Heading>
            <Text tone="muted" className="mb-4">
              <strong>{showConvertModal.full_name}</strong> pasará a &ldquo;En tasación&rdquo;. ¿Querés crear una tasación vinculada?
            </Text>
            <div className="space-y-2">
              <Button size="lg" fullWidth onClick={() => handleConvertToAppraisal(showConvertModal, true)}>
                Sí, crear tasación vinculada
              </Button>
              <Button size="lg" variant="outline" fullWidth onClick={() => handleConvertToAppraisal(showConvertModal, false)}>
                Solo avanzar etapa
              </Button>
              <Button variant="ghost" fullWidth className="text-gray-400" onClick={() => setShowConvertModal(null)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}
      {/* AI Panel */}
      {showAI && (
        <AIChatPanel
          context={{ module: 'leads' }}
          onClose={() => { setShowAI(false); loadLeads() }}
        />
      )}
    </div>
  )
}

// ── helpers LeadCard ──
// ── LeadCard (List view) ──
/**
 * La card de lead termina en una barra de acciones a sangre: celdas iguales,
 * separadas por un divide, cada una ocupando lo mismo. `CallButton` y
 * `WhatsAppButton` ya vivían ahí con este override; el resto eran `<button>` a
 * mano con la cadena repetida. La clase se define una vez para las dos barras
 * (la de íconos en mobile y la de texto en desktop).
 *
 * `p-0`/`px-0` no es cosmético: el padding de `Button` cuenta para el ancho
 * mínimo del flex, así que sin esto las celdas de texto quedaban 32px más anchas
 * que las de `CallButton`/`WhatsAppButton` y la barra dejaba de estar repartida
 * en partes iguales. Medido.
 */
const CELDA_ICONO = 'flex-1 w-12 rounded-none border-t border-gray-100 p-0 text-gray-500'
const CELDA_TEXTO = 'flex-1 rounded-none px-0 py-2.5 text-xs font-medium text-gray-600'

function LeadCard({ lead, onAdvance, onLost, onDelete, onRefresh }: { lead: any; onAdvance: () => void; onLost: () => void; onDelete: () => void; onRefresh: () => void }) {
  const urgency = getLeadUrgency(lead)
  const lastActivity = lead.last_activity_at ? timeAgo(lead.last_activity_at) : null
  const hasAppraisal = lead.appraisal_count > 0
  const urg = getUrgencyBadge(lead)
  // Sin borde de color por urgencia: la señal va como badge (urg), no en el
  // contorno de la card. Sólo danger conserva un borde rojo suave.

  const [showTagPicker, setShowTagPicker] = useState(false)
  const [orgTags, setOrgTags] = useState<any[]>([])
  const [tagsLoading, setTagsLoading] = useState(false)

  const openTagPicker = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (orgTags.length === 0 && !tagsLoading) {
      setTagsLoading(true)
      try {
        const data = (await (await apiFetch('crm', '/tags')).json()) as any
        setOrgTags(Array.isArray(data) ? data : [])
      } catch {}
      setTagsLoading(false)
    }
    setShowTagPicker(v => !v)
  }

  const addTag = async (tagId: string) => {
    try {
      await apiFetch('crm', '/lead-tags', { method: 'POST', body: JSON.stringify({ lead_id: lead.id, tag_id: tagId }) })
      setShowTagPicker(false); onRefresh()
    } catch {}
  }

  const removeTag = async (tagId: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    try {
      await apiFetch('crm', `/lead-tags?lead_id=${lead.id}&tag_id=${tagId}`, { method: 'DELETE' })
      onRefresh()
    } catch {}
  }

  const availableTags = orgTags.filter(t => !lead.tags?.some((lt: any) => lt.id === t.id))

  return (
    <div className="relative bg-white border border-gray-200 rounded-card shadow-card overflow-hidden flex flex-col transition-shadow hover:shadow-md">
      {/* Tag picker dropdown */}
      {showTagPicker && (
        <>
          <div className="fixed inset-0 z-[9]" onClick={() => setShowTagPicker(false)} />
          <div className="absolute bottom-12 sm:bottom-10 left-2 right-2 z-10 bg-white border border-gray-200 rounded-card shadow-pop p-2">
            {tagsLoading ? (
              <div className="flex items-center gap-2 px-2 py-2 text-xs text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando...
              </div>
            ) : availableTags.length === 0 ? (
              <p className="text-xs text-gray-400 px-2 py-2">No hay más etiquetas disponibles</p>
            ) : (
              availableTags.map(tag => (
                <button key={tag.id} onClick={() => addTag(tag.id)}
                  className="w-full text-left flex items-center gap-2.5 px-2 py-1.5 rounded-control hover:bg-gray-50 text-sm text-gray-700">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: tag.color }} />
                  {tag.name}
                </button>
              ))
            )}
          </div>
        </>
      )}
      {/* Card body: en mobile es row (contenido + acciones icono), en desktop es solo contenido */}
      <div className="flex flex-1 min-w-0">
        {/* Main content — clickable */}
        {/* gap-2.5 y no 1.5: con cuatro filas de texto (nombre+badges, teléfono,
            dirección, agente) a 6px de separación la card se leía como un bloque
            apretado. */}
        <Link href={`/leads/${lead.id}`} className="flex-1 min-w-0 px-5 py-4 flex flex-col gap-2.5">
          {/* Row 1: name + stage + tags (izq.) · urgencia (der., como en el kanban) */}
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-sm text-ink truncate">{lead.full_name}</span>
                <StageBadge stage={lead.stage} pipeline={lead.pipeline} size="sm" className="shrink-0 px-2 font-semibold" />
                {lead.tags?.map((tag: any) => (
                  <button key={tag.id} onClick={(e) => removeTag(tag.id, e)}
                    className="group inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tag.color }} />
                    {tag.name}
                    <X className="w-2 h-2 opacity-0 group-hover:opacity-60 transition-opacity" />
                  </button>
                ))}
                {hasAppraisal && (
                  <StatusBadge
                    size="sm"
                    label={LEAD_FLAGS.tasacion.label}
                    color={LEAD_FLAGS.tasacion.color}
                    icon={<Check className="w-2.5 h-2.5" />}
                    className="shrink-0"
                  />
                )}
              </div>
              <p className="text-xs text-gray-500 truncate mt-1">
                {lead.phone && <span className="text-gray-600">{lead.phone}</span>}
                {lead.phone && lead.operation && <span className="text-gray-300 mx-1">·</span>}
                {lead.operation && <span className="capitalize">{lead.operation}</span>}
              </p>
            </div>
            {urg && <StatusBadge label={urg.text} color={urg.color} className="shrink-0" />}
          </div>

          {/* Dirección de la propiedad — visible de un vistazo */}
          {(lead.property_address || lead.neighborhood) && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 min-w-0">
              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="truncate">{lead.property_address || lead.neighborhood}</span>
            </div>
          )}

          {/* Row 2: agent + activity */}
          <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
            {lead.assigned_name && <span>{lead.assigned_name}</span>}
            {lastActivity && <><span className="text-gray-200">·</span><span>Últ: {lastActivity}</span></>}
          </div>

          {/* Next step band */}
          {lead.next_step && (
            <div className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-control ${urgency === 'danger' ? 'bg-red-50 text-red-600' : urgency === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-primary/5 text-primary'}`}>
              <ArrowRight className="w-3 h-3 shrink-0" />
              <span className="truncate">{lead.next_step}</span>
              {lead.next_step_date && <span className="shrink-0 text-[10px] opacity-70">· {lead.next_step_date}</span>}
            </div>
          )}
        </Link>

        {/* MOBILE: botones icono en columna derecha */}
        <div className="flex sm:hidden flex-col border-l border-gray-100 shrink-0" onClick={e => e.stopPropagation()}>
          {lead.phone ? (
            <>
              <CallButton phone={lead.phone} iconOnly
                className="flex-1 w-12 h-auto rounded-none bg-transparent text-gray-500 hover:bg-gray-50 active:bg-gray-100 hover:opacity-100 transition-colors" />
              <WhatsAppButton phone={lead.phone} iconOnly templateContext={{ name: lead.full_name, address: lead.property_address || lead.neighborhood }}
                className="flex-1 w-12 h-auto rounded-none bg-transparent text-gray-500 hover:bg-gray-50 active:bg-gray-100 border-t border-gray-100 hover:opacity-100 transition-colors" />
            </>
          ) : (
            <div className="flex-1 w-12 flex items-center justify-center text-gray-200">
              <Phone className="w-5 h-5" />
            </div>
          )}
          {!isAgentFinalStage(lead) && (
            <Button variant="ghost" onClick={onAdvance} aria-label="Avanzar de etapa" className={CELDA_ICONO}>
              <ArrowRight className="w-5 h-5" />
            </Button>
          )}
          <Button variant="ghost" onClick={openTagPicker} aria-label="Etiquetar" className={CELDA_ICONO}>
            <Tag className="w-4 h-4" />
          </Button>
          <Button variant="ghost" onClick={onDelete} aria-label="Eliminar lead" className={`${CELDA_ICONO} text-gray-300 hover:text-danger hover:bg-danger/10`}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* DESKTOP: botones con texto en fila inferior */}
      <div className="hidden sm:flex border-t border-gray-100 divide-x divide-gray-100" onClick={e => e.stopPropagation()}>
        {lead.phone ? (
          <>
            <CallButton phone={lead.phone}
              className="flex-1 rounded-none bg-transparent text-gray-600 text-xs px-0 py-2.5 hover:bg-gray-50 hover:opacity-100 transition-colors" />
            <WhatsAppButton phone={lead.phone} templateContext={{ name: lead.full_name, address: lead.property_address || lead.neighborhood }}
              className="flex-1 rounded-none bg-transparent text-gray-600 text-xs px-0 py-2.5 hover:bg-gray-50 hover:opacity-100 transition-colors" />
          </>
        ) : (
          <span className="flex-1 flex items-center justify-center py-2.5 text-xs text-gray-300">Sin teléfono</span>
        )}
        {!isAgentFinalStage(lead) && (
          <Button variant="ghost" onClick={onAdvance} icon={<ArrowRight className="w-3.5 h-3.5" />} className={CELDA_TEXTO}>
            Avanzar
          </Button>
        )}
        <Button variant="ghost" onClick={openTagPicker} icon={<Tag className="w-3.5 h-3.5" />} className={CELDA_TEXTO}>
          Etiquetar
        </Button>
        <Button variant="ghost" onClick={onDelete} aria-label="Eliminar lead" className="shrink-0 rounded-none px-4 text-gray-300 hover:text-danger hover:bg-danger/10">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ── KanbanCard ──
function KanbanCard({ lead, onAdvance, onMoveTo }: { lead: any; onAdvance: () => void; onMoveTo: (stage: string) => void }) {
  const badge = getUrgencyBadge(lead)
  const checklist = getLeadChecklist(lead)
  const [showMove, setShowMove] = useState(false)

  return (
    <div className="bg-white border border-gray-200 rounded-card shadow-card pt-3 pr-3 pb-3 pl-7 hover:shadow-md transition-all relative">
      <Link href={`/leads/${lead.id}`}>
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-medium text-ink truncate">{lead.full_name}</h4>
          {badge && <StatusBadge label={badge.text} color={badge.color} size="sm" className="shrink-0" />}
        </div>
        {lead.tags?.length > 0 && (
          <div className="flex gap-1 mb-1">
            {lead.tags.map((tag: any) => (
              <span key={tag.id} className="text-[9px] px-1.5 py-0.5 rounded-full text-white font-medium" style={{ background: tag.color }}>{tag.name}</span>
            ))}
          </div>
        )}
        <div className="space-y-1 text-xs text-gray-500">
          {(lead.property_address || lead.neighborhood) && (
            <p className="flex items-center gap-1 font-medium text-gray-700 min-w-0"><MapPin className="w-3 h-3 text-primary shrink-0" /><span className="truncate">{lead.property_address || lead.neighborhood}</span></p>
          )}
          {lead.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</p>}
          {lead.operation && <p className="capitalize">{lead.operation}</p>}
          {lead.next_step && <p className="text-gray-500 truncate">→ {lead.next_step}</p>}
        </div>
      </Link>
      <div className="flex items-center justify-between mt-2">
        <div className="flex gap-0.5">{Object.entries(checklist).map(([k, v]) => <div key={k} className={`w-1.5 h-1.5 rounded-full ${v ? 'bg-green-500' : 'bg-gray-200'}`} />)}</div>
        <div className="flex gap-1">
          {lead.phone && (
            <WhatsAppButton phone={lead.phone} iconOnly templateContext={{ name: lead.full_name, address: lead.property_address || lead.neighborhood }}
              className="w-7 h-7 rounded-control bg-transparent text-whatsapp hover:bg-success/10 hover:opacity-100" />
          )}
          <Button variant="ghost" size="icon" onClick={() => setShowMove(!showMove)} aria-label="Mover a otra etapa" className="p-1 text-gray-400">
            <ChevronDown className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onAdvance} aria-label="Avanzar de etapa" className="p-1 text-primary hover:bg-primary/10">
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      {/* Move to dropdown */}
      {showMove && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowMove(false)} />
          <div className="absolute right-2 top-full mt-1 z-20 bg-white border rounded-control shadow-pop py-1 min-w-[140px] max-h-60 overflow-y-auto">
            {(() => {
              const leadStages = getStagesForPipeline(lead.pipeline === 'comprador' ? 'comprador' : 'vendedor')
              return leadStages.keys.filter(s => s !== lead.stage).map(s => (
                <button key={s} onClick={() => { onMoveTo(s); setShowMove(false) }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${leadStages.config[s].color.split(' ')[0]}`} />
                  {leadStages.config[s].label}
                </button>
              ))
            })()}
          </div>
        </>
      )}
    </div>
  )
}

// ── Droppable Column ──
function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver: dropping } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`w-72 shrink-0 transition-colors rounded-card p-2 ${dropping ? 'bg-primary/5 ring-2 ring-primary/30' : ''}`}>
      {children}
    </div>
  )
}

// ── Draggable KanbanCard wrapper ──
function DraggableKanbanCard({ lead, onAdvance, onMoveTo, isDragging }: { lead: any; onAdvance: () => void; onMoveTo: (s: string) => void; isDragging: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: lead.id })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
  return (
    <div ref={setNodeRef} style={style} className={`relative ${isDragging ? 'opacity-30' : ''}`}>
      <div {...attributes} {...listeners} className="absolute top-2 left-1 cursor-grab active:cursor-grabbing z-10 p-1 text-gray-300 hover:text-gray-500">
        <GripVertical className="w-3 h-3" />
      </div>
      <KanbanCard lead={lead} onAdvance={onAdvance} onMoveTo={onMoveTo} />
    </div>
  )
}
