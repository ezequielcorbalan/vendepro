# Leads Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar el módulo `/leads` completo a VendéPro — lista + kanban, detalle, creación, edición, cambio de etapa con auto-acciones — reescribiendo feature por feature desde reportes-app.

**Architecture:** Frontend-heavy: la mayor parte del trabajo es el frontend (2 páginas nuevas + crm-config.ts). El backend api-crm ya tiene todos los endpoints de leads; solo se agregan 3 rutas menores para tags y stage-history. `@dnd-kit`, `formatDate`, y la entrada `/leads` en nav-config ya existen en el proyecto.

**Tech Stack:** Next.js 15 App Router · TypeScript · Tailwind CSS · @dnd-kit/core · Hono (Cloudflare Workers) · apiFetch helper · useToast hook

---

## File Map

| Acción | Archivo |
|--------|---------|
| Crear | `vendepro-frontend/src/lib/crm-config.ts` |
| Modificar | `vendepro-frontend/src/lib/types.ts` |
| Modificar | `vendepro-backend/packages/api-crm/src/index.ts` |
| Crear | `vendepro-frontend/src/app/(dashboard)/leads/page.tsx` |
| Crear | `vendepro-frontend/src/app/(dashboard)/leads/[id]/page.tsx` |

---

## Task 1: crm-config.ts + Lead types

**Files:**
- Create: `vendepro-frontend/src/lib/crm-config.ts`
- Modify: `vendepro-frontend/src/lib/types.ts`

- [ ] **Step 1: Crear `src/lib/crm-config.ts`**

```typescript
// vendepro-frontend/src/lib/crm-config.ts
// ============================================================
// CRM CONFIG — fuente única de verdad para stages, tipos, labels
// NOTA: VendéPro backend NO tiene 'archivado' — son 9 etapas
// ============================================================

export const LEAD_STAGES = {
  nuevo:       { label: 'Nuevo',        color: 'bg-blue-100 text-blue-800',       order: 1 },
  asignado:    { label: 'Asignado',     color: 'bg-indigo-100 text-indigo-800',   order: 2 },
  contactado:  { label: 'Contactado',   color: 'bg-cyan-100 text-cyan-800',       order: 3 },
  calificado:  { label: 'Calificado',   color: 'bg-emerald-100 text-emerald-800', order: 4 },
  en_tasacion: { label: 'En tasación',  color: 'bg-purple-100 text-purple-800',   order: 5 },
  presentada:  { label: 'Presentada',   color: 'bg-pink-100 text-pink-800',       order: 6 },
  seguimiento: { label: 'Seguimiento',  color: 'bg-yellow-100 text-yellow-800',   order: 7 },
  captado:     { label: 'Captado',      color: 'bg-green-100 text-green-800',     order: 8 },
  perdido:     { label: 'Perdido',      color: 'bg-red-100 text-red-800',         order: 9 },
} as const

export type LeadStage = keyof typeof LEAD_STAGES
export const LEAD_STAGE_KEYS = Object.keys(LEAD_STAGES) as LeadStage[]
// Pipeline visible en kanban: excluye 'perdido' (terminal negativo)
export const LEAD_PIPELINE_STAGES = LEAD_STAGE_KEYS.filter(s => s !== 'perdido')

export const LEAD_SOURCES = {
  zonaprop:     { label: 'ZonaProp' },
  argenprop:    { label: 'ArgenProp' },
  mercadolibre: { label: 'MercadoLibre' },
  instagram:    { label: 'Instagram' },
  facebook:     { label: 'Facebook' },
  google:       { label: 'Google' },
  referido:     { label: 'Referido' },
  cartel:       { label: 'Cartel' },
  telefono:     { label: 'Teléfono' },
  manual:       { label: 'Carga manual' },
  otro:         { label: 'Otro' },
} as const

export const OPERATION_TYPES = {
  venta:    { label: 'Venta' },
  alquiler: { label: 'Alquiler' },
  tasacion: { label: 'Tasación' },
  otro:     { label: 'Otro' },
} as const

export function getLeadChecklist(lead: any) {
  return {
    contacto:       !!(lead.phone || lead.email),
    necesidad:      !!(lead.notes && lead.notes.length > 5),
    operacion:      !!(lead.operation && lead.operation !== ''),
    presupuesto:    !!(lead.estimated_value || lead.budget),
    zona:           !!(lead.neighborhood || lead.property_address),
    proxima_accion: !!(lead.next_step),
  }
}

export function getLeadChecklistScore(lead: any): number {
  const cl = getLeadChecklist(lead)
  const total = Object.values(cl).filter(Boolean).length
  return Math.round((total / 6) * 100)
}

export function getLeadUrgency(lead: any): 'ok' | 'warning' | 'danger' | 'lost' {
  if (lead.stage === 'perdido') return 'lost'
  const now = new Date()
  const updated = lead.updated_at ? new Date(lead.updated_at) : new Date(lead.created_at)
  const diffH = (now.getTime() - updated.getTime()) / (1000 * 60 * 60)
  if (lead.stage === 'nuevo' && diffH > 24) return 'danger'
  if (diffH > 168) return 'danger'  // 7 días
  if (diffH > 72)  return 'warning' // 3 días
  return 'ok'
}

export function getUrgencyBadge(urgency: 'ok' | 'warning' | 'danger' | 'lost') {
  switch (urgency) {
    case 'danger':  return { text: 'URGENTE', class: 'bg-red-100 text-red-700' }
    case 'warning': return { text: 'Atención', class: 'bg-yellow-100 text-yellow-700' }
    case 'lost':    return { text: 'Perdido', class: 'bg-gray-100 text-gray-500' }
    default:        return null
  }
}

export function formatWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('54') && digits.length >= 12) return digits
  if (digits.startsWith('+')) return digits
  if (digits.length === 10 || digits.length === 11) return `54${digits}`
  return digits
}
```

