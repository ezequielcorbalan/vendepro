'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { DollarSign, TrendingUp, MapPin, Building2, User, Calendar } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Heading, Text } from '@/components/ui/Typography'
import { PropertyStageBadge } from '@/components/ui/PropertyStageBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatTile } from '@/components/ui/StatTile'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function VendidasPage() {
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // commercial_stage=vendida + operation_type_id=1 (Venta) → el backend resuelve a ID
    apiFetch('properties', '/properties?commercial_stage=vendida&operation_type_id=1')
      .then(r => r.json() as Promise<any>)
      .then(d => { setProperties(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const totalUSD = properties.reduce((sum, p) =>
    p.asking_price && (p.currency === 'USD' || !p.currency) ? sum + Number(p.asking_price) : sum
  , 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vendidas"
        subtitle={`${properties.length} propiedad${properties.length !== 1 ? 'es' : ''} vendida${properties.length !== 1 ? 's' : ''}`}
      />

      {properties.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatTile icon={<TrendingUp className="w-5 h-5" />} tone="bg-green-50 text-green-600" value={properties.length} label="Total vendidas" />
          {totalUSD > 0 && (
            <StatTile icon={<DollarSign className="w-5 h-5" />} tone="primary" value={`USD ${totalUSD.toLocaleString('es-AR')}`} label="Valuación total" />
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-card" />)}
        </div>
      ) : properties.length === 0 ? (
        <Card padded={false} className="p-8 sm:p-12">
          <EmptyState
            icon={<DollarSign className="w-6 h-6" />}
            title="Sin propiedades vendidas"
            description='Aparecerán aquí las propiedades con etapa "Vendida"'
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {properties.map(p => (
            <Link key={p.id} href={`/propiedades/${p.id}`} className="block">
              <Card interactive padded={false} className="p-4 sm:p-5 hover:border-gray-300 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <Heading level={4} className="truncate mb-1">{p.address}</Heading>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      {p.neighborhood && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.neighborhood}</span>}
                      {p.property_type && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{p.property_type}</span>}
                      {p.owner_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{p.owner_name}</span>}
                      {p.asking_price && <span className="font-semibold text-primary">{formatCurrency(Number(p.asking_price), p.currency || 'USD')}</span>}
                      {p.agent_name && <span className="text-gray-500">{p.agent_name}</span>}
                      {p.updated_at && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(p.updated_at)}</span>}
                    </div>
                  </div>
                  <PropertyStageBadge stage={p.commercial_stage} className="shrink-0" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
