'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileText, DollarSign, CreditCard } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import Badge from '@/components/shared/Badge'

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'info' | 'rentals' | 'payments'>('info')

  useEffect(() => {
    apiFetch(`/tenants/${id}`).then(setTenant).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Cargando...</div>
  if (!tenant) return <div className="p-6 text-gray-500">Inquilino no encontrado</div>

  const initials = `${tenant.name?.[0] || ''}${tenant.last_name?.[0] || ''}`.toUpperCase()

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/tenants" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft size={15} /> Volver a inquilinos
      </Link>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold" style={{ background: '#ff007c' }}>
          {initials}
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{tenant.name} {tenant.last_name}</h1>
          <div className="text-sm text-gray-500">{tenant.email || 'Sin email'}</div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Contratos activos', value: tenant.rentals?.filter((r: any) => r.status === 'activo').length || 0, icon: FileText, color: '#ff007c' },
          { label: 'Total cobros', value: tenant.payments?.length || 0, icon: DollarSign, color: '#16a34a' },
          { label: 'Total pagado', value: `$${(tenant.payments || []).reduce((acc: number, p: any) => acc + (p.amount || 0), 0).toLocaleString('es-AR')}`, icon: CreditCard, color: '#3b82f6' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${k.color}15` }}>
              <k.icon size={18} style={{ color: k.color }} />
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">{k.value}</div>
              <div className="text-xs text-gray-500">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {(['info', 'rentals', 'payments'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'info' ? 'Información' : t === 'rentals' ? 'Contratos' : 'Cobros'}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              ['Nombre', `${tenant.name} ${tenant.last_name}`],
              ['Email', tenant.email || '—'],
              ['Teléfono', tenant.phone || '—'],
              ['DNI/CUIT', tenant.dni_cuit || '—'],
              ['Tipo persona', tenant.person_type === 'juridica' ? 'Jurídica' : 'Física'],
              ['Fecha nac.', tenant.birth_date || '—'],
              ['Nacionalidad', tenant.nationality || '—'],
              ['Est. civil', tenant.marital_status || '—'],
              ['Ocupación', tenant.occupation || '—'],
            ].map(([l, v]) => (
              <div key={l}>
                <div className="text-xs text-gray-400 mb-0.5">{l}</div>
                <div className="text-gray-900">{v}</div>
              </div>
            ))}
          </div>
          {tenant.notes && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="text-xs text-gray-400 mb-1">Notas</div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">{tenant.notes}</div>
            </div>
          )}
        </div>
      )}

      {tab === 'rentals' && (
        <div className="space-y-3">
          {(tenant.rentals || []).length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Sin contratos</div>
          ) : (tenant.rentals || []).map((r: any) => (
            <Link key={r.id} href={`/rentals/${r.id}`} className="block bg-white rounded-xl border border-gray-100 p-4 hover:border-pink-200">
              <div className="flex items-center justify-between">
                <div className="font-medium text-gray-900">{r.alias}</div>
                <Badge status={r.status} />
              </div>
              <div className="text-xs text-gray-500 mt-1">{r.start_date} → {r.end_date} · {r.currency} ${Number(r.current_price).toLocaleString('es-AR')}/mes</div>
            </Link>
          ))}
        </div>
      )}

      {tab === 'payments' && (
        <div className="bg-white rounded-xl border border-gray-100">
          {(tenant.payments || []).length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Sin cobros</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Descripción</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Monto</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Estado</th>
                </tr>
              </thead>
              <tbody>
                {(tenant.payments || []).map((p: any) => (
                  <tr key={p.id} className="border-b border-gray-50">
                    <td className="px-4 py-3 text-gray-900">{p.description || p.payment_type}</td>
                    <td className="px-4 py-3 font-medium">${Number(p.amount).toLocaleString('es-AR')}</td>
                    <td className="px-4 py-3 text-gray-500">{p.payment_date}</td>
                    <td className="px-4 py-3"><Badge status={p.status} /></td>
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
