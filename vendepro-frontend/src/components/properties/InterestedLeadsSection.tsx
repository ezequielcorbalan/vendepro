'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Users, MessageSquare } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { LEAD_PROPERTY_STATUSES } from '@/lib/crm-config'
import type { InterestedLead } from '@/lib/types'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { CallButton, WhatsAppButton } from '@/components/ui/ContactButtons'
import { StageBadge } from '@/components/ui/StageBadge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Text } from '@/components/ui/Typography'

/**
 * Interesados en la propiedad: leads (compradores) vinculados vía lead_properties,
 * con el estado de la relación, la etapa del lead y el feedback de visita.
 * Es la base del reporte al propietario: consultas → visitas → interesados.
 */
export function InterestedLeadsSection({ propertyId }: { propertyId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<InterestedLead[]>([])

  useEffect(() => {
    apiFetch('crm', `/lead-properties?property_id=${propertyId}`)
      .then(async (r) => {
        const body = (await r.json()) as any
        if (!r.ok) throw new Error(body?.error || 'Error cargando interesados')
        setItems(body)
      })
      .catch((e) => setError(e?.message || 'Error cargando interesados'))
      .finally(() => setLoading(false))
  }, [propertyId])

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-gray-600" aria-hidden="true" />
        <Text size="xs" weight="semibold" className="text-gray-700 uppercase tracking-wider">Interesados</Text>
        {items.length > 0 && <Badge tone="primary">{items.length}</Badge>}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        </div>
      ) : error ? (
        <Alert tone="danger">{error}</Alert>
      ) : items.length === 0 ? (
        <Text size="sm" tone="muted" className="py-3">
          Sin interesados todavía. Cuando un comprador consulte por esta propiedad
          (portales vía KiteProp o carga manual), aparece acá con su estado.
        </Text>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const statusCfg = (LEAD_PROPERTY_STATUSES as Record<string, { label: string; color: string }>)[item.status]
              ?? { label: item.status, color: undefined }
            return (
              <div key={item.id} className="border border-gray-100 rounded-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/leads/${item.lead_id}`}
                        className="text-sm font-semibold text-ink hover:text-primary truncate"
                      >
                        {item.lead_full_name}
                      </Link>
                      {/* lead_pipeline viene como string de la API; StageBadge tipa la unión.
                          El ternario replica el criterio de getStageConfig (todo lo que no es
                          'comprador' cae en el pipeline vendedor). */}
                      <StageBadge
                        stage={item.lead_stage}
                        pipeline={item.lead_pipeline === 'comprador' ? 'comprador' : 'vendedor'}
                        size="sm"
                      />
                    </div>
                    <Text size="xs" tone="muted" className="mt-0.5">
                      {item.lead_assigned_name ? `Agente: ${item.lead_assigned_name}` : 'Sin agente asignado'}
                    </Text>
                    {item.feedback && (
                      <Text size="xs" className="text-gray-600 mt-1.5 flex items-start gap-1">
                        <MessageSquare className="w-3 h-3 mt-0.5 shrink-0 text-gray-400" aria-hidden="true" />
                        <span className="line-clamp-2">{item.feedback}</span>
                      </Text>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <StatusBadge label={statusCfg.label} color={statusCfg.color} size="sm" />
                    {item.lead_phone && (
                      <div className="flex items-center gap-1">
                        <CallButton phone={item.lead_phone} iconOnly />
                        <WhatsAppButton phone={item.lead_phone} iconOnly />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
