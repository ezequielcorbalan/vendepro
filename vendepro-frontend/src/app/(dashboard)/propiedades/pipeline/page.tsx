'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { DollarSign, MapPin, LayoutGrid, Table2, GripVertical, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { scopeQueryString } from '@/lib/agent-scope'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { PropertyStageBadge } from '@/components/ui/PropertyStageBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { PROPERTY_STAGES, type PropertyStage } from '@/lib/crm-config'
import { formatCurrency } from '@/lib/utils'

// Columnas del kanban comercial. Drag & drop libre entre cualquiera de ellas.
const KANBAN_STAGES: PropertyStage[] = [
  'propuesta', 'captada', 'documentacion', 'publicada', 'reservada', 'vendida', 'suspendida', 'perdida',
]

// Normalize legacy slugs to current DB slugs
const SLUG_ALIASES: Record<string, PropertyStage> = {
  captacion: 'captada',
  con_ofertas: 'reservada',
  archivada: 'suspendida',
  vencida: 'perdida',
}
function normalizeStage(slug: string): string {
  return SLUG_ALIASES[slug] ?? slug
}

const ARCHIVE_WARN_DAYS = 30
type ViewMode = 'kanban' | 'tabla'
type SortKey = 'stage' | 'address' | 'neighborhood' | 'price' | 'owner'

