'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { PROPERTY_STAGES, type PropertyStage, PROPERTY_STAGE_KEYS } from '@/lib/crm-config'
import { useToast } from '@/components/ui/Toast'
import { Building2, ArrowRight, Eye, Phone, Filter, List, Columns, XCircle, Search, ChevronDown, ChevronRight } from 'lucide-react'

type Property = {
  id: string
  address: string
  neighborhood: string
  property_type: string
  owner_name: string
  asking_price: number | null
  commercial_stage: PropertyStage
  agent_name: string | null
  stage_changed_at: string | null
  updated_at: string
  authorization_start: string | null
  authorization_days: number | null
}

function authDaysRemaining(authStart: string | null, authDays: number | null): number | null {
  if (!authStart || !authDays) return null
  const end = new Date(authStart)
  end.setDate(end.getDate() + authDays)
  return Math.ceil((end.getTime() - Date.now()) / 86400000)
}

function daysInStage(stageChangedAt: string | null, updatedAt: string): number {
  const ref = stageChangedAt || updatedAt
  return Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000)
}

function formatPrice(price: number | null): string {
  if (!price) return '—'
  return 'USD ' + price.toLocaleString('es-AR')
}

function getNextStage(current: PropertyStage | null): PropertyStage | null {
  if (!current) return 'captada'
  const idx = PROPERTY_STAGE_KEYS.indexOf(current)
  if (idx < 0 || idx >= PROPERTY_STAGE_KEYS.length - 1) return null
  // Don't advance past vendida (vencida is terminal)
  const next = PROPERTY_STAGE_KEYS[idx + 1]
  if (next === 'vencida') return null
  return next
}

