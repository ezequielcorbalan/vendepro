'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileBarChart, Plus, ArrowRight } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface Report {
  id: string
  period_label?: string | null
  period_start?: string | null
  period_end?: string | null
  status?: string
  published_at?: string | null
  impressions?: number
  portal_visits?: number
  in_person_visits?: number
  offers?: number
}

interface Props {
  propertyId: string
}

export default function ReportsListWidget({ propertyId }: Props) {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('analytics', `/reports?property_id=${propertyId}`)
      .then(r => r.json() as Promise<any>)
      .then(d => {
        if (Array.isArray(d?.results)) setReports(d.results)
        else if (Array.isArray(d)) setReports(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [propertyId])

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#ff007c] to-[#ff8017] flex items-center justify-center shadow-sm">
            <FileBarChart className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Reportes</h2>
            <p className="text-xs text-gray-500">{reports.length} {reports.length === 1 ? 'reporte' : 'reportes'}</p>
          </div>
        </div>
        <Link
          href={`/propiedades/${propertyId}/reportes/nuevo`}
          className="flex items-center gap-1 text-xs text-[#ff007c] font-medium hover:underline"
        >
          <Plus className="w-3 h-3" /> Nuevo
        </Link>
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-gray-400">Cargando...</div>
      ) : reports.length === 0 ? (
        <div className="bg-gradient-to-br from-gray-50 to-white border border-dashed border-gray-200 rounded-xl p-6 text-center">
          <p className="text-sm text-gray-500 mb-3">No hay reportes para esta propiedad</p>
          <Link
            href={`/propiedades/${propertyId}/reportes/nuevo`}
            className="inline-flex items-center gap-1.5 text-sm font-medium bg-gradient-to-br from-[#ff007c] to-[#ff8017] text-white px-4 py-2 rounded-lg hover:opacity-90"
          >
            Crear el primer reporte
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.slice(0, 5).map(r => (
            <Link
              key={r.id}
              href={`/reportes/${r.id}`}
              className="flex items-center justify-between border border-gray-100 rounded-xl px-3 py-2 hover:border-[#ff007c]/30 hover:bg-[#ff007c]/5 transition-colors group"
            >
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {r.period_label || (r.period_start ? new Date(r.period_start).toLocaleDateString('es-AR') : 'Reporte')}
                </p>
                <p className="text-xs text-gray-500">
                  {r.impressions != null && `${r.impressions} imp. · `}
                  {r.portal_visits != null && `${r.portal_visits} vistas · `}
                  {r.in_person_visits != null && `${r.in_person_visits} visitas`}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#ff007c] transition-colors" />
            </Link>
          ))}
          {reports.length > 5 && (
            <Link
              href={`/reportes/listado?property_id=${propertyId}`}
              className="block text-center text-xs text-[#ff007c] font-medium hover:underline pt-2"
            >
              Ver los {reports.length} reportes →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
