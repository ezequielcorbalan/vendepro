'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Building2, Search, AlertTriangle, Check, CheckCircle2 } from 'lucide-react'

const REPORT_DEADLINE_DAYS = 20

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return null
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
}

function lastReportInfo(p: any) {
  // Use the most recent of: last_report_at (CRM) or last_external_report_at
  const dates: Date[] = []
  if (p.last_report_at) {
    const d = new Date(p.last_report_at)
    if (!isNaN(d.getTime())) dates.push(d)
  }
  if (p.last_external_report_at) {
    const d = new Date(p.last_external_report_at)
    if (!isNaN(d.getTime())) dates.push(d)
  }
  if (dates.length === 0) return { days: null, isExternal: false }
  const mostRecent = new Date(Math.max(...dates.map(d => d.getTime())))
  const days = Math.floor((Date.now() - mostRecent.getTime()) / (1000 * 60 * 60 * 24))
  const isExternal = !!(p.last_external_report_at && (!p.last_report_at || new Date(p.last_external_report_at) > new Date(p.last_report_at)))
  return { days, isExternal }
}

const statusLabel: Record<string, string> = {
  active: 'Activas',
  sold: 'Vendidas',
  suspended: 'Pausadas',
  archived: 'Archivadas',
  inactive: 'Dadas de baja',
}
const statusColor: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  sold: 'bg-pink-100 text-pink-700',
  suspended: 'bg-yellow-100 text-yellow-700',
  archived: 'bg-gray-100 text-gray-500',
  inactive: 'bg-red-100 text-red-700',
}

const stageLabel: Record<string, string> = {
  captada: 'Captadas',
  publicada: 'Publicadas',
  reservada: 'Reservadas',
  vendida: 'Vendidas',
  vencida: 'Vencidas',
  suspendida: 'Suspendidas',
  archivada: 'Archivadas',
  documentacion: 'En documentación',
}
const stageColor: Record<string, string> = {
  captada: 'bg-green-100 text-green-700',
  publicada: 'bg-blue-100 text-blue-700',
  reservada: 'bg-purple-100 text-purple-700',
  vendida: 'bg-emerald-100 text-emerald-700',
  vencida: 'bg-red-100 text-red-700',
  suspendida: 'bg-orange-100 text-orange-700',
  archivada: 'bg-gray-100 text-gray-500',
  documentacion: 'bg-amber-100 text-amber-700',
}

// Stages que NO se consideran "Activas" en el listado normal
const INACTIVE_STAGES = new Set(['vendida', 'archivada', 'suspendida', 'vencida'])