- [ ] **Step 2: Agregar tipos Lead a `src/lib/types.ts`**

Agregar al final del archivo (después de `HistoricalDataPoint`):

```typescript
// ── LEADS ─────────────────────────────────────────────────────
export type LeadStage =
  | 'nuevo' | 'asignado' | 'contactado' | 'calificado'
  | 'en_tasacion' | 'presentada' | 'seguimiento' | 'captado' | 'perdido'

export type LeadUrgency = 'ok' | 'warning' | 'danger' | 'lost'

export interface LeadTag {
  id: string
  org_id: string
  name: string
  color: string
  is_default: boolean
}

export interface LeadActivity {
  id: string
  activity_type: string
  description: string | null
  result: string | null
  agent_name: string | null
  created_at: string
  completed_at?: string | null
}

export interface Lead {
  id: string
  org_id: string
  full_name: string
  phone: string | null
  email: string | null
  source: string | null
  source_detail: string | null
  property_address: string | null
  neighborhood: string | null
  property_type: string | null
  operation: string | null
  stage: LeadStage
  assigned_to: string | null
  assigned_name: string | null
  notes: string | null
  estimated_value: string | null
  budget: string | null
  timing: string | null
  personas_trabajo: string | null
  mascotas: string | null
  next_step: string | null
  next_step_date: string | null
  lost_reason: string | null
  first_contact_at: string | null
  created_at: string
  updated_at: string
  tags: LeadTag[]
  last_activity_at: string | null
  appraisal_count?: number
}
```

- [ ] **Step 3: Verificar tipos**

```bash
cd vendepro-frontend && npx tsc --noEmit
```

Expected: sin errores de tipo (puede haber warnings de any en archivos existentes — ignorar).

- [ ] **Step 4: Commit**

```bash
git add vendepro-frontend/src/lib/crm-config.ts vendepro-frontend/src/lib/types.ts
git commit -m "feat(leads): agregar crm-config y tipos Lead"
```

---

## Task 2: Backend — 3 rutas menores en api-crm

