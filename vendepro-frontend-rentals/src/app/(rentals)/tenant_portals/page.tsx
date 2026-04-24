'use client'

import { useEffect, useState } from 'react'
import { Globe, Copy, ExternalLink } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import EmptyState from '@/components/shared/EmptyState'

export default function TenantPortalsPage() {
  const [portals, setPortals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch('/portals')
      setPortals(data.portals || data || [])
    } catch { setPortals([]) }
    setLoading(false)
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/portal/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(token)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Globe size={18} className="text-pink-500" />
        <h1 className="text-xl font-semibold text-gray-900">Portales de inquilinos</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">Portales activos donde los inquilinos pueden consultar su contrato y cobros</p>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
      ) : portals.length === 0 ? (
        <EmptyState
          title="Sin portales activos"
          description="Activá el portal en la configuración de un contrato"
        />
      ) : (
        <div className="grid gap-4">
          {portals.map(p => (
            <div key={p.rental_id} className="bg-white rounded-xl border border-gray-100 p-5 flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">{p.rental_alias}</div>
                <div className="text-xs text-gray-500 mt-0.5">PIN: {p.portal_pin} · Token: {p.portal_token?.slice(0, 8)}...</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => copyLink(p.portal_token)} className="btn-secondary text-xs">
                  <Copy size={13} /> {copied === p.portal_token ? '¡Copiado!' : 'Copiar link'}
                </button>
                <a href={`/portal/${p.portal_token}`} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
                  <ExternalLink size={13} /> Abrir
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
