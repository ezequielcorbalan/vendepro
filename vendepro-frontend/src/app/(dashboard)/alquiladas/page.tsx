'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Home, TrendingUp, MapPin, Building2, User, DollarSign, Calendar } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Heading, Text } from '@/components/ui/Typography'
import { EmptyState } from '@/components/ui/EmptyState'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function AlquiladasPage() {
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // commercial_stage=alquilada (etapa exclusiva de alquiler, ID 13) + operation_type_id=2
    apiFetch('properties', '/properties?commercial_stage=alquilada&operation_type_id=2')
      .then(r => r.json() as Promise<any>)
      .then(d => { setProperties(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const totalARS = properties.reduce((s, p) => p.asking_price && p.currency === 'ARS' ? s + Number(p.asking_price) : s, 0)
  const totalUSD = properties.reduce((s, p) => p.asking_price && p.currency === 'USD' ? s + Number(p.asking_price) : s, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Alquiladas"
        subtitle={`${properties.length} propiedad${properties.length !== 1 ? 'es' : ''} alquilada${properties.length !== 1 ? 's' : ''}`}
      />

      {properties.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card>
            <div className="w-8 h-8 bg-cyan-50 rounded-control flex items-center justify-center mb-2">
              <TrendingUp className="w-4 h-4 text-cyan-600" />
            </div>
            <p className="text-2xl font-bold text-ink">{properties.length}</p>
            <Text size="xs" tone="muted" className="mt-0.5">Total alquiladas</Text>
          </Card>
          {totalUSD > 0 && (
            <Card>
              <div className="w-8 h-8 bg-primary/10 rounded-control flex items-center justify-center mb-2">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
              <p className="text-xl font-bold text-ink">USD {totalUSD.toLocaleString('es-AR')}</p>
              <Text size="xs" tone="muted" className="mt-0.5">Alquileres USD</Text>
            </Card>
          )}
          {totalARS > 0 && (
            <Card>
              <div className="w-8 h-8 bg-brand-orange/10 rounded-control flex items-center justify-center mb-2">
                <DollarSign className="w-4 h-4 text-brand-orange" />
              </div>
              <p className="text-xl font-bold text-ink">$ {totalARS.toLocaleString('es-AR')}</p>
              <Text size="xs" tone="muted" className="mt-0.5">Alquileres ARS</Text>
            </Card>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
        </div>
      ) : properties.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<Home className="w-6 h-6" />}
            title="Sin propiedades alquiladas"
            description='Aparecerán aquí las propiedades de alquiler con etapa "Alquilada"'
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {properties.map(p => (
            <Link key={p.id} href={`/propiedades/${p.id}`} className="block">
              <Card interactive padded={false} className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <Heading level={4} className="truncate mb-1">{p.address}</Heading>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      {p.neighborhood && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.neighborhood}</span>}
                      {p.property_type && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{p.property_type}</span>}
                      {p.owner_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{p.owner_name}</span>}
                      {p.asking_price && (
                        <span className="flex items-center gap-1 font-semibold text-primary">
                          <DollarSign className="w-3 h-3" />{formatCurrency(Number(p.asking_price), p.currency || 'ARS')}
                        </span>
                      )}
                      {p.agent_name && <span className="text-gray-500">{p.agent_name}</span>}
                      {p.updated_at && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(p.updated_at)}</span>}
                    </div>
                  </div>
                  {/* ds-todo: chip de estado "Alquilada" (cyan) sin mapeo en StageBadge (usa getStageConfig de leads) — por ahora se deja el span */}
                  <span className="bg-cyan-100 text-cyan-700 text-[10px] font-medium px-2 py-1 rounded-full shrink-0">Alquilada</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
