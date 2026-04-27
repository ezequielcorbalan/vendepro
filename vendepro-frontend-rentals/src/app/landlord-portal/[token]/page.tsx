'use client'

import { use, useEffect, useState } from 'react'
import { Building2, FileText, DollarSign, TrendingDown, CheckCircle, Clock, AlertCircle, House } from 'lucide-react'
import { API_BASE } from '@/lib/constants'

export default function LandlordPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API_BASE}/landlord-portal/${token}`)
      .then(r => {
        if (!r.ok) throw new Error('Portal no encontrado o link inválido')
        return r.json()
      })
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-400">Cargando...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={22} className="text-red-500" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Link inválido</h1>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  const l = data?.landlord
  const fullName = `${l?.name || ''} ${l?.last_name || ''}`.trim()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-100" style={{ background: '#1a0d2e' }}>
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,0,124,0.2)' }}>
            <House size={16} color="#ff007c" />
          </div>
          <div>
            <div className="text-white font-semibold text-sm">VendéPro Alquileres</div>
            <div className="text-purple-300 text-xs">Portal del propietario</div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Landlord card */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #ff007c, #ff8017)' }}>
              {fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-gray-900">{fullName}</div>
              {l?.email && <div className="text-xs text-gray-500">{l.email}</div>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Propiedades', value: data?.properties?.length || 0, icon: Building2, color: '#8b5cf6' },
              { label: 'Contratos activos', value: data?.rentals?.length || 0, icon: FileText, color: '#ff007c' },
              { label: 'Liquidaciones', value: data?.statements?.length || 0, icon: DollarSign, color: '#ff8017' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="text-center p-3 rounded-lg bg-gray-50">
                <Icon size={18} style={{ color }} className="mx-auto mb-1" />
                <div className="text-xl font-bold text-gray-900">{value}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Properties */}
        {data?.properties?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <Building2 size={15} className="text-purple-500" />
              <span className="text-sm font-semibold text-gray-900">Mis propiedades</span>
            </div>
            {data.properties.map((p: any) => (
              <div key={p.id} className="px-5 py-3 border-b border-gray-50 last:border-0 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium text-gray-900">{p.address}{p.floor_unit ? ` — ${p.floor_unit}` : ''}</div>
                  {p.city && <div className="text-xs text-gray-500">{p.city}{p.province ? `, ${p.province}` : ''}</div>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  p.status === 'ocupada' ? 'bg-green-100 text-green-700' :
                  p.status === 'en_mantenimiento' ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{p.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* Active contracts */}
        {data?.rentals?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <FileText size={15} className="text-pink-500" />
              <span className="text-sm font-semibold text-gray-900">Contratos activos</span>
            </div>
            {data.rentals.map((r: any) => (
              <div key={r.id} className="px-5 py-3 border-b border-gray-50 last:border-0 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium text-gray-900">{r.alias}</div>
                  <span className="font-semibold text-gray-900">{r.currency} ${Number(r.current_price).toLocaleString('es-AR')}/mes</span>
                </div>
                <div className="text-xs text-gray-500">Vence: {r.end_date} · Día de pago: {r.payment_day}</div>
              </div>
            ))}
          </div>
        )}

        {/* Recent statements */}
        {data?.statements?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <TrendingDown size={15} className="text-orange-500" />
              <span className="text-sm font-semibold text-gray-900">Liquidaciones recientes</span>
            </div>
            {data.statements.slice(0, 6).map((s: any) => (
              <div key={s.id} className="px-5 py-3 border-b border-gray-50 last:border-0 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium text-gray-900">{s.period}</div>
                  <div className="text-xs text-gray-500">
                    Ingresos ${Number(s.total_income).toLocaleString('es-AR')} · Gastos ${Number(s.total_expenses).toLocaleString('es-AR')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">${Number(s.net_amount).toLocaleString('es-AR')}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    s.status === 'pagada' ? 'bg-green-100 text-green-700' :
                    s.status === 'enviada' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>{s.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!data?.properties?.length && !data?.rentals?.length && (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
            <Building2 size={28} className="text-gray-300 mx-auto mb-2" />
            <div className="text-sm text-gray-500">No hay datos disponibles aún</div>
          </div>
        )}

        <div className="text-center text-xs text-gray-400 pb-4">VendéPro Alquileres · Vista de solo lectura</div>
      </div>
    </div>
  )
}
