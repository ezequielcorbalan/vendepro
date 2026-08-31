'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Users, MessageSquare } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { LEAD_PROPERTY_STATUSES, getStageConfig } from '@/lib/crm-config'
import type { InterestedLead } from '@/lib/types'
import { Card } from '@/components/ui/Card'
import { WidgetHeader } from '@/components/ui/WidgetHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Text } from '@/components/ui/Typography'
import { CallButton, WhatsAppButton } from '@/components/ui/ContactButtons'

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
    <Card>
      <WidgetHeader
        size="sm"
        icon={<Users className="w-3.5 h-3.5" />}
        title="Interesados"
        badge={items.length > 0 ? <StatusBadge size="sm" label={String(items.length)} color="bg-primary/10 text-primary" /> : undefined}
      />

      {loading ? (
        <div className="flex items-center justify-center py-6 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : error ? (
        <Text size="sm" tone="danger" className="py-3">{error}</Text>
      ) : items.length === 0 ? (
        <Text size="sm" tone="muted" className="py-3">
          Sin interesados todavía. Cuando un comprador consulte por esta propiedad
          (portales vía KiteProp o carga manual), aparece acá con su estado.
        </Text>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const statusCfg = (LEAD_PROPERTY_STATUSES as Record<string, { label: string; color: string }>)[item.status]
              ?? { label: item.status, color: 'bg-gray-100 text-gray-600' }
            const stageCfg = getStageConfig(item.lead_stage, item.lead_pipeline)
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
                      <StatusBadge size="sm" label={stageCfg.label} color={stageCfg.color} />
                    </div>
                    <Text size="xs" tone="muted" className="mt-0.5">
                      {item.lead_assigned_name ? `Agente: ${item.lead_assigned_name}` : 'Sin agente asignado'}
                    </Text>
                    {item.feedback && (
                      <p className="text-xs text-gray-600 mt-1.5 flex items-start gap-1">
                        <MessageSquare className="w-3 h-3 mt-0.5 shrink-0 text-gray-400" />
                        <span className="line-clamp-2">{item.feedback}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <StatusBadge label={statusCfg.label} color={statusCfg.color} />
                    {item.lead_phone && (
                      <div className="flex items-center gap-1">
                        <CallButton phone={item.lead_phone} />
                        <WhatsAppButton phone={item.lead_phone} />
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
