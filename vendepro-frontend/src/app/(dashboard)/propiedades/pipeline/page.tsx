'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { DollarSign, MapPin, LayoutGrid, Table2, GripVertical } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { scopeQueryString } from '@/lib/agent-scope'
import { useToast } from '@/components/ui/Toast'
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

  const sortedProperties = useMemo(() =>
    [...properties]
      .filter(p => KANBAN_STAGES.includes(normalizeStage(p.commercial_stage ?? '') as PropertyStage))
      .sort((a, b) => (PROPERTY_STAGES[normalizeStage(a.commercial_stage ?? '') as PropertyStage]?.order ?? 99) - (PROPERTY_STAGES[normalizeStage(b.commercial_stage ?? '') as PropertyStage]?.order ?? 99)),
    [properties]
  )

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Pipeline comercial</h1>
          <p className="text-gray-500 text-sm mt-1">{activeCount} propiedades · arrastrá las tarjetas entre columnas</p>
        </div>
        <div className="flex gap-1 border rounded-lg p-1 shrink-0">
          <button onClick={() => switchView('kanban')} title="Vista Kanban"
            className={`p-1.5 rounded transition-colors ${view === 'kanban' ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}>
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button onClick={() => switchView('tabla')} title="Vista Tabla"
            className={`p-1.5 rounded transition-colors ${view === 'tabla' ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}>
            <Table2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {KANBAN_STAGES.slice(0, 4).map(s => <div key={s} className="h-64 bg-gray-200 rounded-xl animate-pulse" />)}
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
            {activeProperty ? <div className="w-64"><CardBody p={activeProperty} dragging /></div> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5 font-medium">Etapa</th>
                <th className="text-left px-4 py-2.5 font-medium">Dirección</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Barrio</th>
                <th className="text-left px-4 py-2.5 font-medium">Precio</th>
                <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Propietario</th>
              </tr>
            </thead>
            <tbody>
              {sortedProperties.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-gray-400 py-8">Sin propiedades</td></tr>
              ) : sortedProperties.map((p) => {
                const stage = normalizeStage(p.commercial_stage ?? '') as PropertyStage
                const stageCfg = PROPERTY_STAGES[stage]
                const age = daysSince(p.updated_at)
                const isTerminal = stage === 'vendida' || stage === 'suspendida' || stage === 'perdida'
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${stageCfg?.color}`}>
                        {stageCfg?.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 max-w-[200px]">
                      <Link href={`/propiedades/${p.id}`} className="font-medium text-gray-800 hover:text-[#ff007c] truncate block">
                        {p.address}
                      </Link>
                      {isTerminal && age >= ARCHIVE_WARN_DAYS && (
                        <span className="text-[10px] text-amber-500">{age} días sin cambios</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">{p.neighborhood || '—'}</td>
                    <td className="px-4 py-2.5 text-[#ff007c] font-medium whitespace-nowrap">
                      {p.asking_price ? formatCurrency(p.asking_price, p.currency) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 hidden md:table-cell max-w-[160px] truncate">{p.owner_name || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Columna droppable ───────────────────────────────────────────
function KanbanColumn({ stage, items, activeId }: { stage: PropertyStage; items: any[]; activeId: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const cfg = PROPERTY_STAGES[stage]
  return (
    <div className="w-64 shrink-0 flex flex-col">
      <div className={`flex items-center justify-between mb-2 px-3 py-2 rounded-lg ${cfg.color}`}>
        <span className="text-xs font-semibold uppercase tracking-wide truncate">{cfg.label}</span>
        <span className="text-xs font-bold tabular-nums ml-2 shrink-0">{items.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 min-h-[180px] max-h-[calc(100dvh-15rem)] overflow-y-auto rounded-xl border p-2 transition-colors ${
          isOver ? 'bg-pink-50 border-[#ff007c] ring-2 ring-[#ff007c]/20' : 'bg-gray-50 border-gray-200'
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
    <div className={`bg-white border rounded-lg p-3 select-none cursor-grab active:cursor-grabbing ${dragging ? 'shadow-lg ring-2 ring-[#ff007c]/40' : 'border-gray-200'}`}>
      <div className="flex items-start gap-1.5">
        <GripVertical className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <Link
            href={`/propiedades/${p.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-medium text-gray-800 hover:text-[#ff007c] truncate block"
          >
            {p.address}
          </Link>
          <div className="text-xs text-gray-400 mt-1 space-y-0.5">
            {p.neighborhood && <p className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.neighborhood}</p>}
            {p.asking_price && (
              <p className="flex items-center gap-1 text-[#ff007c] font-medium">
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
