'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Building2, Plus, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { scopeQueryString } from '@/lib/agent-scope'
import { fetchPropertyConfig } from '@/lib/property-config'
import type { PropertyConfig } from '@/lib/property-config'
import PropertyFilters from '@/components/properties/PropertyFilters'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Alert } from '@/components/ui/Alert'

export default function PropiedadesPage() {
  const [properties, setProperties] = useState<any[]>([])
  const [config, setConfig] = useState<PropertyConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const load = (initial: boolean) => {
      if (initial) setLoading(true)
      Promise.all([
        apiFetch('properties', `/properties${scopeQueryString()}`).then(r => r.json() as Promise<any>),
        fetchPropertyConfig(),
      ])
        .then(([d, cfg]) => {
          if (d?.error) { setError(true); setLoading(false); return }
          setProperties(Array.isArray(d) ? d : [])
          setConfig(cfg)
          setLoading(false)
        })
        .catch(() => { setError(true); setLoading(false) })
    }
    load(true)
    const onFocus = () => load(false)
    const onVisibility = () => { if (document.visibilityState === 'visible') load(false) }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <div>
      <PageHeader
        className="mb-8"
        title="Propiedades"
        subtitle={loading ? 'Cargando...' : `${properties.length} propiedad${properties.length !== 1 ? 'es' : ''}`}
        actions={
          <Link href="/propiedades/nueva"
            className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-control text-sm font-medium hover:bg-primary-hover">
            <Plus className="w-4 h-4" /> Nueva propiedad
          </Link>
        }
      />

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <Alert tone="danger">Error cargando propiedades</Alert>
      )}

      {!loading && !error && properties.length === 0 && (
        <Card className="text-center">
          <EmptyState
            icon={<Building2 className="w-6 h-6" />}
            title="Sin propiedades"
            description="Creá tu primera propiedad captada"
            action={
              <Link href="/propiedades/nueva"
                className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-control text-sm font-medium hover:bg-primary-hover">
                <Plus className="w-4 h-4" /> Nueva propiedad
              </Link>
            }
          />
        </Card>
      )}

      {!loading && !error && properties.length > 0 && config && (
        <PropertyFilters properties={properties} config={config} />
      )}
    </div>
  )
}
