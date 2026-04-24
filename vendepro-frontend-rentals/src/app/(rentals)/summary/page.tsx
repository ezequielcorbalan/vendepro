'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { apiFetch } from '@/lib/api'

export default function SummaryPage() {
  const now = new Date()
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [period])

  async function load() {
    setLoading(true)
    try {
      const d = await apiFetch(`/summary?period=${period}`)
      setData(d)
    } catch { setData(null) }
    setLoading(false)
  }

  const chartData = data ? [
    { name: 'Cobros', valor: data.total_payments || 0, fill: '#16a34a' },
    { name: 'Gastos', valor: data.total_expenses || 0, fill: '#dc2626' },
    { name: 'Servicios', valor: data.total_services || 0, fill: '#ff8017' },
    { name: 'Otros ing.', valor: data.total_other_income || 0, fill: '#3b82f6' },
  ] : []

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Resumen del mes</h1>
        <input
          type="month"
          className="input w-auto"
          value={period}
          onChange={e => setPeriod(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 text-sm">Cargando...</div>
      ) : !data ? (
        <div className="text-center py-20 text-gray-400 text-sm">Sin datos para este período</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total cobros', value: data.total_payments, color: '#16a34a' },
              { label: 'Total gastos', value: data.total_expenses, color: '#dc2626' },
              { label: 'Balance neto', value: (data.total_payments || 0) - (data.total_expenses || 0) - (data.total_services || 0), color: '#ff007c' },
              { label: 'Honorarios', value: data.total_admin_fees, color: '#ff8017' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl p-5 border border-gray-100">
                <div className="text-xl font-bold" style={{ color: k.color }}>${Number(k.value || 0).toLocaleString('es-AR')}</div>
                <div className="text-xs text-gray-500 mt-1">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Resumen financiero</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => [`$${Number(v).toLocaleString('es-AR')}`, '']} />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, idx) => (
                    <rect key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Per-landlord breakdown */}
          {data.landlord_summary && data.landlord_summary.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100">
              <div className="px-5 py-3.5 border-b border-gray-100 text-sm font-semibold text-gray-900">Resumen por propietario</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Propietario</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Cobros</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Gastos</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Honorarios</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {data.landlord_summary.map((l: any) => (
                    <tr key={l.landlord_id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{l.landlord_name}</td>
                      <td className="px-4 py-3 text-green-700">${Number(l.total_income).toLocaleString('es-AR')}</td>
                      <td className="px-4 py-3 text-red-600">${Number(l.total_expenses).toLocaleString('es-AR')}</td>
                      <td className="px-4 py-3 text-orange-600">${Number(l.admin_fee).toLocaleString('es-AR')}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">${Number(l.net_amount).toLocaleString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
