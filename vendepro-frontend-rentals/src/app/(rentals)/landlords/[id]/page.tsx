'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Building2, FileText, Percent, Globe, Copy, Check } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import Badge from '@/components/shared/Badge'

export default function LandlordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [landlord, setLandlord] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'info' | 'properties' | 'rentals' | 'statements'>('info')
  const [copied, setCopied] = useState(false)
  const [activatingPortal, setActivatingPortal] = useState(false)

  useEffect(() => {
    apiFetch(`/landlords/${id}`).then(setLandlord).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  async function activatePortal() {
    setActivatingPortal(true)
    try {
      const updated = await apiFetch(`/landlords/${id}/portal`, { method: 'POST' })
      setLandlord((prev: any) => ({ ...prev, landlord: { ...prev.landlord, portal_token: updated.portal_token, portal_active: 1 } }))
    } catch {}
    setActivatingPortal(false)
  }

  function copyPortalLink() {
    const token = landlord?.landlord?.portal_token
    if (!token) return
    const url = `${window.location.origin}/landlord-portal/${token}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Cargando...</div>
  if (!landlord) return <div className="p-6 text-gray-500">Propietario no encontrado</div>

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/landlords" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft size={15} /> Volver a propietarios
      </Link>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold" style={{ background: '#ff8017' }}>
          {`${landlord.name?.[0] || ''}${landlord.last_name?.[0] || ''}`.toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900">{landlord.name} {landlord.last_name}</h1>
          <div className="text-sm text-gray-500">{landlord.email || 'Sin email'}</div>
        </div>
        {/* Portal button */}
        {landlord?.landlord?.portal_token ? (
          <button onClick={copyPortalLink} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-all"
            style={{ borderColor: '#8b5cf6', color: '#8b5cf6' }}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copiado' : 'Copiar link portal'}
          </button>
        ) : (
          <button onClick={activatePortal} disabled={activatingPortal} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg text-white transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: '#8b5cf6' }}>
            <Globe size={13} />
            {activatingPortal ? 'Activando...' : 'Activar portal'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Propiedades', value: landlord.properties?.length || 0, icon: Building2, color: '#ff007c' },
          { label: 'Contratos activos', value: landlord.rentals?.filter((r: any) => r.status === 'activo').length || 0, icon: FileText, color: '#16a34a' },
          { label: 'Honorarios', value: `${landlord.admin_fee_percentage || 0}%`, icon: Percent, color: '#ff8017' },
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

      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {(['info', 'properties', 'rentals', 'statements'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'info' ? 'Datos' : t === 'properties' ? 'Propiedades' : t === 'rentals' ? 'Contratos' : 'Liquidaciones'}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              ['Nombre', `${landlord.name} ${landlord.last_name}`],
              ['Email', landlord.email || '—'],
              ['Teléfono', landlord.phone || '—'],
              ['CUIT', landlord.cuit || '—'],
              ['Tipo persona', landlord.person_type === 'juridica' ? 'Jurídica' : 'Física'],
              ['Domicilio', landlord.address || '—'],
              ['CBU', landlord.cbu || '—'],
              ['Alias bancario', landlord.bank_alias || '—'],
              ['% Honorarios', `${landlord.admin_fee_percentage || 0}%`],
            ].map(([l, v]) => (
              <div key={l}>
                <div className="text-xs text-gray-400 mb-0.5">{l}</div>
                <div className="text-gray-900">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'properties' && (
        <div className="grid gap-3">
          {(landlord.properties || []).length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Sin propiedades</div>
          ) : (landlord.properties || []).map((p: any) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">{p.address}</div>
                <div className="text-xs text-gray-500 mt-0.5 capitalize">{p.property_type || '—'} · {p.city || '—'}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">{p.participation_percentage}%</span>
                <Badge status={p.status} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'rentals' && (
        <div className="space-y-3">
          {(landlord.rentals || []).length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Sin contratos</div>
          ) : (landlord.rentals || []).map((r: any) => (
            <Link key={r.id} href={`/rentals/${r.id}`} className="block bg-white rounded-xl border border-gray-100 p-4 hover:border-pink-200">
              <div className="flex items-center justify-between">
                <div className="font-medium text-gray-900">{r.alias}</div>
                <Badge status={r.status} />
              </div>
              <div className="text-xs text-gray-500 mt-1">{r.start_date} → {r.end_date}</div>
            </Link>
          ))}
        </div>
      )}

      {tab === 'statements' && (
        <div className="bg-white rounded-xl border border-gray-100">
          {(landlord.statements || []).length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Sin liquidaciones</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Período</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Ingresos</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Neto</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Estado</th>
                </tr>
              </thead>
              <tbody>
                {(landlord.statements || []).map((s: any) => (
                  <tr key={s.id} className="border-b border-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.period}</td>
                    <td className="px-4 py-3 text-green-700">${Number(s.total_income).toLocaleString('es-AR')}</td>
                    <td className="px-4 py-3 font-semibold">${Number(s.net_amount).toLocaleString('es-AR')}</td>
                    <td className="px-4 py-3"><Badge status={s.status} /></td>
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