**Files:**
- Modify: `vendepro-backend/packages/api-crm/src/index.ts`

- [ ] **Step 1: Agregar `POST /tags`, `DELETE /tags`, `GET /stage-history`**

Agregar al final del archivo `packages/api-crm/src/index.ts`, antes de `export default app`:

```typescript
// ── TAGS MANAGEMENT ───────────────────────────────────────────
app.post('/tags', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1TagRepository(c.env.DB)
  const idGen = new CryptoIdGenerator()
  const id = idGen.generate()
  await repo.save({
    id,
    org_id: c.get('orgId'),
    name: body.name,
    color: body.color || '#6366f1',
    is_default: false,
    created_at: new Date().toISOString(),
  } as any)
  return c.json({ id }, 201)
})

app.delete('/tags', async (c) => {
  const { id } = c.req.query()
  const repo = new D1TagRepository(c.env.DB)
  await repo.delete(id, c.get('orgId'))
  return c.json({ success: true })
})

// ── STAGE HISTORY ──────────────────────────────────────────────
app.get('/stage-history', async (c) => {
  const { entity_id } = c.req.query()
  const repo = new D1StageHistoryRepository(c.env.DB)
  const history = await repo.findByEntity(entity_id, c.get('orgId'))
  return c.json(history.map((h: any) => h.toObject?.() ?? h))
})
```

- [ ] **Step 2: Verificar que compila**

```bash
cd vendepro-backend && npx tsc --noEmit
```

Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add vendepro-backend/packages/api-crm/src/index.ts
git commit -m "feat(api-crm): agregar POST/DELETE /tags y GET /stage-history"
```

---

## Task 3: Página `/leads` — lista + kanban

**Files:**
- Create: `vendepro-frontend/src/app/(dashboard)/leads/page.tsx`

La página contiene los componentes `LeadCard`, `KanbanCard`, `DroppableColumn` y `DraggableKanbanCard` inline (igual que el patrón de reportes-app).

- [ ] **Step 1: Crear el directorio**

```bash
mkdir -p vendepro-frontend/src/app/\(dashboard\)/leads
```

- [ ] **Step 2: Crear `leads/page.tsx`**

```typescript
'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Plus, Search, Phone, MessageCircle, Filter, X, LayoutList, Columns3,
  AlertTriangle, User, ArrowRight, ChevronDown, Download, Trash2
} from 'lucide-react'
import {
  LEAD_STAGES, LEAD_STAGE_KEYS, LEAD_PIPELINE_STAGES, LEAD_SOURCES,
  OPERATION_TYPES, getLeadChecklist, getLeadUrgency, getUrgencyBadge,
  formatWhatsApp, type LeadStage
} from '@/lib/crm-config'
import { useToast } from '@/components/ui/Toast'
import { apiFetch } from '@/lib/api'
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  type DragEndEvent, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core'

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 60000
  if (diff < 60) return `${Math.floor(diff)}m`
  if (diff < 1440) return `${Math.floor(diff / 60)}h`
  const days = Math.floor(diff / 1440)
  if (days === 1) return 'Ayer'
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`min-w-[240px] flex-1 rounded-xl border p-2 transition-colors ${isOver ? 'bg-pink-50 border-pink-300' : 'bg-gray-50 border-gray-200'}`}>
      {children}
    </div>
  )
}

