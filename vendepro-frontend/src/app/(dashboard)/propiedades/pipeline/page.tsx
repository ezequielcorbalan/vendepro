'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { DollarSign, MapPin, ArrowRight, LayoutGrid, Table2, Archive } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PROPERTY_STAGES, type PropertyStage } from '@/lib/crm-config'
import { formatCurrency } from '@/lib/utils'

// Progresión lineal del pipeline — captacion → publicada → reservada → vendida
const MAIN_STAGES: PropertyStage[] = ['captacion', 'publicada', 'reservada', 'vendida']
// Suspendida aparece aparte — solo se puede archivar, no avanzar
const ALL_PIPELINE_STAGES: PropertyStage[] = [...MAIN_STAGES, 'suspendida']
// Días sin cambio para mostrar alerta de archivo
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

  useEffect(() => {
    const saved = localStorage.getItem('pipeline_view') as ViewMode | null
    if (saved === 'kanban' || saved === 'tabla') setView(saved)
  }, [])

  function loadProperties() {
    apiFetch('properties', '/properties')
      .then(r => r.json() as Promise<any>)
      .then(d => { setProperties(Array.isArray(d) ? d : (d.properties || [])); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadProperties() }, [])

  const byStage = useMemo(() => {
    const map: Record<string, any[]> = {}
    ALL_PIPELINE_STAGES.forEach(s => { map[s] = [] })
    properties.forEach(p => {
      const s = p.commercial_stage
      if (s && map[s]) map[s].push(p)
    })
    return map
  }, [properties])

  const sortedProperties = useMemo(() =>
    [...properties]
      .filter(p => ALL_PIPELINE_STAGES.includes(p.commercial_stage))
      .sort((a, b) => (PROPERTY_STAGES[a.commercial_stage as PropertyStage]?.order ?? 99) - (PROPERTY_STAGES[b.commercial_stage as PropertyStage]?.order ?? 99)),
    [properties]
  )

  async function advanceStage(property: any) {
    const currentIdx = MAIN_STAGES.indexOf(property.commercial_stage)
    if (currentIdx < 0 || currentIdx >= MAIN_STAGES.length - 1) return
    const nextStage = MAIN_STAGES[currentIdx + 1]
    await apiFetch('properties', `/properties/${property.id}/stage`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commercial_stage: nextStage }),
    })
    toast(`${property.address} → ${PROPERTY_STAGES[nextStage]?.label}`)
    loadProperties()
  }

  async function archiveProperty(property: any) {
    if (!confirm(`¿Archivar "${property.address}"? Se moverá a propiedades archivadas.`)) return
    await apiFetch('properties', `/properties/${property.id}/stage`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commercial_stage: 'archivada' }),
    })
    toast(`${property.address} archivada`)
    loadProperties()
  }

  const switchView = (v: ViewMode) => { setView(v); localStorage.setItem('pipeline_view', v) }

  const activeCount = properties.filter(p => ALL_PIPELINE_STAGES.includes(p.commercial_stage)).length
  const suspendidas = byStage['suspendida'] || []

  function PropertyCard({ p, stage }: { p: any; stage: PropertyStage }) {
    const isTerminal = stage === 'vendida' || stage === 'suspendida'
    const canAdvance = MAIN_STAGES.includes(stage) && stage !== 'vendida'
    const age = daysSince(p.updated_at)
    const warnArchive = isTerminal && age >= ARCHIVE_WARN_DAYS

    return (
      <div className={`bg-white border rounded-lg p-3 ${warnArchive ? 'border-amber-300' : ''}`}>
        <Link href={`/propiedades/${p.id}`}>
          <p className="text-sm font-medium text-gray-800 truncate">{p.address}</p>
          <div className="text-xs text-gray-400 mt-1 space-y-0.5">
            {p.neighborhood && <p className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.neighborhood}</p>}
            {p.asking_price && (
              <p className="flex items-center gap-1 text-[#ff007c] font-medium">
                <DollarSign className="w-3 h-3" />{formatCurrency(p.asking_price, p.currency)}
              </p>
            )}
            {p.owner_name && <p className="truncate">{p.owner_name}</p>}
          </div>
        </Link>
        {warnArchive && (
          <p className="text-[10px] text-amber-600 mt-1.5 font-medium">{age} días sin cambios</p>
        )}
        <div className="mt-2 flex gap-1">
          {canAdvance && (
            <button onClick={() => advanceStage(p)}
              className="flex-1 py-1 text-[10px] text-[#ff007c] border border-[#ff007c]/30 rounded-lg hover:bg-pink-50 flex items-center justify-center gap-1">
              Avanzar <ArrowRight className="w-3 h-3" />
            </button>
          )}
          {isTerminal && (
            <button onClick={() => archiveProperty(p)}
              className="flex-1 py-1 text-[10px] text-gray-400 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-1">
              <Archive className="w-3 h-3" /> Archivar
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Pipeline comercial</h1>
          <p className="text-gray-500 text-sm mt-1">{activeCount} propiedades activas</p>
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
          {MAIN_STAGES.map(s => <div key={s} className="h-64 bg-gray-200 rounded-xl animate-pulse" />)}
        </div>
      ) : view === 'kanban' ? (
        <>
          {/* Pipeline principal: captacion → publicada → reservada → vendida */}
          <div className="overflow-x-auto -mx-2 px-2">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 min-w-[700px]">
              {MAIN_STAGES.map(stage => {
                const stageCfg = PROPERTY_STAGES[stage]
                const stageProps = byStage[stage] || []
                return (
                  <div key={stage} className="bg-gray-50 rounded-xl border p-3">
                    <div className={`flex items-center justify-between mb-3 px-2 py-1.5 rounded-lg ${stageCfg.color}`}>
                      <span className="text-xs font-semibold">{stageCfg.label}</span>
                      <span className="text-xs font-bold">{stageProps.length}</span>
                    </div>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                      {stageProps.map(p => <PropertyCard key={p.id} p={p} stage={stage} />)}
                      {stageProps.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-4">Sin propiedades</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Suspendidas — sección separada */}
          {suspendidas.length > 0 && (
            <div className="border border-orange-200 rounded-xl bg-orange-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PROPERTY_STAGES.suspendida.color}`}>
                  Suspendidas
                </span>
                <span className="text-xs text-gray-400">{suspendidas.length} — archivar cuando estén resueltas</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {suspendidas.map(p => <PropertyCard key={p.id} p={p} stage="suspendida" />)}
              </div>
            </div>
          )}
        </>
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
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {sortedProperties.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-gray-400 py-8">Sin propiedades</td></tr>
              ) : sortedProperties.map((p, i) => {
                const stage = p.commercial_stage as PropertyStage
                const stageCfg = PROPERTY_STAGES[stage]
                const isTerminal = stage === 'vendida' || stage === 'suspendida'
                const canAdvance = MAIN_STAGES.includes(stage) && stage !== 'vendida'
                const prevStage = i > 0 ? sortedProperties[i - 1].commercial_stage : null
                const isNewGroup = stage !== prevStage
                const age = daysSince(p.updated_at)
                return (
                  <>
                    {isNewGroup && i > 0 && <tr key={`sep-${stage}-${i}`} className="border-t-2 border-gray-100" />}
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
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex gap-1 justify-end">
                          {canAdvance && (
                            <button onClick={() => advanceStage(p)}
                              className="text-[10px] text-[#ff007c] border border-[#ff007c]/30 rounded-lg px-2 py-1 hover:bg-pink-50 flex items-center gap-1">
                              Avanzar <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                          {isTerminal && (
                            <button onClick={() => archiveProperty(p)}
                              className="text-[10px] text-gray-400 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50 flex items-center gap-1">
                              <Archive className="w-3 h-3" /> Archivar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
