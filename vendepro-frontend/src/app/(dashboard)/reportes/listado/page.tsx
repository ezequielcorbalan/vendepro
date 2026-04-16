'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Filter, ChevronLeft, ChevronRight, FileBarChart } from 'lucide-react'
import { apiFetch } from '@/lib/api'

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
  impressions: number
  portal_visits: number
  in_person_visits: number
  offers: number
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
      .then(r => r.json() as Promise<any>)
      .then(d => {
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
      {/* Filters */}
      <div className="bg-white rounded-xl border p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700">
          <Filter className="w-4 h-4" aria-hidden="true" />
          Filtros
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <input
            type="text"
            value={neighborhood}
            onChange={e => setNeighborhood(e.target.value)}
            placeholder="Barrio"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/30 focus:border-[#ff007c]"
          />
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/30 focus:border-[#ff007c]"
          >
            <option value="">Todos</option>
            <option value="published">Publicados</option>
            <option value="draft">Borradores</option>
          </select>
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/30 focus:border-[#ff007c]"
          />
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/30 focus:border-[#ff007c]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading && (
          <div className="p-4 space-y-2 animate-pulse">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
          </div>
        )}

        {!loading && error && (
          <div className="p-6 text-center">
            <p className="text-red-600 text-sm font-medium">Error al cargar los reportes</p>
            <button onClick={() => setPage(p => p)} className="mt-2 text-xs text-red-500 underline">
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && data && data.results.length === 0 && (
          <div className="p-8 text-center">
            <FileBarChart className="w-10 h-10 text-gray-300 mx-auto mb-3" aria-hidden="true" />
            <p className="text-gray-600 font-medium">No hay reportes que coincidan con los filtros</p>
          </div>
        )}

        {!loading && !error && data && data.results.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-100">
                  <th className="py-2 px-3">Propiedad</th>
                  <th className="py-2 px-2 hidden sm:table-cell">Barrio</th>
                  <th className="py-2 px-2">Período</th>
                  <th className="py-2 px-2">Estado</th>
                  <th className="py-2 px-2 text-right hidden md:table-cell">Impres.</th>
                  <th className="py-2 px-2 text-right hidden md:table-cell">Visitas</th>
                  <th className="py-2 px-2 text-right">Ofertas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.results.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <Link
                        href={`/propiedades/${r.property_id}/reportes`}
                        className="text-[#ff007c] hover:underline font-medium"
                      >
                        {r.property_address}
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-gray-600 hidden sm:table-cell">{r.property_neighborhood}</td>
                    <td className="py-2 px-2 text-gray-600">{r.period_label}</td>
                    <td className="py-2 px-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${r.status === 'published' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {r.status === 'published' ? 'Publicado' : 'Borrador'}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-gray-700 hidden md:table-cell">{r.impressions}</td>
                    <td className="py-2 px-2 text-right text-gray-700 hidden md:table-cell">{r.portal_visits}</td>
                    <td className="py-2 px-2 text-right font-semibold text-gray-800">{r.offers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Página {page} de {totalPages} — {data.total} reportes
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
