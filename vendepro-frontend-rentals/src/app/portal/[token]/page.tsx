'use client'

import { use, useState } from 'react'
import { House, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { API_BASE } from '@/lib/constants'

export default function TenantPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [step, setStep] = useState<'auth' | 'data'>('auth')
  const [dni, setDni] = useState('')
  const [pin, setPin] = useState('')
  const [authError, setAuthError] = useState('')
  const [sessionToken, setSessionToken] = useState('')
  const [portalData, setPortalData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setAuthError('')
    try {
      const res = await fetch(`${API_BASE}/portal/${token}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni, pin }),
      })
      const data = await res.json() as any
      if (!res.ok) { setAuthError(data.error || 'DNI o PIN incorrecto'); return }
      setSessionToken(data.session_token)
      const portal = await fetch(`${API_BASE}/portal/${token}/data`, {
        headers: { Authorization: `Bearer ${data.session_token}` },
      })
      const pdata = await portal.json() as any
      setPortalData(pdata)
      setStep('data')
    } catch { setAuthError('Error de conexión') } finally { setLoading(false) }
  }

  if (step === 'auth') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(255,0,124,0.1)' }}>
              <House size={22} color="#ff007c" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Portal del inquilino</h1>
            <p className="text-sm text-gray-500 mt-1 text-center">Ingresá tu DNI y el PIN que te proporcionó tu administrador</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="label">DNI / CUIT</label>
              <input className="input" value={dni} onChange={e => setDni(e.target.value)} placeholder="12345678" required />
            </div>
            <div>
              <label className="label">PIN</label>
              <input className="input" type="password" maxLength={6} value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" required />
            </div>
            {authError && <p className="text-sm text-red-600">{authError}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const d = portalData
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <House size={20} color="#ff007c" />
          <span className="font-semibold text-gray-900">VendéPro Alquileres</span>
        </div>

        {/* Contract card */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">{d?.rental?.alias}</h2>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{d?.rental?.status}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Precio actual', `${d?.rental?.currency} $${Number(d?.rental?.current_price || 0).toLocaleString('es-AR')}`],
              ['Día de pago', `Día ${d?.rental?.payment_day}`],
              ['Inicio', d?.rental?.start_date],
              ['Vencimiento', d?.rental?.end_date],
            ].map(([l, v]) => (
              <div key={l}>
                <div className="text-xs text-gray-400">{l}</div>
                <div className="font-medium text-gray-900">{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming payments */}
        {d?.upcoming_payments && d.upcoming_payments.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 mb-4">
            <div className="px-5 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Próximos cobros</div>
            {d.upcoming_payments.slice(0, 3).map((u: any) => (
              <div key={u.id} className="flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-0 text-sm">
                <div className="flex items-center gap-2">
                  {u.status === 'cobrado' ? <CheckCircle size={15} className="text-green-500" />
                    : u.status === 'vencido' ? <AlertCircle size={15} className="text-red-500" />
                    : <Clock size={15} className="text-orange-400" />}
                  <span>{u.period}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">${Number(u.expected_amount).toLocaleString('es-AR')}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.status === 'cobrado' ? 'bg-green-100 text-green-700' : u.status === 'vencido' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>{u.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recent payments */}
        {d?.payments && d.payments.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="px-5 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Cobros recientes</div>
            {d.payments.slice(0, 5).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-0 text-sm">
                <div>
                  <div className="font-medium text-gray-900">{p.description || p.payment_type}</div>
                  <div className="text-xs text-gray-400">{p.payment_date}</div>
                </div>
                <span className="font-medium text-gray-900">${Number(p.amount).toLocaleString('es-AR')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
