'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Plus, Search, Phone, MessageCircle, Filter, X, LayoutList, Columns3,
  AlertTriangle, Clock, User, MapPin, DollarSign, ArrowRight, ChevronDown, Download, Sparkles, Trash2, GripVertical,
  ChevronRight, Check
} from 'lucide-react'
import {
  LEAD_STAGES, LEAD_STAGE_KEYS, LEAD_PIPELINE_STAGES, LEAD_SOURCES,
  OPERATION_TYPES, getLeadChecklist, getLeadChecklistScore,
  getLeadUrgency, getUrgencyBadge, formatWhatsApp, type LeadStage
} from '@/lib/crm-config'
import type { Lead, Contact } from '@/lib/types'
import { useToast } from '@/components/ui/Toast'
import AIChatPanel from '@/components/ai/AIChatPanel'
import { apiFetch } from '@/lib/api'
import { DndContext, DragOverlay, useDraggable, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'

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
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState<string>(searchParams.get('stage') || '')
  const [filterSource, setFilterSource] = useState('')
  const [filterOperation, setFilterOperation] = useState('')
  const [filterAgent, setFilterAgent] = useState('')
  const [agents, setAgents] = useState<any[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const sortParam = searchParams.get('sort')
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'urgency'>(
    (['recent', 'name', 'urgency'] as const).includes(sortParam as any) ? sortParam as 'recent' | 'name' | 'urgency' : 'recent'
  )
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
    full_name: '', phone: '', email: '', contact_type: 'propietario'
  })
  const contactSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [form, setForm] = useState({
    source: 'manual', source_detail: '',
    property_address: '', neighborhood: '', operation: 'venta',
    notes: '', estimated_value: '', assigned_to: '', next_step: '', next_step_date: ''
  })

  const loadLeads = () => {
    apiFetch('crm', '/leads')
      .then(r => r.json() as Promise<any>)
      .then(d => { setLeads(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    loadLeads()
    apiFetch('admin', '/agents').then(r => r.json() as Promise<any>).then(d => { if (Array.isArray(d)) setAgents(d) }).catch(() => {})
  }, [])

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

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    LEAD_STAGE_KEYS.forEach(s => { counts[s] = 0 })
    leads.forEach(l => { if (counts[l.stage] !== undefined) counts[l.stage]++ })
    return counts
  }, [leads])

  const closeCreateModal = () => {
    setShowCreate(false)
    setCreateStep(1)
    setContactSearch('')
    setContactResults([])
    setSelectedContact(null)
    setShowNewContactForm(false)
    setContactForm({ full_name: '', phone: '', email: '', contact_type: 'propietario' })
    setForm({
      source: 'manual', source_detail: '', property_address: '', neighborhood: '',
      operation: 'venta', notes: '', estimated_value: '', assigned_to: '',
      next_step: '', next_step_date: ''
    })
  }

  const handleCreate = async () => {
    setSaving(true)
    try {
      const payload: any = { ...form }

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
    const currentIdx = (LEAD_PIPELINE_STAGES as readonly string[]).indexOf(lead.stage)
    if (currentIdx < 0 || currentIdx >= LEAD_PIPELINE_STAGES.length - 1) return
    const nextStage = LEAD_PIPELINE_STAGES[currentIdx + 1]

    // en_tasacion → show convert modal
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
      const stageLabel = LEAD_STAGES[nextStage as LeadStage]?.label || nextStage
      toast(`${lead.full_name} → ${stageLabel}`)
      if (result.autoFollowup) {
        toast(`Seguimiento automático creado para ${result.autoFollowup.date}`)
      }
      loadLeads()
    } catch { toast('Error al cambiar etapa', 'error') }
  }

  const handleConvertToAppraisal = async (lead: any, createAppraisal: boolean) => {
    try {
      await apiFetch('crm', '/leads/stage', {
        method: 'POST',
        body: JSON.stringify({ id: lead.id, stage: 'en_tasacion' })
      })
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
    if (stage === 'en_tasacion') {
      const lead = leads.find(l => l.id === leadId)
      if (lead) { setShowConvertModal(lead); return }
    }
    try {
      if (stage === 'perdido') {
        const reason = prompt('¿Por qué se pierde este lead?')
        if (reason === null) return
        await apiFetch('crm', '/leads/stage', {
          method: 'POST',
          body: JSON.stringify({ id: leadId, stage: 'perdido', notes: reason || 'Sin motivo' })
        })
        toast('Lead marcado como perdido', 'warning')
      } else {
        await apiFetch('crm', '/leads/stage', {
          method: 'POST',
          body: JSON.stringify({ id: leadId, stage })
        })
        const stageLabel = LEAD_STAGES[stage as LeadStage]?.label || stage
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
    const reason = prompt('¿Por qué se pierde este lead?\n\nEj: No responde, presupuesto fuera de rango, eligió otra inmobiliaria, etc.')
    if (reason === null) return // cancelled
    try {
      await apiFetch('crm', '/leads/stage', {
        method: 'POST',
        body: JSON.stringify({ id: leadId, stage: 'perdido', notes: reason || 'Sin motivo especificado' })
      })
      toast('Lead marcado como perdido', 'warning')
      loadLeads()
    } catch { toast('Error al marcar como perdido', 'error') }
  }

  const deleteLead = async (leadId: string, leadName: string) => {
    if (!confirm(`¿Eliminar "${leadName}" permanentemente?\n\nEsta acción no se puede deshacer.`)) return
    try {
      await apiFetch('crm', `/leads?id=${leadId}`, { method: 'DELETE' })
      toast('Lead eliminado', 'warning')
      loadLeads()
    } catch { toast('Error al eliminar', 'error') }
  }

  const activeFilters = [filterStage, filterSource, filterOperation, filterAgent].filter(Boolean).length

  const canProceedStep1 = selectedContact !== null ||
    (showNewContactForm && contactForm.full_name.trim().length >= 2)

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Leads</h1>
          <p className="text-gray-500 text-sm">{leads.length} lead{leads.length !== 1 ? 's' : ''} en el pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setView('list')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'list' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
              <LayoutList className="w-4 h-4" />
            </button>
            <button onClick={() => setView('kanban')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'kanban' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
              <Columns3 className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => {
              const rows = [
                ['Nombre', 'Teléfono', 'Email', 'Operación', 'Etapa', 'Barrio', 'Valor USD', 'Agente', 'Próximo paso', 'Creado'],
                ...filtered.map(l => [
                  l.full_name, l.phone || '', l.email || '', l.operation || '',
                  LEAD_STAGES[l.stage as LeadStage]?.label || l.stage,
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
            className="hidden sm:flex items-center gap-1 text-xs text-gray-500 border border-gray-200 px-2.5 py-2 rounded-lg hover:border-gray-400"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={() => setShowAI(true)} className="border border-[#ff007c]/30 text-[#ff007c] px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 hover:bg-[#ff007c]/5">
            <Sparkles className="w-4 h-4" /> <span className="hidden sm:inline">con IA</span>
          </button>
          <button onClick={() => setShowCreate(true)} className="bg-pink-600 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 hover:bg-pink-700">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nuevo lead</span><span className="sm:hidden">Nuevo</span>
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Buscar nombre, teléfono, dirección..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500" />
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="border rounded-lg px-2 py-2 text-sm text-gray-600">
          <option value="recent">Recientes</option>
          <option value="urgency">Urgencia</option>
          <option value="name">Nombre A-Z</option>
        </select>
        <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm ${activeFilters > 0 ? 'border-pink-500 text-pink-600 bg-pink-50' : 'text-gray-600'}`}>
          <Filter className="w-4 h-4" /> Filtros {activeFilters > 0 && <span className="bg-pink-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{activeFilters}</span>}
        </button>
      </div>

      {showFilters && (
        <div className="bg-gray-50 border rounded-xl p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Etapa</label>
            <select value={filterStage} onChange={e => setFilterStage(e.target.value)} className="w-full border rounded-lg px-2 py-1.5 text-sm">
              <option value="">Todas</option>
              {LEAD_STAGE_KEYS.map(s => <option key={s} value={s}>{LEAD_STAGES[s].label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Origen</label>
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="w-full border rounded-lg px-2 py-1.5 text-sm">
              <option value="">Todos</option>
              {Object.entries(LEAD_SOURCES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Operación</label>
            <select value={filterOperation} onChange={e => setFilterOperation(e.target.value)} className="w-full border rounded-lg px-2 py-1.5 text-sm">
              <option value="">Todas</option>
              {Object.entries(OPERATION_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 font-medium mb-1 block">Agente</label>
            <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)} className="w-full border rounded-lg px-2 py-1.5 text-sm">
              <option value="">Todos</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => { setFilterStage(''); setFilterSource(''); setFilterOperation(''); setFilterAgent('') }} className="text-xs text-gray-500 hover:text-pink-600">Limpiar filtros</button>
          </div>
        </div>
      )}

      {/* Stage pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        <button onClick={() => setFilterStage('')} className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!filterStage ? 'bg-gray-800 text-white border-gray-800' : 'text-gray-600 border-gray-200 hover:border-gray-400'}`}>
          Todos ({leads.length})
        </button>
        {LEAD_STAGE_KEYS.map(s => (
          <button key={s} onClick={() => setFilterStage(filterStage === s ? '' : s)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filterStage === s ? 'bg-gray-800 text-white border-gray-800' : `${LEAD_STAGES[s].color} border-transparent`}`}>
            {LEAD_STAGES[s].label} ({stageCounts[s]})
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3 animate-pulse">{[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
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
            <div className="col-span-2 text-center py-12 text-gray-400">
              <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Sin leads</p>
              <p className="text-sm mt-1">Creá tu primer lead para comenzar</p>
              <button onClick={() => setShowCreate(true)} className="mt-3 px-4 py-2 bg-[#ff007c] text-white rounded-lg text-sm font-medium hover:opacity-90">
                Crear primer lead
              </button>
            </div>
          ) : filtered.map(lead => <LeadCard key={lead.id} lead={lead} onAdvance={() => advanceStage(lead)} onLost={() => markLost(lead.id)} onDelete={() => deleteLead(lead.id, lead.full_name)} />)}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={e => setActiveDragId(e.active.id as string)} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDragId(null)}>
        <div className="overflow-x-auto pb-4 -mx-2 px-2">
          <div className="flex gap-3" style={{ minWidth: `${LEAD_PIPELINE_STAGES.length * 260}px` }}>
            {LEAD_PIPELINE_STAGES.map(stage => {
              const stageLeads = filtered.filter(l => l.stage === stage)
              const hasOverdue = stageLeads.some(l => getLeadUrgency(l) === 'danger')
              return (
                <DroppableColumn key={stage} id={stage}>
                  <div className={`flex items-center justify-between mb-2 px-2 py-1.5 rounded-lg ${LEAD_STAGES[stage].color}`}>
                    <span className="text-xs font-semibold">{LEAD_STAGES[stage].label}</span>
                    <div className="flex items-center gap-1">
                      {hasOverdue && <AlertTriangle className="w-3 h-3 text-red-500" />}
                      <span className="text-xs font-bold">{stageLeads.length}</span>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {stageLeads.map(lead => <DraggableKanbanCard key={lead.id} lead={lead} onAdvance={() => advanceStage(lead)} onMoveTo={(s) => moveToStage(lead.id, s)} isDragging={activeDragId === lead.id} />)}
                  </div>
                </DroppableColumn>
              )
            })}
          </div>
          {leads.filter(l => l.stage === 'perdido').length > 0 && (
            <div className="mt-4 p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 font-medium">Perdidos: {leads.filter(l => l.stage === 'perdido').length}</p>
            </div>
          )}
        </div>
        <DragOverlay>
          {activeDragId ? (() => {
            const lead = leads.find(l => l.id === activeDragId)
            return lead ? <div className="bg-white rounded-lg shadow-xl border-2 border-[#ff007c] p-3 w-60 opacity-90">
              <p className="text-sm font-medium text-gray-800 truncate">{lead.full_name}</p>
              <p className="text-[10px] text-gray-400">{lead.operation} · {lead.neighborhood}</p>
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
            className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between rounded-t-2xl z-10">
              <div>
                <h3 className="font-semibold text-gray-800">Nuevo lead</h3>
                <p className="text-xs text-gray-400">
                  {createStep === 1 ? 'Paso 1 de 2 — Contacto' : 'Paso 2 de 2 — Pipeline'}
                </p>
              </div>
              <button onClick={closeCreateModal} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            {/* PASO 1: Contacto */}
            {createStep === 1 && (
              <div className="p-4 space-y-3">
                {selectedContact ? (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-600 shrink-0" />
                      <span className="font-medium text-gray-800">{selectedContact.full_name}</span>
                      <span className="text-gray-500">·</span>
                      <span className="text-gray-500 capitalize">{selectedContact.contact_type}</span>
                    </div>
                    <button onClick={() => { setSelectedContact(null); setContactSearch('') }} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar por nombre, teléfono o email..."
                        value={contactSearch}
                        onChange={e => { setContactSearch(e.target.value); setShowNewContactForm(false) }}
                        className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/30 focus:border-[#ff007c]"
                        autoFocus
                      />
                    </div>

                    {contactResults.length > 0 && !showNewContactForm && (
                      <div className="border rounded-lg overflow-hidden">
                        {contactResults.map(ct => (
                          <button
                            key={ct.id}
                            onClick={() => { setSelectedContact(ct); setContactSearch(''); setContactResults([]) }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left border-b last:border-b-0"
                          >
                            <User className="w-4 h-4 text-gray-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{ct.full_name}</p>
                              <p className="text-xs text-gray-500 truncate">{[ct.phone, ct.contact_type].filter(Boolean).join(' · ')}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {showNewContactForm ? (
                      <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
                        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Nuevo contacto</p>
                        <input
                          placeholder="Nombre completo *"
                          value={contactForm.full_name}
                          onChange={e => setContactForm({ ...contactForm, full_name: e.target.value })}
                          className="w-full border rounded-lg px-3 py-2 text-sm"
                          autoFocus
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            placeholder="Teléfono"
                            value={contactForm.phone}
                            onChange={e => setContactForm({ ...contactForm, phone: e.target.value })}
                            className="border rounded-lg px-3 py-2 text-sm"
                          />
                          <input
                            placeholder="Email"
                            type="email"
                            value={contactForm.email}
                            onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                            className="border rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                        <select
                          value={contactForm.contact_type}
                          onChange={e => setContactForm({ ...contactForm, contact_type: e.target.value })}
                          className="w-full border rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="propietario">Propietario</option>
                          <option value="comprador">Comprador</option>
                          <option value="inversor">Inversor</option>
                          <option value="inquilino">Inquilino</option>
                          <option value="otro">Otro</option>
                        </select>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setShowNewContactForm(true); setContactSearch(''); setContactResults([]) }}
                        className="w-full text-sm text-[#ff007c] hover:underline text-left px-1"
                      >
                        + Crear contacto nuevo
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* PASO 2: Pipeline */}
            {createStep === 2 && (
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full">
                    {Object.entries(LEAD_SOURCES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <select value={form.operation} onChange={e => setForm({ ...form, operation: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full">
                    {Object.entries(OPERATION_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <input placeholder="Barrio/Zona" value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
                  <input placeholder="Dirección propiedad" value={form.property_address} onChange={e => setForm({ ...form, property_address: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
                  <input placeholder="Valor estimado (USD)" type="number" value={form.estimated_value} onChange={e => setForm({ ...form, estimated_value: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
                  {agents.length > 0 && (
                    <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full">
                      <option value="">Asignar agente...</option>
                      {agents.map((a: any) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                    </select>
                  )}
                </div>
                <input placeholder="Próxima acción" value={form.next_step} onChange={e => setForm({ ...form, next_step: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
                <input type="date" value={form.next_step_date} onChange={e => setForm({ ...form, next_step_date: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
                <textarea placeholder="Notas" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
              </div>
            )}

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t px-4 py-3 flex gap-2">
              {createStep === 1 ? (
                <>
                  <button onClick={closeCreateModal} className="flex-1 px-4 py-2 border rounded-lg text-sm">Cancelar</button>
                  <button
                    onClick={() => setCreateStep(2)}
                    disabled={!canProceedStep1}
                    className="flex-1 px-4 py-2 bg-[#ff007c] text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    Siguiente <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setCreateStep(1)} className="flex-1 px-4 py-2 border rounded-lg text-sm">← Atrás</button>
                  <button
                    onClick={handleCreate}
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-[#ff007c] text-white rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : 'Crear lead'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONVERT TO APPRAISAL MODAL */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowConvertModal(null)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800 mb-2">Avanzar a tasación</h3>
            <p className="text-sm text-gray-500 mb-4">
              <strong>{showConvertModal.full_name}</strong> pasará a &ldquo;En tasación&rdquo;. ¿Querés crear una tasación vinculada?
            </p>
            <div className="space-y-2">
              <button onClick={() => handleConvertToAppraisal(showConvertModal, true)} className="w-full px-4 py-3 bg-pink-600 text-white rounded-xl text-sm font-medium hover:bg-pink-700">
                Sí, crear tasación vinculada
              </button>
              <button onClick={() => handleConvertToAppraisal(showConvertModal, false)} className="w-full px-4 py-3 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Solo avanzar etapa
              </button>
              <button onClick={() => setShowConvertModal(null)} className="w-full px-4 py-2 text-sm text-gray-400">Cancelar</button>
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
const STAGE_BORDER: Record<string, string> = {
  nuevo: 'border-l-blue-400', asignado: 'border-l-indigo-400', contactado: 'border-l-cyan-400',
  calificado: 'border-l-emerald-400', en_tasacion: 'border-l-purple-400', presentada: 'border-l-pink-500',
  seguimiento: 'border-l-yellow-400', captado: 'border-l-green-500', perdido: 'border-l-red-400',
}
const AVATAR_COLORS = ['bg-pink-400','bg-purple-400','bg-blue-400','bg-emerald-400','bg-orange-400','bg-cyan-500','bg-indigo-400']
function avatarColor(name: string) { return AVATAR_COLORS[(name || 'X').charCodeAt(0) % AVATAR_COLORS.length] }
function urgencyText(lead: any): { text: string; cls: string } | null {
  if (lead.stage === 'perdido') return null
  const diffH = (Date.now() - new Date(lead.updated_at || lead.created_at).getTime()) / 3600000
  const days = Math.floor(diffH / 24)
  if (lead.stage === 'nuevo' && diffH > 24) return { text: 'Sin asignar +24h', cls: 'text-red-500' }
  if (diffH > 168) return { text: `Sin contacto ${days}d`, cls: 'text-red-500' }
  if (diffH > 72) return { text: `Sin contacto ${days}d`, cls: 'text-amber-500' }
  return null
}

// ── LeadCard (List view) ──
function LeadCard({ lead, onAdvance, onLost, onDelete }: { lead: any; onAdvance: () => void; onLost: () => void; onDelete: () => void }) {
  const stage = LEAD_STAGES[lead.stage as LeadStage] || LEAD_STAGES.nuevo
  const urgency = getLeadUrgency(lead)
  const checklist = getLeadChecklist(lead)
  const score = getLeadChecklistScore(lead)
  const lastActivity = lead.last_activity_at ? timeAgo(lead.last_activity_at) : null
  const hasAppraisal = lead.appraisal_count > 0
  const urg = urgencyText(lead)
  const initial = (lead.full_name || '?')[0].toUpperCase()
  const borderColor = STAGE_BORDER[lead.stage] || 'border-l-gray-300'
  const outerBorder = urgency === 'danger' ? 'border-red-200' : urgency === 'warning' ? 'border-yellow-200' : 'border-gray-200'

  return (
    <div className={`bg-white border ${outerBorder} border-l-4 ${borderColor} rounded-xl overflow-hidden flex flex-col transition-shadow hover:shadow-md`}>
      {/* Card body: en mobile es row (contenido + acciones icono), en desktop es solo contenido */}
      <div className="flex flex-1 min-w-0">
        {/* Main content — clickable */}
        <Link href={`/leads/${lead.id}`} className="flex-1 min-w-0 px-4 py-3 flex flex-col gap-1.5">
          {/* Row 1: avatar + name + stage + tags */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-full ${avatarColor(lead.full_name)} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-sm text-gray-900 truncate">{lead.full_name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${stage.color}`}>{stage.label}</span>
                {lead.tags?.map((tag: any) => (
                  <span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 text-white" style={{ background: tag.color }}>{tag.name}</span>
                ))}
                {hasAppraisal && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium shrink-0">Tasación ✓</span>}
              </div>
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {lead.phone && <span className="text-gray-600">{lead.phone}</span>}
                {lead.phone && lead.operation && <span className="text-gray-300 mx-1">·</span>}
                {lead.operation && <span className="capitalize">{lead.operation}</span>}
                {lead.neighborhood && <><span className="text-gray-300 mx-1">·</span><span>{lead.neighborhood}</span></>}
              </p>
            </div>
          </div>

          {/* Row 2: agent + activity + urgency */}
          <div className="flex items-center gap-2 text-[11px] text-gray-400 flex-wrap pl-10">
            {lead.assigned_name && <span>{lead.assigned_name}</span>}
            {lastActivity && <><span className="text-gray-200">·</span><span>Últ: {lastActivity}</span></>}
            {urg && <><span className="text-gray-200">·</span><span className={`font-medium ${urg.cls}`}>{urg.text}</span></>}
          </div>

          {/* Next step band */}
          {lead.next_step && (
            <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg mt-0.5 ${urgency === 'danger' ? 'bg-red-50 text-red-600' : urgency === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-pink-50 text-[#ff007c]'}`}>
              <ArrowRight className="w-3 h-3 shrink-0" />
              <span className="truncate">{lead.next_step}</span>
              {lead.next_step_date && <span className="shrink-0 text-[10px] opacity-70">· {lead.next_step_date}</span>}
            </div>
          )}

          {/* Progress bar */}
          <div className="flex items-center gap-2 pl-10">
            <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${score >= 83 ? 'bg-emerald-400' : score >= 50 ? 'bg-yellow-400' : 'bg-red-300'}`} style={{ width: `${score}%` }} />
            </div>
            <span className="text-[10px] text-gray-300 shrink-0">{Object.values(checklist).filter(Boolean).length}/6</span>
          </div>
        </Link>

        {/* MOBILE: botones icono en columna derecha */}
        <div className="flex sm:hidden flex-col border-l border-gray-100 shrink-0" onClick={e => e.stopPropagation()}>
          {lead.phone ? (
            <>
              <a href={`tel:${lead.phone}`} className="flex-1 w-12 flex items-center justify-center text-blue-400 hover:bg-blue-50 active:bg-blue-100 transition-colors">
                <Phone className="w-5 h-5" />
              </a>
              <a href={`https://wa.me/${formatWhatsApp(lead.phone)}`} target="_blank" rel="noreferrer"
                className="flex-1 w-12 flex items-center justify-center text-green-500 hover:bg-green-50 active:bg-green-100 border-t border-gray-100 transition-colors">
                <MessageCircle className="w-5 h-5" />
              </a>
            </>
          ) : (
            <div className="flex-1 w-12 flex items-center justify-center text-gray-200">
              <Phone className="w-5 h-5" />
            </div>
          )}
          {lead.stage !== 'captado' && lead.stage !== 'perdido' && (
            <button onClick={onAdvance} className="flex-1 w-12 flex items-center justify-center text-[#ff007c] hover:bg-pink-50 active:bg-pink-100 border-t border-gray-100 transition-colors">
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
          <button onClick={onDelete} className="flex-1 w-12 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 border-t border-gray-100 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* DESKTOP: botones con texto en fila inferior */}
      <div className="hidden sm:flex border-t border-gray-100 divide-x divide-gray-100" onClick={e => e.stopPropagation()}>
        {lead.phone ? (
          <>
            <a href={`tel:${lead.phone}`} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-blue-500 hover:bg-blue-50 transition-colors">
              <Phone className="w-3.5 h-3.5" /> Llamar
            </a>
            <a href={`https://wa.me/${formatWhatsApp(lead.phone)}`} target="_blank" rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-green-600 hover:bg-green-50 transition-colors">
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </a>
          </>
        ) : (
          <span className="flex-1 flex items-center justify-center py-2.5 text-xs text-gray-300">Sin teléfono</span>
        )}
        {lead.stage !== 'captado' && lead.stage !== 'perdido' && (
          <button onClick={onAdvance} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-[#ff007c] hover:bg-pink-50 transition-colors">
            <ArrowRight className="w-3.5 h-3.5" /> Avanzar
          </button>
        )}
        <button onClick={onDelete} className="px-4 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── KanbanCard ──
function KanbanCard({ lead, onAdvance, onMoveTo }: { lead: any; onAdvance: () => void; onMoveTo: (stage: string) => void }) {
  const urgency = getLeadUrgency(lead)
  const badge = getUrgencyBadge(urgency)
  const checklist = getLeadChecklist(lead)
  const [showMove, setShowMove] = useState(false)

  return (
    <div className={`bg-white border rounded-xl p-3 hover:shadow-md transition-all relative ${urgency === 'danger' ? 'border-red-200 bg-red-50/30' : ''}`}>
      <Link href={`/leads/${lead.id}`}>
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-medium text-gray-800 truncate">{lead.full_name}{lead.property_address ? <span className="text-gray-400 font-normal text-[10px] ml-1">· {lead.property_address}</span> : ''}</h4>
          {badge && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${badge.class}`}>{badge.text}</span>}
        </div>
        {lead.tags?.length > 0 && (
          <div className="flex gap-1 mb-1">
            {lead.tags.map((tag: any) => (
              <span key={tag.id} className="text-[9px] px-1.5 py-0.5 rounded-full text-white font-medium" style={{ background: tag.color }}>{tag.name}</span>
            ))}
          </div>
        )}
        <div className="space-y-1 text-xs text-gray-500">
          {lead.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</p>}
          {lead.operation && <p className="capitalize">{lead.operation}{lead.neighborhood ? ` · ${lead.neighborhood}` : ''}</p>}
          {lead.next_step && <p className="text-gray-400 truncate">→ {lead.next_step}</p>}
        </div>
      </Link>
      <div className="flex items-center justify-between mt-2">
        <div className="flex gap-0.5">{Object.entries(checklist).map(([k, v]) => <div key={k} className={`w-1.5 h-1.5 rounded-full ${v ? 'bg-green-500' : 'bg-gray-200'}`} />)}</div>
        <div className="flex gap-1">
          {lead.phone && (
            <a href={`https://wa.me/${formatWhatsApp(lead.phone)}`} target="_blank" className="p-1 rounded hover:bg-green-50 text-green-500"><MessageCircle className="w-3.5 h-3.5" /></a>
          )}
          <button onClick={() => setShowMove(!showMove)} className="p-1 rounded hover:bg-gray-100 text-gray-400" title="Mover a...">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button onClick={onAdvance} className="p-1 rounded hover:bg-pink-50 text-pink-500" title="Avanzar"><ArrowRight className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {/* Move to dropdown */}
      {showMove && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowMove(false)} />
          <div className="absolute right-2 top-full mt-1 z-20 bg-white border rounded-lg shadow-lg py-1 min-w-[140px] max-h-60 overflow-y-auto">
            {LEAD_STAGE_KEYS.filter(s => s !== lead.stage).map(s => (
              <button key={s} onClick={() => { onMoveTo(s); setShowMove(false) }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${LEAD_STAGES[s].color.split(' ')[0]}`} />
                {LEAD_STAGES[s].label}
              </button>
            ))}
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
    <div ref={setNodeRef} className={`w-64 shrink-0 transition-colors rounded-xl ${dropping ? 'bg-[#ff007c]/5 ring-2 ring-[#ff007c]/30' : ''}`}>
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
