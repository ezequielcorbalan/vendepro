'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { DollarSign, MapPin, ArrowRight, LayoutGrid, Table2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PROPERTY_STAGES, type PropertyStage } from '@/lib/crm-config'
import { formatCurrency } from '@/lib/utils'

const PIPELINE_STAGES: PropertyStage[] = ['captada', 'publicada', 'reservada', 'suspendida']

type ViewMode = 'kanban' | 'tabla'

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
    PIPELINE_STAGES.forEach(s => { map[s] = [] })
    properties.forEach(p => {
      if (map[p.stage]) map[p.stage].push(p)
    })
    return map
  }, [properties])

  const sortedProperties = useMemo(() =>
    [...properties]
      .filter(p => PIPELINE_STAGES.includes(p.stage))
      .sort((a, b) => (PROPERTY_STAGES[a.stage as PropertyStage]?.order ?? 99) - (PROPERTY_STAGES[b.stage as PropertyStage]?.order ?? 99)),
    [properties]
  )

  const advanceStage = async (property: any) => {
    const currentIdx = PIPELINE_STAGES.indexOf(property.stage)
    if (currentIdx < 0 || currentIdx >= PIPELINE_STAGES.length - 1) return
    const nextStage = PIPELINE_STAGES[currentIdx + 1]
    await apiFetch('properties', '/properties', {
      method: 'PUT',
      body: JSON.stringify({ id: property.id, stage: nextStage }),
    })
    const label = PROPERTY_STAGES[nextStage]?.label || nextStage
    toast(`${property.address} → ${label}`)
    loadProperties()
  }

  const switchView = (v: ViewMode) => {
    setView(v)
    localStorage.setItem('pipeline_view', v)
  }

  const activeCount = properties.filter(p => PIPELINE_STAGES.includes(p.stage)).length

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Pipeline comercial</h1>
          <p className="text-gray-500 text-sm mt-1">{activeCount} propiedades activas</p>
        </div>
        <div className="flex gap-1 border rounded-lg p-1 shrink-0">
          <button
            onClick={() => switchView('kanban')}
            title="Vista Kanban"
            className={`p-1.5 rounded transition-colors ${view === 'kanban' ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => switchView('tabla')}
            title="Vista Tabla"
            className={`p-1.5 rounded transition-colors ${view === 'tabla' ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Table2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PIPELINE_STAGES.map(s => <div key={s} className="h-64 bg-gray-200 rounded-xl animate-pulse" />)}
        </div>
      ) : view === 'kanban' ? (
        <div className="overflow-x-auto -mx-2 px-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-w-[800px]">
            {PIPELINE_STAGES.map(stage => {
              const stageCfg = PROPERTY_STAGES[stage]
              const stageProps = byStage[stage] || []
              return (
                <div key={stage} className="bg-gray-50 rounded-xl border p-3">
                  <div className={`flex items-center justify-between mb-3 px-2 py-1.5 rounded-lg ${stageCfg.color}`}>
                    <span className="text-xs font-semibold">{stageCfg.label}</span>
                    <span className="text-xs font-bold">{stageProps.length}</span>
                  </div>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {stageProps.map(p => (
                      <div key={p.id} className="bg-white border rounded-lg p-3">
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
                        {stage !== 'reservada' && stage !== 'suspendida' && (
                          <button onClick={() => advanceStage(p)}
                            className="mt-2 w-full py-1 text-[10px] text-[#ff007c] border border-[#ff007c]/30 rounded-lg hover:bg-pink-50 flex items-center justify-center gap-1">
                            Avanzar <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {stageProps.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">Sin propiedades</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
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
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-8">Sin propiedades</td>
                </tr>
              ) : (
                sortedProperties.map((p, i) => {
                  const stageCfg = PROPERTY_STAGES[p.stage as PropertyStage]
                  const canAdvance = p.stage !== 'reservada' && p.stage !== 'suspendida'
                  const prevStage = i > 0 ? sortedProperties[i - 1].stage : null
                  const isNewGroup = p.stage !== prevStage
                  return (
                    <>
                      {isNewGroup && i > 0 && (
                        <tr key={`sep-${p.stage}`} className="border-t-2 border-gray-100" />
                      )}
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
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">{p.neighborhood || '—'}</td>
                        <td className="px-4 py-2.5 text-[#ff007c] font-medium whitespace-nowrap">
                          {p.asking_price ? formatCurrency(p.asking_price, p.currency) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 hidden md:table-cell max-w-[160px] truncate">{p.owner_name || '—'}</td>
                        <td className="px-4 py-2.5 text-right">
                          {canAdvance && (
                            <button
                              onClick={() => advanceStage(p)}
                              className="text-[10px] text-[#ff007c] border border-[#ff007c]/30 rounded-lg px-2 py-1 hover:bg-pink-50 flex items-center gap-1 ml-auto"
                            >
                              Avanzar <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    </>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