function DraggableKanbanCard({ lead, onAdvance, onMoveTo }: { lead: any; onAdvance: () => void; onMoveTo: (s: string) => void }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: lead.id })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: 0.5 } : undefined
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <KanbanCard lead={lead} onAdvance={onAdvance} onMoveTo={onMoveTo} />
    </div>
  )
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
    apiFetch('crm', '/leads')
      .then(r => r.json() as Promise<any>)
      .then(d => { setLeads(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    loadLeads()
    apiFetch('admin', '/agents').then(r => r.json() as Promise<any>).then(d => { if (Array.isArray(d)) setAgents(d) }).catch(() => {})
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
    if (sortBy === 'name') result.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
    else if (sortBy === 'urgency') result.sort((a, b) => {
      const order: Record<string, number> = { danger: 0, warning: 1, ok: 2, lost: 3 }
      return (order[getLeadUrgency(a)] ?? 2) - (order[getLeadUrgency(b)] ?? 2)
    })
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
      const res = await apiFetch('crm', '/leads', { method: 'POST', body: JSON.stringify(form) })
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
    if (nextStage === 'en_tasacion') { setShowConvertModal(lead); return }
    const res = await apiFetch('crm', '/leads/stage', {
      method: 'POST',
      body: JSON.stringify({ id: lead.id, stage: nextStage })
    })
    const result = (await res.json()) as any
    const stageLabel = LEAD_STAGES[nextStage as LeadStage]?.label || nextStage
    toast(`${lead.full_name} → ${stageLabel}`)
    if (result.autoFollowup) toast(`Seguimiento automático creado para ${result.autoFollowup.date}`)
    loadLeads()
  }

  const handleConvertToAppraisal = async (lead: any, createAppraisal: boolean) => {
    await apiFetch('crm', '/leads/stage', {
      method: 'POST',
      body: JSON.stringify({ id: lead.id, stage: 'en_tasacion' })
    })
    if (createAppraisal) {
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
    }
    setShowConvertModal(null)
    toast(createAppraisal ? `Tasación creada para ${lead.full_name}` : `${lead.full_name} → En tasación`)
    loadLeads()
  }

  const moveToStage = useCallback(async (leadId: string, stage: string) => {
    if (stage === 'en_tasacion') {
      const lead = leads.find(l => l.id === leadId)
      if (lead) { setShowConvertModal(lead); return }
    }
    if (stage === 'perdido') {
      const reason = prompt('¿Por qué se pierde este lead?')
      if (reason === null) return
      await apiFetch('crm', '/leads/stage', {
        method: 'POST',
        body: JSON.stringify({ id: leadId, stage: 'perdido', notes: reason || 'Sin motivo' })
      })
      toast('Lead marcado como perdido', 'warning')
      loadLeads()
      return
    }
    await apiFetch('crm', '/leads/stage', {
      method: 'POST',
      body: JSON.stringify({ id: leadId, stage })
    })
    const stageLabel = LEAD_STAGES[stage as LeadStage]?.label || stage
    toast(`Movido a ${stageLabel}`)
    loadLeads()
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
    const reason = prompt('¿Por qué se pierde este lead?')
    if (reason === null) return
    await apiFetch('crm', '/leads/stage', {
      method: 'POST',
      body: JSON.stringify({ id: leadId, stage: 'perdido', notes: reason || 'Sin motivo especificado' })
    })
    toast('Lead marcado como perdido', 'warning')
    loadLeads()
  }

  const deleteLead = async (leadId: string, leadName: string) => {
    if (!confirm(`¿Eliminar "${leadName}" permanentemente?`)) return
    try {
      await apiFetch('crm', `/leads?id=${leadId}`, { method: 'DELETE' })
      toast('Lead eliminado', 'warning')
      loadLeads()
    } catch { toast('Error al eliminar', 'error') }
  }

  const activeFilters = [filterStage, filterSource, filterOperation, filterAgent].filter(Boolean).length

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
                ...filtered.map(l => [l.full_name, l.phone || '', l.email || '', l.operation || '', LEAD_STAGES[l.stage as LeadStage]?.label || l.stage, l.neighborhood || '', l.estimated_value || '', l.assigned_name || '', l.next_step || '', new Date(l.created_at).toLocaleDateString('es-AR')])
              ]
              const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click()
              URL.revokeObjectURL(url)
            }}
            className="hidden sm:flex items-center gap-1 text-xs text-gray-500 border border-gray-200 px-2.5 py-2 rounded-lg hover:border-gray-400"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={() => setShowCreate(true)} className="bg-[#ff007c] text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 hover:opacity-90">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nuevo lead</span><span className="sm:hidden">Nuevo</span>
          </button>
        </div>
      </div>

      {/* Search + Sort + Filters */}
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
            <label className="text-xs text-gray-500 mb-1 block">Agente</label>
            <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)} className="w-full border rounded-lg px-2 py-1.5 text-sm">
              <option value="">Todos</option>
              {agents.map((a: any) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          </div>
          <button onClick={() => { setFilterStage(''); setFilterSource(''); setFilterOperation(''); setFilterAgent('') }} className="text-xs text-gray-500 hover:text-pink-600 self-end">
            Limpiar filtros
          </button>
        </div>
      )}

      {/* Stage tabs */}
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
        <div className="space-y-3 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="h-5 w-28 bg-gray-200 rounded mb-2" />
              <div className="h-4 w-48 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : view === 'list' ? (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Sin leads</p>
              <p className="text-sm mt-1">Creá tu primer lead para comenzar</p>
              <button onClick={() => setShowCreate(true)} className="mt-3 text-[#ff007c] text-sm hover:underline">Agregar lead</button>
            </div>
          ) : filtered.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onAdvance={() => advanceStage(lead)}
              onLost={() => markLost(lead.id)}
              onDelete={() => deleteLead(lead.id, lead.full_name)}
            />
          ))}
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
                      {stageLeads.map(lead => (
                        <DraggableKanbanCard
                          key={lead.id}
                          lead={lead}
                          onAdvance={() => advanceStage(lead)}
                          onMoveTo={(s) => moveToStage(lead.id, s)}
                        />
                      ))}
                    </div>
                  </DroppableColumn>
                )
              })}
            </div>
          </div>
          <DragOverlay>
            {activeDragId ? (() => {
              const lead = leads.find(l => l.id === activeDragId)
              return lead ? (
                <div className="bg-white rounded-lg shadow-xl border-2 border-[#ff007c] p-3 w-60 opacity-90">
                  <p className="text-sm font-medium text-gray-800 truncate">{lead.full_name}</p>
                  <p className="text-[10px] text-gray-400">{lead.operation} · {lead.neighborhood}</p>
                </div>
              ) : null
            })() : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Create Modal */}
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
              <button onClick={handleCreate} disabled={!form.full_name || saving} className="flex-1 px-4 py-2 bg-[#ff007c] text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? 'Guardando...' : 'Crear lead'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Appraisal Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowConvertModal(null)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800 mb-2">Avanzar a tasación</h3>
            <p className="text-sm text-gray-500 mb-4">
              <strong>{showConvertModal.full_name}</strong> pasará a &ldquo;En tasación&rdquo;. ¿Querés crear una tasación vinculada?
            </p>
            <div className="space-y-2">
              <button onClick={() => handleConvertToAppraisal(showConvertModal, true)} className="w-full px-4 py-3 bg-[#ff007c] text-white rounded-xl text-sm font-medium hover:opacity-90">
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
    </div>
  )
}

