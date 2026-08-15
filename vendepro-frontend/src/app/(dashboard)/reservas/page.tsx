'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Handshake, MapPin, Building2, User, DollarSign } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Heading } from '@/components/ui/Typography'
import { EmptyState } from '@/components/ui/EmptyState'
import { PropertyStageBadge } from '@/components/ui/PropertyStageBadge'
import { OperationBadge } from '@/components/ui/OperationBadge'

export default function ReservasPage() {
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // commercial_stage=reservada aplica a ambos tipos de operación (IDs 4 y 12)
    apiFetch('properties', '/properties?commercial_stage=reservada')
      .then(r => r.json() as Promise<any>)
      .then(d => { setProperties(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reservas"
        subtitle={`${properties.length} propiedad${properties.length !== 1 ? 'es' : ''} en reserva`}
      />

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-card" />)}
        </div>
      ) : properties.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Handshake className="w-6 h-6" />}
            title="Sin propiedades en reserva"
            description={'Aparecerán aquí las propiedades con etapa "Reservada"'}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {properties.map(p => {
            const isAlquiler = p.operation_type_id === 2
            return (
              <Link key={p.id} href={`/propiedades/${p.id}`} className="block">
                <Card interactive className="sm:p-5 hover:border-gray-300">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <Heading level={4} className="truncate mb-1">{p.address}</Heading>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        {p.neighborhood && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.neighborhood}</span>}
                        {p.property_type && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{p.property_type}</span>}
                        {p.owner_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{p.owner_name}</span>}
                        {p.asking_price && (
                          <span className="flex items-center gap-1 font-semibold text-primary">
                            <DollarSign className="w-3 h-3" />{formatCurrency(Number(p.asking_price), p.currency || 'USD')}
                          </span>
                        )}
                        {p.agent_name && <span className="text-gray-500">{p.agent_name}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <PropertyStageBadge stage="reservada" />
                      <OperationBadge operation={isAlquiler ? 'alquiler' : 'venta'} />
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
