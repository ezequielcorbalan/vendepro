'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FileText, ArrowRight, User, Building2, Filter, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { LEAD_STAGES, PROPERTY_STAGES } from '@/lib/crm-config'
import { apiFetch } from '@/lib/api'

const ENTITY_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  lead: { label: 'Lead', icon: User, color: 'bg-blue-50 text-blue-700' },
  property: { label: 'Propiedad', icon: Building2, color: 'bg-green-50 text-green-700' },
}

function stageLabel(entityType: string, stage: string): string {
  if (entityType === 'lead') return (LEAD_STAGES as any)[stage]?.label || stage
  if (entityType === 'property') return (PROPERTY_STAGES as any)[stage]?.label || stage
  return stage
}

function stageColor(entityType: string, stage: string): string {
  if (entityType === 'lead') return (LEAD_STAGES as any)[stage]?.color || 'bg-gray-100 text-gray-600'
  if (entityType === 'property') return (PROPERTY_STAGES as any)[stage]?.color || 'bg-gray-100 text-gray-600'
  return 'bg-gray-100 text-gray-600'
}

export default function AuditoriaPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('')
  const [page, setPage] = useState(0)
  const limit = 30

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('limit', String(limit))
    params.set('offset', String(page * limit))
    if (filterType) params.set('entity_type', filterType)
    apiFetch('crm', `/audit?${params}`)
      .then(r => r.json() as Promise<any>)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [filterType, page])

  const results = data?.results || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#ff007c]" /> Auditoría
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{total} cambios de estado registrados</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setPage(0) }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Todos</option>
            <option value="lead">Leads</option>
            <option value="property">Propiedades</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 animate-spin text-[#ff007c]" />
        </div>
      ) : results.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <FileText className="w-14 h-14 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay registros de auditoría</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="divide-y divide-gray-50">
              {results.map((r: any) => {
                const cfg = ENTITY_LABELS[r.entity_type] || ENTITY_LABELS.lead
                const Icon = cfg.icon
                const time = new Date(r.created_at).toLocaleString('es-AR', {
                  day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
                })
                const entityLink = r.entity_type === 'lead'
                  ? `/leads/${r.entity_id}`
                  : r.entity_type === 'property'
                  ? `/propiedades/${r.entity_id}`
                  : '#'

                return (
                  <div key={r.id} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-50/50">
                    <div className={`flex-shrink-0 p-1.5 rounded-lg ${cfg.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={entityLink} className="text-sm font-medium text-gray-800 hover:text-[#ff007c] truncate">
                          {r.entity_name || r.entity_id?.slice(0, 8)}
                        </Link>
                        <span className="text-[10px] text-gray-400">{cfg.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {r.from_stage ? (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${stageColor(r.entity_type, r.from_stage)}`}>
                            {stageLabel(r.entity_type, r.from_stage)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-300">nuevo</span>
                        )}
                        <ArrowRight className="w-3 h-3 text-gray-300" />
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${stageColor(r.entity_type, r.to_stage)}`}>
                          {stageLabel(r.entity_type, r.to_stage)}
                        </span>
                      </div>
                      {r.notes && <p className="text-[10px] text-gray-400 mt-1 truncate">{r.notes}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-gray-400">{time}</p>
                      <p className="text-[10px] text-gray-500 font-medium">{r.changed_by_name || 'Sistema'}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-400">Página {page + 1} de {totalPages}</p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
