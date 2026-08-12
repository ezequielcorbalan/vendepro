'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileBarChart, Plus, Loader2, Eye, Pencil } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Text } from '@/components/ui/Typography'

interface Report {
  id: string
  property_id: string
  property_address?: string
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

export default function PropertyReportsPage() {
  const params = useParams()
  const id = params?.id as string
  const [reports, setReports] = useState<Report[]>([])
  const [propertyAddress, setPropertyAddress] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([
      apiFetch('analytics', `/reports?property_id=${id}`).then(r => r.json() as Promise<any>).catch(() => null),
      apiFetch('properties', `/properties/${id}`).then(r => r.json() as Promise<any>).catch(() => null),
    ]).then(([reportsData, propertyData]) => {
      const list = Array.isArray(reportsData?.results) ? reportsData.results : Array.isArray(reportsData) ? reportsData : []
      setReports(list)
      setPropertyAddress(propertyData?.address || '')
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div>
      <Link
        href={`/propiedades/${id}`}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-ink mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a la propiedad
      </Link>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-pink to-brand-orange" />
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center flex-shrink-0 shadow-sm">
              <FileBarChart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-ink">Reportes</h1>
              <p className="text-sm text-gray-500 mt-0.5">{propertyAddress || 'Propiedad'} · {reports.length} {reports.length === 1 ? 'reporte' : 'reportes'}</p>
            </div>
          </div>
          <Link
            href={`/propiedades/${id}/reportes/nuevo`}
            className="inline-flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-control text-sm font-medium hover:bg-primary-hover shadow-sm"
          >
            <Plus className="w-4 h-4" /> Nuevo reporte
          </Link>
        </div>
      </div>

      {reports.length === 0 ? (
        <Card padded={false} className="border-dashed border-gray-300 shadow-none">
          <EmptyState
            icon={<FileBarChart className="w-6 h-6" />}
            title="No hay reportes para esta propiedad"
            action={
              <Link
                href={`/propiedades/${id}/reportes/nuevo`}
                className="inline-flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-control text-sm font-medium hover:bg-primary-hover"
              >
                <Plus className="w-4 h-4" /> Crear el primer reporte
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {reports.map(r => (
            <Card
              key={r.id}
              className="p-4 shadow-none hover:border-primary/30 hover:shadow-sm transition-all flex items-center justify-between"
            >
              <div>
                <Text size="base" weight="medium">
                  {r.period_label || (r.period_start ? new Date(r.period_start).toLocaleDateString('es-AR') : 'Reporte')}
                </Text>
                <Text size="xs" tone="muted" className="mt-0.5">
                  {r.impressions != null && `${r.impressions} imp · `}
                  {r.portal_visits != null && `${r.portal_visits} vistas portal · `}
                  {r.in_person_visits != null && `${r.in_person_visits} visitas presenciales · `}
                  {r.offers != null && `${r.offers} ofertas`}
                </Text>
                {r.published_at && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Publicado {new Date(r.published_at).toLocaleDateString('es-AR')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge
                  label={r.status === 'published' ? 'Publicado' : r.status === 'draft' ? 'Borrador' : (r.status || '—')}
                  color={
                    r.status === 'published' ? 'bg-green-100 text-green-700' :
                    r.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                    'bg-amber-100 text-amber-700'
                  }
                />
                <Link
                  href={`/propiedades/${id}/reportes/nuevo?edit=${r.id}`}
                  className="inline-flex items-center gap-1 text-sm text-gray-600 font-medium hover:text-primary"
                >
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </Link>
                {(r as any).public_slug && (
                  <a
                    href={`/r/${(r as any).public_slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary font-medium hover:underline"
                  >
                    <Eye className="w-3.5 h-3.5" /> Ver público
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