// Header de tabla con orden clickeable (asc/desc) + indicador accesible.
function SortHeader({ label, sortKey, sort, onSort, className }: {
  label: string
  sortKey: SortKey
  sort: { key: SortKey; dir: 'asc' | 'desc' }
  onSort: (k: SortKey) => void
  className?: string
}) {
  const active = sort.key === sortKey
  return (
    <th
      className={`text-left px-4 py-2.5 font-medium ${className ?? ''}`}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors ${active ? 'text-gray-700' : 'hover:text-gray-700'}`}
      >
        {label}
        {active
          ? (sort.dir === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />)
          : <ChevronsUpDown className="w-3 h-3 text-gray-300" />}
      </button>
    </th>
  )
}

function daysSince(dateStr?: string) {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export default function PipelinePage() {
  const { toast } = useToast()
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('kanban')
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    // distance:8 → un click corto navega (Link); recién a los 8px arranca el drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  useEffect(() => {
    const saved = localStorage.getItem('pipeline_view') as ViewMode | null
    if (saved === 'kanban' || saved === 'tabla') setView(saved)
  }, [])

  function loadProperties() {
    const scope = scopeQueryString()
    apiFetch('properties', `/properties${scope}`)
      .then(r => r.json() as Promise<any>)
      .then(d => { setProperties(Array.isArray(d) ? d : (d.properties || [])); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadProperties() }, [])

  const byStage = useMemo(() => {
    const map: Record<string, any[]> = {}
    KANBAN_STAGES.forEach(s => { map[s] = [] })
    properties.forEach(p => {
      const s = normalizeStage(p.commercial_stage ?? '')
      if (s && map[s]) map[s].push(p)
    })
    return map
  }, [properties])

  // Orden de la vista Tabla (headers clickeables).
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'stage', dir: 'asc' })
  const toggleSort = (key: SortKey) =>
    setSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })

  const sortedProperties = useMemo(() => {
    const list = properties.filter(p => KANBAN_STAGES.includes(normalizeStage(p.commercial_stage ?? '') as PropertyStage))
    const val = (p: any): string | number => {
      switch (sort.key) {
        case 'price': return Number(p.asking_price) || 0
        case 'address': return (p.address ?? '').toLowerCase()
        case 'neighborhood': return (p.neighborhood ?? '').toLowerCase()
        case 'owner': return (p.owner_name ?? '').toLowerCase()
        default: return PROPERTY_STAGES[normalizeStage(p.commercial_stage ?? '') as PropertyStage]?.order ?? 99
      }
    }
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      const va = val(a), vb = val(b)
      if (va < vb) return -dir
      if (va > vb) return dir
      return 0
    })
  }, [properties, sort])

  // Mueve una propiedad a otra etapa (override: pipeline comercial libre).
  async function moveToStage(property: any, targetStage: PropertyStage) {
    const current = normalizeStage(property.commercial_stage ?? '')
    if (current === targetStage) return
    // Optimista: reflejamos el cambio antes de la respuesta.
    setProperties(prev => prev.map(p => p.id === property.id ? { ...p, commercial_stage: targetStage } : p))
    try {
      const res = await apiFetch('properties', `/properties/${property.id}/stage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commercial_stage: targetStage, override: true }),
      })
      const data = (await res.json().catch(() => ({}))) as any
      if (!res.ok || data.error) {
        toast(data.error || 'Error al cambiar etapa', 'error')
        loadProperties() // revertir al estado real
        return
      }
      toast(`${property.address} → ${PROPERTY_STAGES[targetStage]?.label}`)
      loadProperties()
    } catch {
      toast('Error de conexión', 'error')
      loadProperties()
    }
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }
  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const targetStage = String(over.id) as PropertyStage
    if (!KANBAN_STAGES.includes(targetStage)) return
    const property = properties.find(p => p.id === active.id)
    if (property) moveToStage(property, targetStage)
  }

  const switchView = (v: ViewMode) => { setView(v); localStorage.setItem('pipeline_view', v) }
  const activeCount = properties.filter(p => KANBAN_STAGES.includes(normalizeStage(p.commercial_stage ?? '') as PropertyStage)).length
  const activeProperty = activeId ? properties.find(p => p.id === activeId) : null

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pipeline comercial"
        subtitle={`${activeCount} propiedades · arrastrá las tarjetas entre columnas`}
        actions={
          <div className="flex gap-1 border rounded-control p-1 shrink-0">
            <button onClick={() => switchView('kanban')} title="Vista Kanban"
              className={`p-1.5 rounded transition-colors ${view === 'kanban' ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => switchView('tabla')} title="Vista Tabla"
              className={`p-1.5 rounded transition-colors ${view === 'tabla' ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}>
              <Table2 className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {KANBAN_STAGES.slice(0, 4).map(s => <div key={s} className="h-64 bg-gray-200 rounded-card animate-pulse" />)}
        </div>
      ) : view === 'kanban' ? (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="overflow-x-auto pb-3">
            <div className="flex gap-4 w-max">
              {KANBAN_STAGES.map(stage => (
                <KanbanColumn key={stage} stage={stage} items={byStage[stage] || []} activeId={activeId} />
              ))}
            </div>
          </div>
          <DragOverlay dropAnimation={null}>
            {activeProperty ? <div className="w-72"><CardBody p={activeProperty} dragging /></div> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <Card padded={false} className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <SortHeader label="Etapa" sortKey="stage" sort={sort} onSort={toggleSort} />
                <SortHeader label="Dirección" sortKey="address" sort={sort} onSort={toggleSort} />
                <SortHeader label="Barrio" sortKey="neighborhood" sort={sort} onSort={toggleSort} className="hidden sm:table-cell" />
                <SortHeader label="Precio" sortKey="price" sort={sort} onSort={toggleSort} />
                <SortHeader label="Propietario" sortKey="owner" sort={sort} onSort={toggleSort} className="hidden md:table-cell" />
              </tr>
            </thead>
            <tbody>
              {sortedProperties.length === 0 ? (
                <tr><td colSpan={5}><EmptyState title="Sin propiedades" /></td></tr>
              ) : sortedProperties.map((p) => {
                const stage = normalizeStage(p.commercial_stage ?? '') as PropertyStage
                const age = daysSince(p.updated_at)
                const isTerminal = stage === 'vendida' || stage === 'suspendida' || stage === 'perdida'
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <PropertyStageBadge stage={stage} />
                    </td>
                    <td className="px-4 py-2.5 max-w-[200px]">
                      <Link href={`/propiedades/${p.id}`} className="font-medium text-ink hover:text-primary truncate block">
                        {p.address}
                      </Link>
                      {isTerminal && age >= ARCHIVE_WARN_DAYS && (
                        <span className="text-[10px] text-amber-500">{age} días sin cambios</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">{p.neighborhood || '—'}</td>
                    <td className="px-4 py-2.5 text-primary font-medium whitespace-nowrap">
                      {p.asking_price ? formatCurrency(p.asking_price, p.currency) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 hidden md:table-cell max-w-[160px] truncate">{p.owner_name || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

// ── Columna droppable ───────────────────────────────────────────
function KanbanColumn({ stage, items, activeId }: { stage: PropertyStage; items: any[]; activeId: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const cfg = PROPERTY_STAGES[stage]
  return (
    <div className="w-72 shrink-0 flex flex-col">
      <div className="flex items-center justify-between mb-2 px-3 py-2 rounded-control bg-white">
        <span className="flex items-center gap-2 text-sm font-medium text-ink truncate">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} aria-hidden />
          {cfg.label}
        </span>
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ml-2 shrink-0 ${cfg.color}`}>{items.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 min-h-[180px] max-h-[calc(100dvh-15rem)] overflow-y-auto rounded-card border p-2 transition-colors ${
          isOver ? 'bg-primary/5 border-primary ring-2 ring-primary/20' : 'bg-gray-50 border-gray-200'
        }`}
      >
        {items.map(p => <DraggableCard key={p.id} p={p} hidden={activeId === p.id} />)}
        {items.length === 0 && (
          <p className="text-xs text-gray-300 text-center py-10">Soltá una propiedad acá</p>
        )}
      </div>
    </div>
  )
}

// ── Card draggable ──────────────────────────────────────────────
function DraggableCard({ p, hidden }: { p: any; hidden: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: p.id })
  const style = { transform: CSS.Translate.toString(transform), opacity: hidden || isDragging ? 0.4 : 1 }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardBody p={p} />
    </div>
  )
}

// ── Contenido de la card (compartido con el DragOverlay) ────────
function CardBody({ p, dragging }: { p: any; dragging?: boolean }) {
  return (
    <div className={`bg-white border rounded-card p-3 select-none cursor-grab active:cursor-grabbing ${dragging ? 'shadow-pop ring-2 ring-primary/40' : 'border-gray-200'}`}>
      <div className="flex items-start gap-1.5">
        <GripVertical className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <Link
            href={`/propiedades/${p.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-medium text-ink hover:text-primary truncate block"
          >
            {p.address}
          </Link>
          <div className="text-xs text-gray-500 mt-1 space-y-0.5">
            {p.neighborhood && <p className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.neighborhood}</p>}
            {p.asking_price && (
              <p className="flex items-center gap-1 text-primary font-medium">
                <DollarSign className="w-3 h-3" />{formatCurrency(p.asking_price, p.currency)}
              </p>
            )}
            {p.owner_name && <p className="truncate">{p.owner_name}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