function LeadCard({ lead, onAdvance, onLost, onDelete }: { lead: any; onAdvance: () => void; onLost: () => void; onDelete: () => void }) {
  const stage = LEAD_STAGES[lead.stage as LeadStage] || LEAD_STAGES.nuevo
  const urgency = getLeadUrgency(lead)
  const badge = getUrgencyBadge(urgency)
  const checklist = getLeadChecklist(lead)
  const checkItems = Object.values(checklist).filter(Boolean).length
  const lastActivity = lead.last_activity_at ? timeAgo(lead.last_activity_at) : null

  return (
    <div className={`bg-white border rounded-xl transition-all ${urgency === 'danger' ? 'border-red-300' : urgency === 'warning' ? 'border-yellow-300' : 'border-gray-200'}`}>
      <Link href={`/leads/${lead.id}`} className="block px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm text-gray-800 truncate flex-1">{lead.full_name}</span>
          {lead.tags?.map((tag: any) => (
            <span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 text-white" style={{ background: tag.color }}>{tag.name}</span>
          ))}
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${stage.color}`}>{stage.label}</span>
          {badge && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${badge.class}`}>{badge.text}</span>}
        </div>
        <div className="text-xs text-gray-500 space-y-0.5">
          {lead.property_address && <p className="truncate text-gray-400">{lead.property_address}</p>}
          <p className="truncate">
            {lead.phone && <span>{lead.phone} &middot; </span>}
            {lead.operation && <span className="capitalize">{lead.operation}</span>}
            {lead.neighborhood && <span> &middot; {lead.neighborhood}</span>}
          </p>
          <p className="text-[10px] text-gray-400 truncate">
            {lead.assigned_name && <span>{lead.assigned_name}</span>}
            {lastActivity && <span> &middot; Últ: {lastActivity}</span>}
            {lead.appraisal_count > 0 && <span> &middot; Tasación ✓</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex gap-0.5">
            {Object.entries(checklist).map(([k, v]) => <div key={k} className={`w-2 h-2 rounded-full ${v ? 'bg-green-500' : 'bg-gray-200'}`} />)}
          </div>
          <span className="text-[10px] text-gray-400">{checkItems}/6</span>
          {lead.next_step && <span className="text-[10px] text-gray-400 truncate flex-1">→ {lead.next_step}</span>}
        </div>
      </Link>
      <div className="flex border-t border-gray-100" onClick={e => e.stopPropagation()}>
        {lead.phone ? (
          <>
            <a href={`tel:${lead.phone}`} className="flex-1 py-2.5 flex justify-center text-blue-500 hover:bg-blue-50"><Phone className="w-4 h-4" /></a>
            <a href={`https://wa.me/${formatWhatsApp(lead.phone)}`} target="_blank" rel="noreferrer" className="flex-1 py-2.5 flex justify-center text-green-500 hover:bg-green-50 border-l border-gray-100"><MessageCircle className="w-4 h-4" /></a>
          </>
        ) : (
          <span className="flex-1 py-2.5 flex justify-center text-gray-300 text-xs">Sin tel</span>
        )}
        {lead.stage !== 'captado' && lead.stage !== 'perdido' && (
          <button onClick={onAdvance} className="flex-1 py-2.5 flex justify-center text-[#ff007c] hover:bg-pink-50 border-l border-gray-100"><ArrowRight className="w-4 h-4" /></button>
        )}
        <button onClick={onDelete} className="py-2.5 px-3 flex justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 border-l border-gray-100"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  )
}

