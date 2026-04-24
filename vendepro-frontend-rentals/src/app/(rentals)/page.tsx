'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText, DollarSign, Clock, TrendingDown, AlertCircle, ChevronRight } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import Badge from '@/components/shared/Badge'

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string
  icon: React.FC<{ size?: number; className?: string; style?: React.CSSProperties }>; color: string
}) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-xs font-medium text-gray-500 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/dashboard')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const kpis = data || {}

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Resumen del mes actual</p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 text-sm">Cargando...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <KpiCard label="Contratos activos" value={kpis.active_rentals ?? '—'} icon={FileText} color="#ff007c" />
            <KpiCard label="Cobros del mes" value={kpis.payments_count ?? '—'} sub={kpis.payments_total ? `$${Number(kpis.payments_total).toLocaleString('es-AR')}` : undefined} icon={DollarSign} color="#16a34a" />
            <KpiCard label="Cobros pendientes" value={kpis.upcoming_pending ?? '—'} icon={Clock} color="#ff8017" />
            <KpiCard label="Gastos del mes" value={kpis.expenses_total ? `$${Number(kpis.expenses_total).toLocaleString('es-AR')}` : '—'} icon={TrendingDown} color="#dc2626" />
          </div>

          {/* Upcoming payments */}
          {kpis.upcoming_list && kpis.upcoming_list.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 mb-4">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <AlertCircle size={16} className="text-orange-500" />
                  Cobros pendientes próximos
                </div>
                <Link href="/upcoming_payments" className="text-xs text-pink-600 hover:underline flex items-center gap-1">
                  Ver todos <ChevronRight size={12} />
                </Link>
              </div>
              <div className="divide-y divide-gray-50">
                {kpis.upcoming_list.slice(0, 5).map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <div className="font-medium text-gray-900">{u.rental_alias || u.rental_id}</div>
                      <div className="text-xs text-gray-500">{u.period} · Vence {u.expected_date}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900">${Number(u.expected_amount).toLocaleString('es-AR')}</span>
                      <Badge status={u.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contracts expiring soon */}
          {kpis.expiring_soon && kpis.expiring_soon.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 text-sm font-medium text-gray-900">
                <Clock size={16} className="text-orange-500" />
                Contratos por vencer (próximos 60 días)
              </div>
              <div className="divide-y divide-gray-50">
                {kpis.expiring_soon.map((r: any) => (
                  <Link key={r.id} href={`/rentals/${r.id}`} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-gray-50">
                    <span className="font-medium text-gray-900">{r.alias}</span>
                    <span className="text-gray-500 text-xs">Vence {r.end_date}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {!data && (
            <div className="text-center py-12 text-gray-400 text-sm">
              No se pudo cargar el dashboard. Verificá tu conexión.
            </div>
          )}
        </>
      )}
    </div>
  )
}
