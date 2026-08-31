'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Loader2, Building2, Plus, Search, X, Trash2,
  CalendarPlus, Eye, XCircle, HandCoins, ClipboardList, MessageSquare,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { LEAD_PROPERTY_STATUSES } from '@/lib/crm-config'
import type { LeadPropertyItem } from '@/lib/types'
import { Input } from '@/components/ui/Input'

import { Card } from '@/components/ui/Card'
import { WidgetHeader } from '@/components/ui/WidgetHeader'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
const STATUS_ACTIONS: Array<{ status: keyof typeof LEAD_PROPERTY_STATUSES; label: string; icon: any }> = [
  { status: 'visita_agendada', label: 'Visita agendada', icon: CalendarPlus },
  { status: 'visitada', label: 'Visitada', icon: Eye },
  { status: 'oferto', label: 'Ofertó', icon: HandCoins },
  { status: 'descartada', label: 'Descartada', icon: XCircle },
]

function formatPrice(price: number | null, currency: string | null): string | null {
  if (price == null) return null
  return `${currency === 'ARS' ? '$' : 'USD '}${price.toLocaleString('es-AR')}`
}

/**
 * Propiedades de interés de un lead comprador: la lista lead_properties con el
 * estado de cada relación, acciones rápidas de status, generación de ficha de
 * visita y vinculación de nuevas propiedades del stock local.
 */
export function LeadPropertiesSection({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<LeadPropertyItem[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Buscador para vincular una propiedad del stock
  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ id: string; address: string; neighborhood?: string }>>([])
  const [searching, setSearching] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('crm', `/lead-properties?lead_id=${leadId}`)
      const body = (await res.json()) as any
      if (!res.ok) throw new Error(body?.error || 'Error cargando propiedades')
      setItems(body)
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Error cargando propiedades')
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!showSearch || query.trim().length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await apiFetch('properties', `/properties?search=${encodeURIComponent(query.trim())}`)
        const body = (await res.json()) as any
        setResults(Array.isArray(body) ? body.slice(0, 8) : [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query, showSearch])

  const linkProperty = async (propertyId: string) => {
    setBusyId('link')
    try {
      const res = await apiFetch('crm', '/lead-properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, property_id: propertyId }),
      })
      if (res.ok) {
        setShowSearch(false)
        setQuery('')
        await load()
      }
    } finally {
      setBusyId(null)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    setBusyId(id)
    try {
      const res = await apiFetch('crm', '/lead-properties', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (res.ok) await load()
    } finally {
      setBusyId(null)
    }
  }

  const unlink = async (id: string) => {
    setBusyId(id)
    try {
      const res = await apiFetch('crm', `/lead-properties?id=${id}`, { method: 'DELETE' })
      if (res.ok) await load()
    } finally {
      setBusyId(null)
    }
  }

  const generateVisitForm = async (item: LeadPropertyItem) => {
    setBusyId(item.id)
    try {
      const res = await apiFetch('properties', '/visit-forms/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: item.property_id, lead_id: leadId }),
      })
      const body = (await res.json()) as any
      if (res.ok && body?.public_url) {
        await navigator.clipboard.writeText(`${window.location.origin}${body.public_url}`)
        setCopiedId(item.id)
        setTimeout(() => setCopiedId(null), 2500)
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <WidgetHeader
        size="sm"
        icon={<Building2 className="w-3.5 h-3.5" />}
        title="Propiedades de interés"
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSearch(v => !v)}
            icon={showSearch ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            className="text-xs text-primary min-h-[44px]"
          >
            {showSearch ? 'Cancelar' : 'Vincular propiedad'}
          </Button>
        }
      />

      {showSearch && (
        <div className="mb-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por dirección o barrio..."
              className="pl-9"
            />
          </div>
          {searching && <Text size="xs" tone="muted" className="mt-2">Buscando…</Text>}
          {!searching && results.length > 0 && (
            <div className="mt-2 border border-gray-100 rounded-card divide-y divide-gray-100 overflow-hidden">
              {results.map(r => (
                <button
                  key={r.id}
                  onClick={() => linkProperty(r.id)}
                  disabled={busyId === 'link'}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-primary/5 disabled:opacity-50"
                >
                  <span className="font-medium text-ink">{r.address}</span>
                  {r.neighborhood && <span className="text-gray-400"> · {r.neighborhood}</span>}
                </button>
              ))}
            </div>
          )}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <Text size="xs" tone="muted" className="mt-2">Sin resultados en el stock.</Text>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : error ? (
        <Text size="sm" tone="danger" className="py-3">{error}</Text>
      ) : items.length === 0 ? (
        <Text size="sm" tone="muted" className="py-3">
          Sin propiedades vinculadas todavía. Las consultas de portales las vinculan
          automáticamente; también podés vincular una propiedad del stock.
        </Text>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const statusCfg = (LEAD_PROPERTY_STATUSES as Record<string, { label: string; color: string }>)[item.status]
              ?? { label: item.status, color: 'bg-gray-100 text-gray-600' }
            const price = formatPrice(item.property_asking_price, item.property_currency)
            const busy = busyId === item.id
            return (
              <div key={item.id} className="border border-gray-100 rounded-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/propiedades/${item.property_id}`}
                        className="text-sm font-semibold text-ink hover:text-primary truncate"
                      >
                        {item.property_address}
                      </Link>
                      {item.property_source === 'kiteprop' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                          Importada de KiteProp
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {item.property_neighborhood}
                      {price ? ` · ${price}` : ''}
                    </p>
                    {item.feedback && (
                      <p className="text-xs text-gray-600 mt-1.5 flex items-start gap-1">
                        <MessageSquare className="w-3 h-3 mt-0.5 shrink-0 text-gray-400" />
                        <span className="line-clamp-2">{item.feedback}</span>
                      </p>
                    )}
                    {item.notes && !item.feedback && (
                      <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">«{item.notes}»</p>
                    )}
                  </div>
                  <span className={`shrink-0 text-[10px] font-medium px-2 py-1 rounded-full ${statusCfg.color}`}>
                    {statusCfg.label}
                  </span>
                </div>

                <div className="flex items-center gap-1 flex-wrap mt-2 pt-2 border-t border-gray-50">
                  {STATUS_ACTIONS.filter(a => a.status !== item.status).map(a => (
                    <button
                      key={a.status}
                      onClick={() => updateStatus(item.id, a.status)}
                      disabled={busy}
                      className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-primary hover:bg-primary/5 rounded-control px-2 min-h-[44px] disabled:opacity-40"
                    >
                      <a.icon className="w-3 h-3" />
                      {a.label}
                    </button>
                  ))}
                  <button
                    onClick={() => generateVisitForm(item)}
                    disabled={busy}
                    title="Genera el link de la ficha de visita y lo copia al portapapeles"
                    className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-primary hover:bg-primary/5 rounded-control px-2 min-h-[44px] disabled:opacity-40"
                  >
                    <ClipboardList className="w-3 h-3" />
                    {copiedId === item.id ? 'Link copiado ✓' : 'Ficha de visita'}
                  </button>
                  <button
                    onClick={() => unlink(item.id)}
                    disabled={busy}
                    className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-danger hover:bg-danger/5 rounded-control px-2 min-h-[44px] ml-auto disabled:opacity-40"
                  >
                    <Trash2 className="w-3 h-3" />
                    Quitar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
