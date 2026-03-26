'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Plus, Search, Phone, MessageCircle, Filter, X, LayoutList, Columns3,
  AlertTriangle, Clock, User, MapPin, DollarSign, ArrowRight, ChevronDown, Download, Sparkles, Trash2, GripVertical
} from 'lucide-react'
import {
  LEAD_STAGES, LEAD_STAGE_KEYS, LEAD_PIPELINE_STAGES, LEAD_SOURCES,
  OPERATION_TYPES, getLeadChecklist, getLeadChecklistScore,
  getLeadUrgency, getUrgencyBadge, formatWhatsApp, type LeadStage
} from '@/lib/crm-config'
import { useToast } from '@/components/ui/Toast'
import AIChatPanel from '@/components/ai/AIChatPanel'
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
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'urgency'>((searchParams.get('sort') as any) || 'recent')
  const [showCreate, setShowCreate] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const [saving, setSaving] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState<any>(null)

  const [form, setForm] = useState({
    full_name: '', phone: '', email: '', source: 'manual', source_detail: '',
    property_address: '', neighborhood: '', operation: 'venta', stage: 'nuevo',
    notes: '', estimated_value: '', assigned_to: '', next_step: '', next_step_date: ''
  })

  const loadLeads = () => {
    fetch('/api/leads')
      .then(r => r.json() as Promise<any>)
      .then(d => { setLeads(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    loadLeads()
    fetch('/api/agents').then(r => r.json() as Promise<any>).then(d => { if (Array.isArray(d)) setAgents(d) }).catch(() => {})
  }, [])

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

  const handleCreate = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = (await res.json()) as any
      if (data.id) {
        setShowCreate(false)
        setForm({ full_name: '', phone: '', email: '', source: 'manual', source_detail: '', property_address: '', neighborhood: '', operation: 'venta', stage: 'nuevo', notes: '', estimated_value: '', assigned_to: '', next_step: '', next_step_date: '' })
        toast('Lead creado correctamente')
        loadLeads()
      } else {
        toast(data.error || 'Error al crear lead', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
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

    const res = await fetch('/api/leads', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lead.id, stage: nextStage })
    })
    const result = (await res.json()) as any
    const stageLabel = LEAD_STAGES[nextStage as keyof typeof LEAD_STAGES]?.label || nextStage
    toast(`${lead.full_name} → ${stageLabel}`)

    // Auto-followup created when "presentada"
    if (result.autoFollowup) {
      toast(`📅 Seguimiento automático creado para ${result.autoFollowup.date}`)
    }

    // Captado → offer to create commercial property
    if (result.captadoTransition) {
      const ct = result.captadoTransition
      toast(`✅ ¡${lead.full_name} captado! Podés crear la propiedad comercial desde su ficha.`)
    }

    loadLeads()
  }

  const handleConvertToAppraisal = async (lead: any, createAppraisal: boolean) => {
    await fetch('/api/leads', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lead.id, stage: 'en_tasacion' })
    })

    if (createAppraisal) {
      await fetch('/api/tasaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    }
    setShowConvertModal(null)
    toast(createAppraisal ? `Tasación creada para ${lead.full_name}` : `${lead.full_name} → En tasación`)
    loadLeads()
  }

  const moveToStage = async (leadId: string, stage: string) => {
    if (stage === 'en_tasacion') {
      const lead = leads.find(l => l.id === leadId)
      if (lead) { setShowConvertModal(lead); return }
    }
    if (stage === 'perdido') {
      const reason = prompt('¿Por qué se pierde este lead?')
      if (reason === null) return
      await fetch('/api/leads', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, stage: 'perdido', lost_reason: reason || 'Sin motivo' })
      })
      toast('Lead marcado como perdido', 'warning')
      loadLeads()
      return
    }
    await fetch('/api/leads', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: leadId, stage })
    })
    const stageLabel = LEAD_STAGES[stage as keyof typeof LEAD_STAGES]?.label || stage
    toast(stage === 'perdido' ? 'Lead marcado como perdido' : `Movido a ${stageLabel}`, stage === 'perdido' ? 'warning' : 'success')
    loadLeads()
  }

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
    await fetch('/api/leads', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: leadId, stage: 'perdido', lost_reason: reason || 'Sin motivo especificado' })
    })
    toast('Lead marcado como perdido', 'warning')
    loadLeads()
  }

  const deleteLead = async (leadId: string, leadName: string) => {
    if (!confirm(`¿Eliminar "${leadName}" permanentemente?\n\nEsta acción no se puede deshacer.`)) return
    try {
      await fetch(`/api/leads?id=${leadId}`, { method: 'DELETE' })
      toast('Lead eliminado', 'warning')
      loadLeads()
    } catch { toast('Error al eliminar', 'error') }
  }

  const activeFilters = [filterStage, filterSource, filterOperation, filterAgent].filter(Boolean).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Leads</h1>
          <p className="text-gray-500 text-sm">{leads.length} lead{leads.length !== 1 ? 's' : ''} en el pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setView('list')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'list' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
              <LayoutList className="w-4 h-4" />
            </button>
            <button onClick={() => setView('kanban')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'kanban' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
              <Columns3 className="w-4 h-4" />
            </button>
          </div>
          <a href="/api/export?type=leads" className="hidden sm:flex items-center gap-1 text-xs text-gray-500 border border-gray-200 px-2.5 py-2 rounded-lg hover:border-gray-400">
            <Download className="w-3.5 h-3.5" /> CSV
          </a>
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
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : view === 'list' ? (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Sin leads</p>
              <p className="text-sm mt-1">Creá tu primer lead para comenzar</p>
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
                <DroppableColumn key={stage} id={stage} isOver={false}>
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between rounded-t-2xl z-10">
              <h3 className="font-semibold text-gray-800">Nuevo lead</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input placeholder="Nombre completo *" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
                <input placeholder="Teléfono" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
                <input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
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
            <div className="sticky bottom-0 bg-white border-t px-4 py-3 flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button onClick={handleCreate} disabled={!form.full_name || saving} className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? 'Guardando...' : 'Crear lead'}
              </button>
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

// ── LeadCard (List view) ──
function LeadCard({ lead, onAdvance, onLost, onDelete }: { lead: any; onAdvance: () => void; onLost: () => void; onDelete: () => void }) {
  const stage = LEAD_STAGES[lead.stage as LeadStage] || LEAD_STAGES.nuevo
  const urgency = getLeadUrgency(lead)
  const badge = getUrgencyBadge(urgency)
  const checklist = getLeadChecklist(lead)
  const checkItems = Object.values(checklist).filter(Boolean).length
  const hasAppraisal = lead.appraisal_count > 0
  const lastActivity = lead.last_activity_at ? timeAgo(lead.last_activity_at) : null

  return (
    <div className={`bg-white border rounded-xl transition-all ${urgency === 'danger' ? 'border-red-300' : urgency === 'warning' ? 'border-yellow-300' : 'border-gray-200'}`}>
      <Link href={`/leads/${lead.id}`} className="block px-4 py-3">
        {/* Line 1 */}
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm text-gray-800 truncate flex-1">{lead.full_name}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${stage.color}`}>{stage.label}</span>
          {badge && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${badge.class}`}>{badge.text}</span>}
        </div>
        {/* Line 2 */}
        <div className="text-xs text-gray-500 space-y-0.5">
          {lead.property_address && <p className="truncate text-gray-400">{lead.property_address}</p>}
          <p className="truncate">
            {lead.phone && <span>{lead.phone} &middot; </span>}
            {lead.operation && <span className="capitalize">{lead.operation}</span>}
            {lead.neighborhood && <span> &middot; {lead.neighborhood}</span>}
          </p>
          <p className="text-[10px] text-gray-400 truncate">
            {lead.assigned_name && <span>{lead.assigned_name}</span>}
            {lastActivity && <span> &middot; &Uacute;lt: {lastActivity}</span>}
            {hasAppraisal && <span> &middot; Tasaci&oacute;n &#x2713;</span>}
          </p>
        </div>
        {/* Line 3: checklist + next step */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex gap-0.5">{Object.entries(checklist).map(([k, v]) => <div key={k} className={`w-2 h-2 rounded-full ${v ? 'bg-green-500' : 'bg-gray-200'}`} />)}</div>
          <span className="text-[10px] text-gray-400">{checkItems}/6</span>
          {lead.next_step && <span className="text-[10px] text-gray-400 truncate flex-1">&rarr; {lead.next_step}</span>}
        </div>
      </Link>
      {/* Actions */}
      <div className="flex border-t border-gray-100" onClick={e => e.stopPropagation()}>
        {lead.phone ? (
          <>
            <a href={`tel:${lead.phone}`} className="flex-1 py-2.5 flex justify-center text-blue-500 hover:bg-blue-50"><Phone className="w-4 h-4" /></a>
            <a href={`https://wa.me/${formatWhatsApp(lead.phone)}`} target="_blank" className="flex-1 py-2.5 flex justify-center text-green-500 hover:bg-green-50 border-l border-gray-100"><MessageCircle className="w-4 h-4" /></a>
          </>
        ) : (
          <span className="flex-1 py-2.5 flex justify-center text-gray-300 text-xs">Sin tel</span>
        )}
        {lead.stage !== 'captado' && lead.stage !== 'perdido' && (
          <button onClick={onAdvance} className="flex-1 py-2.5 flex justify-center text-[#ff007c] hover:bg-pink-50 border-l border-gray-100"><ArrowRight className="w-4 h-4" /></button>
        )}
        <button onClick={onDelete} className="py-2.5 px-3 flex justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 border-l border-gray-100" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
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
function DroppableColumn({ id, children, isOver }: { id: string; children: React.ReactNode; isOver: boolean }) {
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