export default function PipelinePage() {
  const { toast } = useToast()
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'pipeline' | 'lista'>('lista')
  const [filterAgent, setFilterAgent] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterAuth, setFilterAuth] = useState<'' | 'expiring' | 'expired'>('')
  const [filterStage, setFilterStage] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [advancing, setAdvancing] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/properties')
      .then(r => (r.json()) as Promise<any>)
      .then(data => {
        const arr = Array.isArray(data) ? data : data.properties || []
        // Ensure each property has a valid commercial_stage
        setProperties(arr.map((p: any) => ({
          ...p,
          commercial_stage: p.commercial_stage || 'captada',
        })))
      })
      .catch(() => setError('Error al cargar propiedades'))
      .finally(() => setLoading(false))
  }, [])

  const agents = useMemo(() => {
    const set = new Set(properties.map(p => p.agent_name).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [properties])

  const types = useMemo(() => {
    const set = new Set(properties.map(p => p.property_type).filter(Boolean))
    return Array.from(set).sort()
  }, [properties])

  const filtered = useMemo(() => {
    const q = searchText.toLowerCase().trim()
    return properties.filter(p => {
      if (q) {
        const hay = [p.address, p.neighborhood, p.owner_name, p.agent_name, p.property_type]
          .filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (filterAgent && p.agent_name !== filterAgent) return false
      if (filterType && p.property_type !== filterType) return false
      if (filterStage && p.commercial_stage !== filterStage) return false
      if (filterAuth) {
        const remaining = authDaysRemaining(p.authorization_start, p.authorization_days)
        if (filterAuth === 'expired' && (remaining === null || remaining > 0)) return false
        if (filterAuth === 'expiring' && (remaining === null || remaining > 30 || remaining <= 0)) return false
      }
      return true
    })
  }, [properties, filterAgent, filterType, filterAuth, filterStage, searchText])

  const byStage = useMemo(() => {
    const map: Record<PropertyStage, Property[]> = {} as any
    for (const key of PROPERTY_STAGE_KEYS) map[key] = []
    for (const p of filtered) {
      const stage = (p.commercial_stage && map[p.commercial_stage]) ? p.commercial_stage : 'captada'
      map[stage].push(p)
    }
    return map
  }, [filtered])

  async function changeStage(property: Property, targetStage: PropertyStage) {
    setAdvancing(property.id)
    try {
      const res = await fetch('/api/properties', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: property.id, commercial_stage: targetStage }),
      })
      if (!res.ok) throw new Error()
      setProperties(prev =>
        prev.map(p =>
          p.id === property.id
            ? { ...p, commercial_stage: targetStage, stage_changed_at: new Date().toISOString() }
            : p
        )
      )
      toast(`${property.address} → ${PROPERTY_STAGES[targetStage].label}`, 'success')
    } catch {
      toast('Error al cambiar etapa', 'error')
    } finally {
      setAdvancing(null)
    }
  }

  function advanceStage(property: Property) {
    const next = getNextStage(property.commercial_stage)
    if (!next) return
    changeStage(property, next)
  }

  function markVencida(property: Property) {
    if (!confirm(`¿Marcar "${property.address}" como vencida?`)) return
    changeStage(property, 'vencida')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#ff007c] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl p-12 text-center shadow-sm">
        <Building2 className="w-12 h-12 text-red-300 mx-auto mb-3" />
        <p className="text-red-600 font-medium">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Pipeline Comercial</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} propiedad{filtered.length !== 1 ? 'es' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchText} onChange={e => setSearchText(e.target.value)}
              placeholder="Buscar dirección, barrio, propietario..."
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-48 sm:w-64 focus:ring-2 focus:ring-[#ff007c]/20 focus:border-[#ff007c] bg-white"
            />
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
              showFilters || filterAgent || filterType || filterAuth
                ? 'bg-[#ff007c]/10 border-[#ff007c]/30 text-[#ff007c]'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <Filter className="w-4 h-4" /> Filtros
          </button>
          <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setView('pipeline')}
              className={`px-3 py-2 text-sm transition-colors hidden sm:block ${
                view === 'pipeline' ? 'bg-[#ff007c] text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Columns className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('lista')}
              className={`px-3 py-2 text-sm transition-colors ${
                view === 'lista' ? 'bg-[#ff007c] text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap gap-3">
          <select
            value={filterAgent}
            onChange={e => setFilterAgent(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white min-w-[160px]"
          >
            <option value="">Todos los agentes</option>
            {agents.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white min-w-[160px]"
          >
            <option value="">Todos los tipos</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={filterAuth}
            onChange={e => setFilterAuth(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white min-w-[160px]"
          >
            <option value="">Autorización: todas</option>
            <option value="expiring">Por vencer (&lt;30d)</option>
            <option value="expired">Vencidas</option>
          </select>
          <select
            value={filterStage}
            onChange={e => setFilterStage(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white min-w-[160px]"
          >
            <option value="">Etapa: todas</option>
            <option value="archivada">Archivadas</option>
            <option value="suspendida">Suspendidas</option>
            <option value="vencida">Vencidas</option>
            <option value="vendida">Vendidas</option>
          </select>
          {(filterAgent || filterType || filterAuth) && (
            <button
              onClick={() => { setFilterAgent(''); setFilterType(''); setFilterAuth(''); setFilterStage('') }}
              className="text-sm text-[#ff007c] hover:underline px-2"
            >
              Limpiar
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
          <Building2 className="w-14 h-14 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay propiedades en el pipeline</p>
        </div>
      )}

      {/* Filtered stage view (archivadas, suspendidas, etc.) */}
      {filtered.length > 0 && filterStage && ['archivada', 'suspendida'].includes(filterStage) && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className={`text-sm font-bold uppercase tracking-wider px-3 py-1 rounded-full ${PROPERTY_STAGES[filterStage as PropertyStage]?.color || 'bg-gray-100 text-gray-600'}`}>
              {PROPERTY_STAGES[filterStage as PropertyStage]?.label || filterStage}
            </span>
            <span className="text-lg font-black text-gray-800">{filtered.length}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {filtered.map(p => (
              <PropertyCard
                key={p.id}
                property={p}
                onAdvance={() => advanceStage(p)}
                onMarkVencida={() => markVencida(p)}
                advancing={advancing === p.id}
                compact
              />
            ))}
          </div>
        </div>
      )}

      {/* Pipeline / Kanban view — optimized for 30-60 properties */}
      {filtered.length > 0 && view === 'pipeline' && !filterStage && (
        <div className="-mx-4 sm:-mx-6 px-4 sm:px-6">
        <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory lg:grid lg:grid-cols-5 lg:overflow-visible">
          {PROPERTY_STAGE_KEYS.filter(s => s !== 'archivada' && s !== 'suspendida' && s !== 'documentacion').map(stage => {
            const cfg = PROPERTY_STAGES[stage]
            const items = byStage[stage]
            return (
              <div key={stage} className="min-w-[260px] sm:min-w-[240px] lg:min-w-0 flex flex-col bg-gray-50/80 rounded-xl border border-gray-100 snap-start">
                <div className="px-3 py-2 border-b border-gray-200 sticky top-0 bg-gray-50/95 backdrop-blur-sm rounded-t-xl z-10">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <span className={`text-sm font-black ${items.length > 0 ? 'text-gray-800' : 'text-gray-300'}`}>{items.length}</span>
                  </div>
                </div>
                <div className="p-1.5 space-y-1 flex-1 overflow-y-auto max-h-[calc(100vh-220px)] scrollbar-thin">
                  {items.length === 0 && (
                    <p className="text-[10px] text-gray-300 text-center py-4">—</p>
                  )}
                  {items.map(p => {
                    const days = daysInStage(p.stage_changed_at, p.updated_at)
                    const next = getNextStage(p.commercial_stage)
                    const authRemaining = authDaysRemaining(p.authorization_start, p.authorization_days)
                    const authUrgent = authRemaining !== null && authRemaining <= 15
                    const authWarning = authRemaining !== null && authRemaining <= 30 && authRemaining > 15
                    const authExpired = authRemaining !== null && authRemaining <= 0
                    return (
                      <div key={p.id} className={`bg-white rounded-lg border px-2.5 py-2 hover:shadow-sm transition-all group cursor-pointer ${
                        authExpired ? 'border-red-300 bg-red-50/50' : authUrgent ? 'border-red-200' : authWarning ? 'border-yellow-200' : 'border-gray-100 hover:border-gray-300'
                      }`}>
                        <Link href={`/propiedades/${p.id}`} className="block">
                          <p className="text-xs font-semibold text-gray-800 truncate">{p.address}</p>
                          <p className="text-[10px] text-gray-400 truncate">{p.neighborhood} · {p.property_type}</p>
                        </Link>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] font-bold text-gray-600">{formatPrice(p.asking_price)}</span>
                          <div className="flex items-center gap-1.5">
                            {authRemaining !== null && (
                              <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                                authExpired ? 'bg-red-100 text-red-600' : authUrgent ? 'bg-red-50 text-red-500 animate-pulse' : authWarning ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600'
                              }`}>
                                {authExpired ? 'VENCIDA' : `${authRemaining}d auth`}
                              </span>
                            )}
                            <span className={`text-[9px] ${days > 30 ? 'text-red-500 font-bold' : 'text-gray-300'}`}>{days}d</span>
                          </div>
                        </div>
                        {/* Actions — show on hover */}
                        <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {next && (
                            <button onClick={(e) => { e.stopPropagation(); advanceStage(p) }} disabled={advancing === p.id}
                              className="text-[9px] font-medium text-[#ff007c] hover:text-[#ff8017] flex items-center gap-0.5">
                              <ArrowRight className="w-3 h-3" /> {PROPERTY_STAGES[next].label}
                            </button>
                          )}
                          {p.commercial_stage !== 'vencida' && p.commercial_stage !== 'vendida' && (
                            <button onClick={(e) => { e.stopPropagation(); markVencida(p) }}
                              className="ml-auto text-[9px] text-gray-300 hover:text-red-500">
                              <XCircle className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        </div>
      )}

      {/* List view — collapsible sections */}
      {filtered.length > 0 && view === 'lista' && !(filterStage && ['archivada', 'suspendida'].includes(filterStage)) && (
        <ListViewCollapsible byStage={byStage} advanceStage={advanceStage} markVencida={markVencida} advancing={advancing} />
      )}
    </div>
  )
}

function PropertyCard({
  property,
  onAdvance,
  onMarkVencida,
  advancing,
  compact,
}: {
  property: Property
  onAdvance: () => void
  onMarkVencida: () => void
  advancing: boolean
  compact?: boolean
}) {
  const days = daysInStage(property.stage_changed_at, property.updated_at)
  const next = getNextStage(property.commercial_stage)
  const urgent = days > 30

  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow transition-shadow ${
      compact ? 'p-2.5' : 'p-3'
    }`}>
      <div className={compact ? '' : 'flex items-start justify-between gap-3'}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{property.address}</p>
          <p className="text-xs text-gray-500 truncate">
            {property.neighborhood} &middot; {property.property_type || 'Sin tipo'}
          </p>
          {property.owner_name && (
            <p className="text-xs text-gray-400 truncate mt-0.5">
              <Phone className="w-3 h-3 inline mr-0.5 -mt-px" />
              {property.owner_name}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-xs font-semibold text-gray-700">
              {formatPrice(property.asking_price)}
            </span>
            {property.agent_name && (
              <span className="text-xs text-gray-400">{property.agent_name}</span>
            )}
            <span className={`text-xs ${urgent ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
              {days}d en etapa
            </span>
          </div>
        </div>
        {!compact && next && (
          <button
            onClick={onAdvance}
            disabled={advancing}
            className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-[#ff007c] hover:text-[#ff8017] disabled:opacity-50 transition-colors mt-1"
          >
            {advancing ? '...' : <><ArrowRight className="w-3.5 h-3.5" /> Avanzar</>}
          </button>
        )}
      </div>
      {/* Actions row */}
      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100">
        <Link
          href={`/propiedades/${property.id}`}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#ff007c] transition-colors"
        >
          <Eye className="w-3.5 h-3.5" /> Ver
        </Link>
        {property.commercial_stage !== 'vencida' && property.commercial_stage !== 'vendida' && (
          <button
            onClick={onMarkVencida}
            disabled={advancing}
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" /> Vencida
          </button>
        )}
        {compact && next && (
          <button
            onClick={onAdvance}
            disabled={advancing}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-[#ff007c] hover:text-[#ff8017] disabled:opacity-50 transition-colors"
          >
            {advancing ? '...' : <><ArrowRight className="w-3.5 h-3.5" /> {PROPERTY_STAGES[next].label}</>}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Collapsible List View ──
function ListViewCollapsible({ byStage, advanceStage, markVencida, advancing }: {
  byStage: Record<string, Property[]>
  advanceStage: (p: Property) => void
  markVencida: (p: Property) => void
  advancing: string | null
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggle = (stage: string) => setExpanded(prev => ({ ...prev, [stage]: !prev[stage] }))

  // Auto-expand stages with items on first render
  useState(() => {
    const initial: Record<string, boolean> = {}
    for (const stage of PROPERTY_STAGE_KEYS) {
      if (byStage[stage]?.length > 0) initial[stage] = false // collapsed by default
    }
    // Expand first stage with items
    const firstWithItems = PROPERTY_STAGE_KEYS.find(s => byStage[s]?.length > 0)
    if (firstWithItems) initial[firstWithItems] = true
    setExpanded(initial)
  })

  return (
    <div className="space-y-2">
      {PROPERTY_STAGE_KEYS.filter(s => s !== 'archivada' && s !== 'suspendida' && s !== 'documentacion').map(stage => {
        const items = byStage[stage] || []
        if (items.length === 0) return null
        const cfg = PROPERTY_STAGES[stage]
        const isExpanded = expanded[stage] ?? false

        return (
          <div key={stage} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {/* Collapsible header */}
            <button
              onClick={() => toggle(stage)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isExpanded
                  ? <ChevronDown className="w-4 h-4 text-gray-400" />
                  : <ChevronRight className="w-4 h-4 text-gray-400" />
                }
                <span className={`text-sm font-bold uppercase tracking-wider px-3 py-1 rounded-full ${cfg.color}`}>
                  {cfg.label}
                </span>
              </div>
              <span className={`text-lg font-black ${items.length > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                {items.length}
              </span>
            </button>

            {/* Cards */}
            {isExpanded && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {items.map(p => (
                  <PropertyCard
                    key={p.id}
                    property={p}
                    onAdvance={() => advanceStage(p)}
                    onMarkVencida={() => markVencida(p)}
                    advancing={advancing === p.id}
                    compact
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
