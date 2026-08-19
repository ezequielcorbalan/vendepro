'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileBarChart, Plus, ArrowRight } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Heading, Text } from '@/components/ui/Typography'

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
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileBarChart className="w-4 h-4 text-gray-600" aria-hidden="true" />
          <div>
            <Heading level={4}>Reportes</Heading>
            <Text size="xs" tone="muted">{reports.length} {reports.length === 1 ? 'reporte' : 'reportes'}</Text>
          </div>
        </div>
        {/* Regla 2: el link estilado como botón iguala la escala md de Button. */}
        <Link
          href={`/propiedades/${propertyId}/reportes/nuevo`}
          className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-control text-primary font-medium hover:bg-primary/10"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> Nuevo
        </Link>
      </div>

      {loading ? (
        <div className="py-6 text-center"><Text size="xs" tone="muted">Cargando...</Text></div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<FileBarChart className="w-6 h-6" />}
          title="No hay reportes para esta propiedad"
          action={
            <Link
              href={`/propiedades/${propertyId}/reportes/nuevo`}
              className="inline-flex items-center gap-2 text-sm font-medium bg-primary text-white px-4 py-2 rounded-control hover:bg-primary-hover"
            >
              Crear el primer reporte
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {reports.slice(0, 5).map(r => (
            <div
              key={r.id}
              className="flex items-center justify-between border border-gray-100 rounded-control px-3 py-2"
            >
              <div>
                <Text size="sm" weight="medium">
                  {r.period_label || (r.period_start ? new Date(r.period_start).toLocaleDateString('es-AR') : 'Reporte')}
                </Text>
                <Text size="xs" tone="muted">
                  {r.impressions != null && `${r.impressions} imp. · `}
                  {r.portal_visits != null && `${r.portal_visits} vistas · `}
                  {r.in_person_visits != null && `${r.in_person_visits} visitas`}
                </Text>
              </div>
            </div>
          ))}
          <Link
            href={`/propiedades/${propertyId}/reportes`}
            className="block text-center text-sm text-primary font-medium hover:underline pt-2"
          >
            Ver todos los reportes →
          </Link>
        </div>
      )}
    </Card>
  )
}
