'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Globe } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import Badge from '@/components/shared/Badge'

export default function RentalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [rental, setRental] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'info' | 'payments' | 'upcoming' | 'adjustments'>('info')

  useEffect(() => {
    apiFetch(`/rentals/${id}`).then(setRental).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  async function togglePaymentStatus(paymentId: string) {
    try {
      await apiFetch(`/payments/${paymentId}/toggle-status`, { method: 'PUT' })
      const updated = await apiFetch(`/rentals/${id}`)
      setRental(updated)
    } catch {}
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Cargando...</div>
  if (!rental) return <div className="p-6 text-gray-500">Contrato no encontrado</div>

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/rentals" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft size={15} /> Volver a contratos
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{rental.alias}</h1>
          <div className="text-sm text-gray-500 capitalize mt-0.5">{rental.rental_type}</div>
        </div>
        <Badge status={rental.status} />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Precio actual', value: `${rental.currency} $${Number(rental.current_price).toLocaleString('es-AR')}` },
          { label: 'Inicio', value: rental.start_date },
          { label: 'Vencimiento', value: rental.end_date },
          { label: 'Depósito', value: rental.deposit_months ? `${rental.deposit_months} mes${rental.deposit_months !== 1 ? 'es' : ''}` : '—' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="text-xs text-gray-400 mb-1">{k.label}</div>
            <div className="text-sm font-semibold text-gray-900">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {(['info', 'payments', 'upcoming', 'adjustments'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'info' ? 'Información' : t === 'payments' ? 'Cobros' : t === 'upcoming' ? 'Pendientes' : 'Ajustes'}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Datos del contrato</h3>
            <div className="space-y-3 text-sm">
              {[
                ['Alias', rental.alias],
                ['Tipo', rental.rental_type],
                ['Duración', `${rental.duration_months} meses`],
                ['Día de pago', `Día ${rental.payment_day}`],
                ['Moneda', rental.currency],
                ['Precio inicial', `$${Number(rental.initial_price).toLocaleString('es-AR')}`],
                ['IVA', rental.applies_iva ? 'Sí' : 'No'],
                ['Ajuste', rental.adjustment_type || '—'],
                ['Frecuencia ajuste', rental.adjustment_frequency || '—'],
                ['Garantía', rental.guarantee_type || '—'],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between">
                  <span className="text-gray-500">{l}</span>
                  <span className="text-gray-900 font-medium">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {/* Tenants */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Inquilinos</h3>
              {(rental.tenants || []).length === 0 ? <div className="text-sm text-gray-400">Sin inquilinos</div>
              : (rental.tenants || []).map((t: any) => (
                <Link key={t.id} href={`/tenants/${t.id}`} className="flex items-center justify-between text-sm hover:text-pink-600 py-1">
                  <span className="font-medium">{t.name} {t.last_name}</span>
                  <span className="text-gray-400">{t.email}</span>
                </Link>
              ))}
            </div>
            {/* Properties */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Propiedades</h3>
              {(rental.properties || []).length === 0 ? <div className="text-sm text-gray-400">Sin propiedades</div>
              : (rental.properties || []).map((p: any) => (
                <div key={p.id} className="text-sm py-1">
                  <div className="font-medium text-gray-900">{p.address}</div>
                  <div className="text-xs text-gray-400">{p.city}</div>
                </div>
              ))}
            </div>
            {/* Portal */}
            {rental.portal_active && (
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Globe size={14} className="text-pink-500" />
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Portal activo</h3>
                </div>
                <a href={`/portal/${rental.portal_token}`} target="_blank" rel="noopener noreferrer" className="text-sm text-pink-600 hover:underline">
                  Ver portal →
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="bg-white rounded-xl border border-gray-100">
          {(rental.payments || []).length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Sin cobros registrados</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Descripción</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Monto</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {(rental.payments || []).map((p: any) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.description || p.payment_type}</td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{p.payment_type}</td>
                    <td className="px-4 py-3 font-medium">${Number(p.amount).toLocaleString('es-AR')}</td>
                    <td className="px-4 py-3 text-gray-500">{p.payment_date}</td>
                    <td className="px-4 py-3"><Badge status={p.status} /></td>
                    <td className="px-4 py-3">
                      <button onClick={() => togglePaymentStatus(p.id)} className="text-xs text-gray-400 hover:text-gray-700 underline">
                        {p.status === 'pagado' ? 'Pendiente' : 'Pagado'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'upcoming' && (
        <div className="bg-white rounded-xl border border-gray-100">
          {(rental.upcoming_payments || []).length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Sin cobros pendientes generados</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Período</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Vencimiento</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Monto</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Estado</th>
                </tr>
              </thead>
              <tbody>
                {(rental.upcoming_payments || []).map((u: any) => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.period}</td>
                    <td className="px-4 py-3 text-gray-500">{u.expected_date}</td>
                    <td className="px-4 py-3 font-medium">${Number(u.expected_amount).toLocaleString('es-AR')}</td>
                    <td className="px-4 py-3"><Badge status={u.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'adjustments' && (
        <div className="bg-white rounded-xl border border-gray-100">
          {(rental.price_adjustments || []).length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Sin ajustes de precio registrados</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Precio anterior</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Precio nuevo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Variación</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {(rental.price_adjustments || []).map((a: any) => (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{a.adjustment_date}</td>
                    <td className="px-4 py-3">${Number(a.previous_price).toLocaleString('es-AR')}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">${Number(a.new_price).toLocaleString('es-AR')}</td>
                    <td className="px-4 py-3 text-green-600">+{a.adjustment_percentage?.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{a.adjustment_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
