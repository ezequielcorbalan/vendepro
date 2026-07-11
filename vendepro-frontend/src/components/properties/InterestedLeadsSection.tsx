'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Users, Phone, MessageSquare } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { LEAD_PROPERTY_STATUSES, getStageConfig, formatWhatsApp } from '@/lib/crm-config'
import type { InterestedLead } from '@/lib/types'

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
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center shadow-sm">
          <Users className="w-3.5 h-3.5 text-white" />
        </div>
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Interesados</p>
        {items.length > 0 && (
          <span className="text-[10px] font-medium bg-pink-50 text-brand-pink px-1.5 py-0.5 rounded-full">
            {items.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-500 py-3">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 py-3">
          Sin interesados todavía. Cuando un comprador consulte por esta propiedad
          (portales vía KiteProp o carga manual), aparece acá con su estado.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const statusCfg = (LEAD_PROPERTY_STATUSES as Record<string, { label: string; color: string }>)[item.status]
              ?? { label: item.status, color: 'bg-gray-100 text-gray-600' }
            const stageCfg = getStageConfig(item.lead_stage, item.lead_pipeline)
            return (
              <div key={item.id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/leads/${item.lead_id}`}
                        className="text-sm font-semibold text-gray-800 hover:text-brand-pink truncate"
                      >
                        {item.lead_full_name}
                      </Link>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${stageCfg.color}`}>
                        {stageCfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {item.lead_assigned_name ? `Agente: ${item.lead_assigned_name}` : 'Sin agente asignado'}
                    </p>
                    {item.feedback && (
                      <p className="text-xs text-gray-600 mt-1.5 flex items-start gap-1">
                        <MessageSquare className="w-3 h-3 mt-0.5 shrink-0 text-gray-400" />
                        <span className="line-clamp-2">{item.feedback}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                    {item.lead_phone && (
                      <div className="flex items-center gap-1">
                        <a
                          href={`tel:${item.lead_phone}`}
                          className="p-2 text-gray-400 hover:text-brand-pink rounded-lg hover:bg-pink-50"
                          title="Llamar"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={`https://wa.me/${formatWhatsApp(item.lead_phone)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50"
                          title="WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
