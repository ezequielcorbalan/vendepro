'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Building2, DollarSign, MapPin, ChevronRight, ArrowRight } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PROPERTY_STAGES, type PropertyStage } from '@/lib/crm-config'
import { formatCurrency } from '@/lib/utils'

const PIPELINE_STAGES: PropertyStage[] = ['captada', 'publicada', 'reservada', 'suspendida']

export default function PipelinePage() {
  const { toast } = useToast()
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Pipeline comercial</h1>
        <p className="text-gray-500 text-sm mt-1">{properties.filter(p => PIPELINE_STAGES.includes(p.stage)).length} propiedades activas</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PIPELINE_STAGES.map(s => <div key={s} className="h-64 bg-gray-200 rounded-xl animate-pulse" />)}
        </div>
      ) : (
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
      )}
    </div>
  )
}
