'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, FileBarChart, Eye } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { getReportStatus } from '@/lib/crm-config'
import HealthBadge from '@/components/reports/HealthBadge'
import { type HealthStatus } from '@/lib/semaforo'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Text } from '@/components/ui/Typography'

interface ReportItem {
  id: string
  property_id: string
  property_address: string
  property_neighborhood: string
  period_label: string
  period_start: string
  period_end: string
  status: string
  published_at: string | null
  public_slug: string | null
  impressions: number
  portal_visits: number
  in_person_visits: number
  offers: number
  days_in_period: number
  views_per_day: number
  in_person_visits_per_week: number
  health_status: HealthStatus | null
}

interface ListResponse {
  page: number
  page_size: number
  total: number
  results: ReportItem[]
}

const PAGE_SIZE = 20

export default function ListadoPage() {
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(1)

  // Filters
  const [neighborhood, setNeighborhood] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    setLoading(true)
    setError(false)

    const params = new URLSearchParams({
      page: String(page),
      page_size: String(PAGE_SIZE),
    })
    if (neighborhood.trim()) params.set('neighborhood', neighborhood.trim())
    if (status) params.set('status', status)
    if (from) params.set('from', from)
    if (to) params.set('to', to)

    apiFetch('analytics', `/reports?${params.toString()}`)
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<any>
      })
      .then(d => {
        if (!Array.isArray(d?.results)) throw new Error('respuesta inválida')
        setData(d)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [page, neighborhood, status, from, to])

  // Reset page to 1 when filters change
  useEffect(() => { setPage(1) }, [neighborhood, status, from, to])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-4">
      {/* Búsqueda + filtros: una sola fila compacta (sin labels ni card propio) */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="text"
          value={neighborhood}
          onChange={e => setNeighborhood(e.target.value)}
          placeholder="Buscar barrio..."
          className="flex-1 min-w-[180px]"
        />
        <Select aria-label="Estado" value={status} onChange={e => setStatus(e.target.value)} className="w-auto">
          <option value="">Estado: todos</option>
          <option value="published">Publicados</option>
          <option value="draft">Borradores</option>
        </Select>
        <Input aria-label="Desde" type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-auto" />
        <Input aria-label="Hasta" type="date" value={to} onChange={e => setTo(e.target.value)} className="w-auto" />
        {(neighborhood || status || from || to) && (
          <Button variant="ghost" size="sm"
            onClick={() => { setNeighborhood(''); setStatus(''); setFrom(''); setTo('') }}
            className="p-0 text-xs text-gray-500 hover:text-primary shrink-0"
          >
            Limpiar
          </Button>
        )}
      </div>

      {/* Table */}
      <Card padded={false} className="overflow-hidden">
        {loading && (
          <div className="p-4 space-y-2 animate-pulse">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
          </div>
        )}

        {!loading && error && (
          <div className="p-4">
            <Alert tone="danger" title="Error al cargar los reportes">
              <Button variant="ghost" onClick={() => setPage(p => p)} className="-ml-3 mt-1">
                Reintentar
              </Button>
            </Alert>
          </div>
        )}

        {!loading && !error && data && data.results.length === 0 && (
          <EmptyState
            icon={<FileBarChart className="w-6 h-6" />}
            title="No hay reportes que coincidan con los filtros"
          />
        )}

        {!loading && !error && data && data.results.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-100">
                  <th className="py-2 px-3 w-8"></th>
                  <th className="py-2 px-3">Propiedad</th>
                  <th className="py-2 px-2 hidden sm:table-cell">Barrio</th>
                  <th className="py-2 px-2">Período</th>
                  <th className="py-2 px-2">Estado</th>
                  <th className="py-2 px-2 text-right">Vis/día</th>
                  <th className="py-2 px-2 text-right hidden md:table-cell">Visitas portal</th>
                  <th className="py-2 px-2 text-right">Ofertas</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.results.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <HealthBadge
                        status={r.health_status}
                        size="md"
                        title={r.health_status ? `${r.views_per_day} vis/día en ${r.days_in_period} días` : 'Sin datos'}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Link
                        href={`/propiedades/${r.property_id}/reportes`}
                        className="text-primary hover:underline font-medium"
                      >
                        {r.property_address}
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-gray-600 hidden sm:table-cell">{r.property_neighborhood}</td>
                    <td className="py-2 px-2 text-gray-600">{r.period_label}</td>
                    <td className="py-2 px-2">
                      <StatusBadge label={getReportStatus(r.status).label} color={getReportStatus(r.status).color} size="sm" />
                    </td>
                    <td className="py-2 px-2 text-right text-gray-700 font-semibold">{r.views_per_day}</td>
                    <td className="py-2 px-2 text-right text-gray-700 hidden md:table-cell">{r.portal_visits}</td>
                    <td className="py-2 px-2 text-right font-semibold text-ink">{r.offers}</td>
                    <td className="py-2 px-2 text-right">
                      {r.public_slug && r.status === 'published' ? (
                        <a
                          href={`/r/${r.public_slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Ver reporte público"
                          className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-medium"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Ver público</span>
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <Text as="span" tone="muted">
            Página {page} de {totalPages} — {data.total} reportes
          </Text>
          <div className="flex gap-1">
            <Button
              variant="outline"
              icon={<ChevronLeft className="w-4 h-4" />}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
