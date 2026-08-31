'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileBarChart, Plus } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { WidgetHeader } from '@/components/ui/WidgetHeader'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import { EmptyState } from '@/components/ui/EmptyState'

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
      <WidgetHeader
        icon={<FileBarChart className="w-4 h-4" />}
        title="Reportes"
        subtitle={`${reports.length} ${reports.length === 1 ? 'reporte' : 'reportes'}`}
        action={
          <Button
            href={`/propiedades/${propertyId}/reportes/nuevo`}
            variant="ghost"
            size="sm"
            icon={<Plus className="w-3 h-3" />}
          >
            Nuevo
          </Button>
        }
      />

      {loading ? (
        <Text size="xs" tone="muted" className="py-6 text-center">Cargando…</Text>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<FileBarChart className="w-6 h-6" />}
          title="No hay reportes para esta propiedad"
          action={
            <Button href={`/propiedades/${propertyId}/reportes/nuevo`}>
              Crear el primer reporte
            </Button>
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
                <Text weight="medium">
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
            className="block text-center text-xs text-primary font-medium hover:underline pt-2"
          >
            Ver todos los reportes →
          </Link>
        </div>
      )}
    </Card>
  )
}