export default function PropertyFilters({ properties }: { properties: any[] }) {
  // Default: "active" (excluye vendidas, archivadas, suspendidas, vencidas)
  const [filter, setFilter] = useState<string>('active')
  const [searchText, setSearchText] = useState('')
  // Local override of last_external_report_at (for optimistic updates)
  const [externalMarks, setExternalMarks] = useState<Record<string, string | null>>({})

  async function toggleExternal(propertyId: string, currentlyMarked: boolean) {
    if (currentlyMarked) {
      setExternalMarks(prev => ({ ...prev, [propertyId]: null }))
      try { await fetch(`/api/properties/${propertyId}/external-report`, { method: 'DELETE' }) } catch {}
    } else {
      const nowIso = new Date().toISOString()
      setExternalMarks(prev => ({ ...prev, [propertyId]: nowIso }))
      try { await fetch(`/api/properties/${propertyId}/external-report`, { method: 'POST' }) } catch {}
    }
  }

  function effectiveProperty(p: any) {
    if (externalMarks[p.id] !== undefined) {
      return { ...p, last_external_report_at: externalMarks[p.id] }
    }
    return p
  }

  // Counts
  const { activeCount, stageCounts, statusCounts } = useMemo(() => {
    const sCount: Record<string, number> = {}
    const stCount: Record<string, number> = {}
    let active = 0
    for (const p of properties) {
      stCount[p.status] = (stCount[p.status] || 0) + 1
      const stage = p.commercial_stage || 'captada'
      sCount[stage] = (sCount[stage] || 0) + 1
      if (!INACTIVE_STAGES.has(stage) && p.status !== 'archived' && p.status !== 'inactive' && p.status !== 'sold' && p.status !== 'suspended') {
        active++
      }
    }
    return { activeCount: active, stageCounts: sCount, statusCounts: stCount }
  }, [properties])

  const filtered = properties.filter(p => {
    const stage = p.commercial_stage || 'captada'

    if (filter === 'active') {
      // Excluir inactivas
      if (INACTIVE_STAGES.has(stage)) return false
      if (p.status === 'archived' || p.status === 'inactive' || p.status === 'sold' || p.status === 'suspended') return false
    } else if (filter !== 'all' && filter.startsWith('stage:')) {
      const targetStage = filter.replace('stage:', '')
      if (stage !== targetStage) return false
    } else if (filter !== 'all' && filter !== 'active') {
      if (p.status !== filter) return false
    }

    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      const hay = [p.address, p.neighborhood, p.owner_name, p.agent_name, p.property_type]
        .filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
  // Sort: urgentes (sin reportes hace +20 días) primero, luego por días desde último reporte
  .map(effectiveProperty)
  .sort((a, b) => {
    const aInfo = lastReportInfo(a)
    const bInfo = lastReportInfo(b)
    // Sin reportes = más urgente
    const aDays = aInfo.days === null ? 9999 : aInfo.days
    const bDays = bInfo.days === null ? 9999 : bInfo.days
    return bDays - aDays // más días sin reportar = arriba
  })

  // Count overdue (sin reportes hace +20 días)
  const overdueCount = filtered.filter(p => {
    const info = lastReportInfo(p)
    return info.days === null || info.days >= REPORT_DEADLINE_DAYS
  }).length

  // Stages relevantes para reportes (las que requieren seguimiento)
  // Pipeline comercial muestra todas - acá solo las que tienen sentido para reportes quincenales
  const reportableStages = ['captada', 'publicada', 'reservada']
  const visibleStages = reportableStages.filter(s => stageCounts[s] > 0)

  return (
    <div>
      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={searchText} onChange={e => setSearchText(e.target.value)}
          placeholder="Buscar dirección, barrio, propietario, agente..."
          className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#ff007c]/20 focus:border-[#ff007c] bg-white"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter('active')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            filter === 'active' ? 'bg-gray-800 text-white' : 'bg-green-100 text-green-700 hover:opacity-80'
          }`}
        >
          Activas ({activeCount})
        </button>
        {visibleStages.map(stage => (
          <button
            key={stage}
            onClick={() => setFilter(`stage:${stage}`)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === `stage:${stage}` ? 'bg-gray-800 text-white' : `${stageColor[stage] || 'bg-gray-100 text-gray-600'} hover:opacity-80`
            }`}
          >
            {stageLabel[stage] || stage} ({stageCounts[stage]})
          </button>
        ))}
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            filter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Todas ({properties.length})
        </button>
      </div>

      {/* Banner de alerta global */}
      {overdueCount > 0 && (filter === 'active' || filter === 'all') && (
        <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold text-orange-800">{overdueCount} propiedad{overdueCount !== 1 ? 'es' : ''} sin reportar</span>
            <span className="text-orange-600"> · Hace más de {REPORT_DEADLINE_DAYS} días sin reportes (CRM o externos)</span>
          </div>
        </div>
      )}

      {/* Property grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((property: any) => {
          const info = lastReportInfo(property)
          const isOverdue = info.days === null || info.days >= REPORT_DEADLINE_DAYS
          const isWarning = info.days !== null && info.days >= 14 && info.days < REPORT_DEADLINE_DAYS
          const externalMarked = !!property.last_external_report_at

          return (
            <div key={property.id} className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden ${property.status === 'inactive' ? 'opacity-60' : ''} ${isOverdue ? 'ring-2 ring-orange-300' : ''}`}>
              <Link href={`/propiedades/${property.id}`}>
                <div className="h-40 bg-gradient-to-br from-brand-pink/20 to-brand-orange/20 flex items-center justify-center relative">
                  <Building2 className="w-12 h-12 text-brand-pink/40" />
                  {isOverdue && (
                    <div className="absolute top-2 left-2 bg-orange-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full flex items-center gap-1 shadow-md">
                      <AlertTriangle className="w-3 h-3" /> {info.days === null ? 'Sin reportes' : `Hace ${info.days}d`}
                    </div>
                  )}
                  {isWarning && !isOverdue && (
                    <div className="absolute top-2 left-2 bg-yellow-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full flex items-center gap-1 shadow-md">
                      Hace {info.days}d
                    </div>
                  )}
                </div>
              </Link>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[property.status] || 'bg-gray-100 text-gray-500'}`}>
                    {statusLabel[property.status]?.replace(/s$/, '') || property.status}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-brand-gray">{property.report_count || 0} reportes</span>
                    {externalMarked && (
                      <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full font-medium" title={`Marcado como hecho fuera del CRM el ${new Date(property.last_external_report_at).toLocaleDateString('es-AR')}`}>+1 ext</span>
                    )}
                  </div>
                </div>
                <Link href={`/propiedades/${property.id}`}>
                  <h3 className="font-semibold text-gray-800 mb-1 hover:text-brand-pink transition-colors">{property.address}</h3>
                  <p className="text-sm text-brand-gray">{property.neighborhood} · {property.property_type}</p>
                  {property.asking_price && (
                    <p className="text-sm font-medium text-brand-pink mt-2">{property.currency} {Number(property.asking_price).toLocaleString('es-AR')}</p>
                  )}
                  {property.agent_name && <p className="text-xs text-brand-gray mt-2">Agente: {property.agent_name}</p>}
                  {info.days !== null && (
                    <p className={`text-xs mt-1 ${isOverdue ? 'text-orange-600 font-medium' : isWarning ? 'text-yellow-700' : 'text-gray-400'}`}>
                      Último reporte: hace {info.days} día{info.days !== 1 ? 's' : ''}{info.isExternal ? ' (externo)' : ''}
                    </p>
                  )}
                </Link>

                {/* Acción: marcar como hecho fuera del CRM */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <Link href={`/propiedades/${property.id}/reportes/nuevo`}
                    className="text-xs text-brand-pink font-medium hover:underline">
                    + Nuevo reporte
                  </Link>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleExternal(property.id, externalMarked) }}
                    className={`text-xs flex items-center gap-1 px-2.5 py-1 rounded-full transition-colors ${
                      externalMarked
                        ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                        : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                    }`}
                    title={externalMarked ? 'Marcado como hecho. Click para deshacer.' : 'Marcar como hecho fuera del CRM'}
                  >
                    {externalMarked ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                    {externalMarked ? 'Hecho externo' : 'Hecho fuera'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-xl p-8 text-center shadow-sm">
          <p className="text-brand-gray">No hay propiedades con este filtro</p>
        </div>
      )}
    </div>
  )
}
