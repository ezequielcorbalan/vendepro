'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Calculator, MapPin, Loader2, ChevronRight } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Text } from '@/components/ui/Typography'
import { Alert } from '@/components/ui/Alert'

export default function PrefactibilidadesPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    apiFetch('properties', '/prefactibilidades')
      .then(r => (r.json()) as any)
      .then((d: any) => {
        if (d?.error) { setError(true); setLoading(false); return }
        const list = Array.isArray(d) ? d : (Array.isArray(d?.prefactibilidades) ? d.prefactibilidades : [])
        setItems(list)
        setLoading(false)
      })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prefactibilidades"
        subtitle="Análisis de factibilidad de proyectos"
        actions={
          <Link
            href="/prefactibilidades/nueva"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-control text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva
          </Link>
        }
      />

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <Alert tone="danger">Error cargando prefactibilidades</Alert>
      )}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          icon={<Calculator className="w-6 h-6" />}
          title="Sin prefactibilidades"
          description="Creá tu primer análisis de factibilidad"
          action={
            <Link
              href="/prefactibilidades/nueva"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-control text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nueva prefactibilidad
            </Link>
          }
        />
      )}

      {!loading && !error && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item: any) => (
            <Link
              key={item.id}
              href={`/prefactibilidades/${item.id}`}
              className="flex items-center gap-4 bg-white rounded-card border border-gray-100 p-4 hover:border-primary/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-control bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Calculator className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <Text weight="medium" className="truncate">{item.project_name || 'Sin nombre'}</Text>
                {item.address && (
                  <Text size="xs" tone="muted" className="flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    {item.address}
                  </Text>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