function KanbanCard({ lead, onAdvance, onMoveTo }: { lead: any; onAdvance: () => void; onMoveTo: (stage: string) => void }) {
  const urgency = getLeadUrgency(lead)
  const badge = getUrgencyBadge(urgency)
  const checklist = getLeadChecklist(lead)
  const [showMove, setShowMove] = useState(false)

  return (
    <div className={`bg-white border rounded-xl p-3 hover:shadow-md transition-all relative ${urgency === 'danger' ? 'border-red-200 bg-red-50/30' : 'border-gray-200'}`}>
      <Link href={`/leads/${lead.id}`}>
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-medium text-gray-800 truncate">{lead.full_name}</h4>
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
        <div className="flex gap-0.5">
          {Object.entries(checklist).map(([k, v]) => <div key={k} className={`w-1.5 h-1.5 rounded-full ${v ? 'bg-green-500' : 'bg-gray-200'}`} />)}
        </div>
        <div className="flex gap-1">
          {lead.phone && (
            <a href={`https://wa.me/${formatWhatsApp(lead.phone)}`} target="_blank" rel="noreferrer" className="p-1 rounded hover:bg-green-50 text-green-500"><MessageCircle className="w-3.5 h-3.5" /></a>
          )}
          <button onClick={e => { e.preventDefault(); setShowMove(!showMove) }} className="p-1 rounded hover:bg-gray-100 text-gray-400">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button onClick={e => { e.preventDefault(); onAdvance() }} className="p-1 rounded hover:bg-pink-50 text-pink-500"><ArrowRight className="w-3.5 h-3.5" /></button>
        </div>
      </div>
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
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd vendepro-frontend && npx tsc --noEmit
```

Expected: sin errores en `leads/page.tsx`.

- [ ] **Step 4: Verificar en browser**

```bash
cd vendepro-frontend && npm run dev
```

Abrir `http://localhost:3000/leads`. Verificar:
- [ ] Lista carga leads (o empty state si no hay)
- [ ] Toggle lista/kanban funciona
- [ ] Modal "Nuevo lead" abre, crea, y aparece en lista
- [ ] Filtros y búsqueda funcionan
- [ ] Botones tel/WhatsApp en tarjetas

- [ ] **Step 5: Commit**

```bash
git add vendepro-frontend/src/app/\(dashboard\)/leads/page.tsx
git commit -m "feat(leads): agregar página principal — lista, kanban, filtros, crear"
```

---

## Task 4: Página `/leads/[id]` — detalle + edición + stage selector

**Files:**
- Create: `vendepro-frontend/src/app/(dashboard)/leads/[id]/page.tsx`

- [ ] **Step 1: Crear el directorio**

```bash
mkdir -p "vendepro-frontend/src/app/(dashboard)/leads/[id]"
```

- [ ] **Step 2: Crear `leads/[id]/page.tsx`**

```typescript
'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Phone, MessageCircle, Edit3, Save, X, Trash2,
  MapPin, User
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

  function loadLead() {
    Promise.all([
      apiFetch('crm', `/leads?id=${leadId}`).then(r => r.json() as Promise<any>),
      apiFetch('crm', `/activities?lead_id=${leadId}`).then(r => r.json() as Promise<any>).catch(() => []),
    ]).then(([leadData, actsData]) => {
      const l = Array.isArray(leadData) ? leadData[0] : leadData
      setLead(l)
      setEditForm(l || {})
      setActivities(Array.isArray(actsData) ? actsData : [])
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
    await apiFetch('crm', `/leads?id=${leadId}`, { method: 'DELETE' })
    toast('Lead eliminado', 'warning')
    router.push('/leads')
  }

  const handleStageChange = async (stage: string) => {
    if (editing) return
    if (stage === 'en_tasacion') { setShowConvertModal(true); return }
    if (stage === 'perdido') {
      const reason = prompt('¿Por qué se pierde este lead?')
      if (reason === null) return
      await apiFetch('crm', '/leads/stage', {
        method: 'POST',
        body: JSON.stringify({ id: leadId, stage: 'perdido', notes: reason || 'Sin motivo' }),
      })
      toast('Lead marcado como perdido', 'warning')
      loadLead()
      return
    }
    const res = await apiFetch('crm', '/leads/stage', {
      method: 'POST',
      body: JSON.stringify({ id: leadId, stage }),
    })
    const result = (await res.json()) as any
    toast(`Etapa: ${LEAD_STAGES[stage as LeadStage]?.label || stage}`)
    if (result.autoFollowup) toast(`Seguimiento automático creado para ${result.autoFollowup.date}`)
    loadLead()
  }

  const handleConvertToAppraisal = async (createAppraisal: boolean) => {
    await apiFetch('crm', '/leads/stage', {
      method: 'POST',
      body: JSON.stringify({ id: leadId, stage: 'en_tasacion' }),
    })
    if (createAppraisal && lead) {
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
    }
    setShowConvertModal(false)
    toast(createAppraisal ? `Tasación creada para ${lead?.full_name}` : `${lead?.full_name} → En tasación`)
    loadLead()
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse max-w-3xl">
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
      {/* Top bar */}
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
                <Save className="w-3.5 h-3.5" /> {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          )}
          <button onClick={handleDelete} className="p-1.5 border rounded-lg text-gray-400 hover:text-red-500 hover:border-red-200">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main card */}
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
            {/* View mode */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{lead.full_name}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {lead.tags?.map((tag: any) => (
                    <span key={tag.id} className="text-[10px] px-2 py-0.5 rounded-full font-medium text-white" style={{ background: tag.color }}>{tag.name}</span>
                  ))}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stage.color}`}>{stage.label}</span>
                  {urgency === 'danger' && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">URGENTE</span>}
                  {urgency === 'warning' && <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium">Atención</span>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
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
              <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                <p className="text-xs text-yellow-600 font-medium mb-0.5">Próxima acción</p>
                <p className="text-sm text-yellow-800">{lead.next_step}</p>
                {lead.next_step_date && <p className="text-xs text-yellow-500 mt-1">{formatDate(lead.next_step_date)}</p>}
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
                    {{ contacto: 'Contacto', necesidad: 'Necesidad', operacion: 'Operación', presupuesto: 'Presupuesto', zona: 'Zona', proxima_accion: 'Próxima acción' }[k]}
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

      {/* Activity timeline */}
      {activities.length > 0 && (
        <div className="bg-white border rounded-xl p-4">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">Actividad reciente</h2>
          <div className="space-y-2">
            {activities.slice(0, 10).map((a: any) => {
              const ts = a.completed_at || a.created_at
              const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
              const ago = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 1440)}d`
              return (
                <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <div className="w-2 h-2 bg-[#ff007c] rounded-full shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 truncate">{a.description || a.activity_type}</p>
                    <p className="text-[10px] text-gray-400">{a.agent_name}</p>
                  </div>
                  <span className="text-[10px] text-gray-300 shrink-0">{ago}</span>
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
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd vendepro-frontend && npx tsc --noEmit
```

Expected: sin errores nuevos.

- [ ] **Step 4: Verificar en browser**

```bash
cd vendepro-frontend && npm run dev
```

Navegar a `/leads`, click en un lead (o crear uno). Verificar:
- [ ] Detalle carga correctamente (nombre, info grid, tags)
- [ ] Próxima acción callout amarillo visible si tiene next_step
- [ ] Notas callout gris visible si tiene notes
- [ ] Checklist pills (verde/gris según completitud)
- [ ] Stage selector: etapa activa resaltada, click cambia etapa
- [ ] Avanzar a `en_tasacion` abre el modal de tasación
- [ ] Avanzar a `perdido` pide razón (browser prompt)
- [ ] Avanzar a `presentada` muestra toast con autoFollowup si aplica
- [ ] Botón Editar activa form, Guardar persiste los cambios
- [ ] Timeline de actividad visible si existen actividades
- [ ] Botón eliminar redirige a `/leads`

- [ ] **Step 5: Commit final**

```bash
git add vendepro-frontend/src/app/\(dashboard\)/leads/
git commit -m "feat(leads): agregar página de detalle — edición, cambio de etapa, timeline"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: crm-config ✓ · tipos ✓ · backend gaps ✓ · lista ✓ · kanban ✓ · crear ✓ · detalle ✓ · edit mode ✓ · stage selector ✓ · modal tasación ✓ · perdido prompt ✓ · auto-followup toast ✓ · checklist ✓ · timeline ✓ · export CSV ✓ · nav (ya existía) ✓
- [x] **Placeholders**: ninguno — todo el código está completo
- [x] **Type consistency**: `LeadStage` definido en crm-config y types.ts, usado en ambas páginas · `LEAD_STAGES[stage as LeadStage]` consistente · `formatWhatsApp` definida en crm-config y usada en ambas páginas · `getLeadChecklist` / `getLeadUrgency` / `getUrgencyBadge` definidas en crm-config y usadas en page.tsx y [id]/page.tsx
- [x] **Notas adicionales**: La navegación `/leads` ya existe en nav-config.ts · @dnd-kit ya instalado · `formatDate` ya existe en utils.ts · `POST /leads/stage` ya existe en api-crm (usado aquí en vez de `PUT /leads` para stage changes, para obtener history + auto-eventos)
