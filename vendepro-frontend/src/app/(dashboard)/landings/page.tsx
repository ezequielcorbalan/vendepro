'use client'
import { useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { landingsApi } from '@/lib/landings/api'
import type { Landing } from '@/lib/landings/types'
import LandingCard from '@/components/landings/LandingCard'
import NewLandingModal from '@/components/landings/NewLandingModal'
import { getCurrentUser } from '@/lib/auth'

type Tab = 'mine' | 'org' | 'pending_review'

export default function LandingsPage() {
  const [landings, setLandings] = useState<Landing[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('mine')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const user = typeof window !== 'undefined' ? getCurrentUser() : null
  const isAdmin = user?.role === 'admin' || user?.role === 'owner'

  useEffect(() => {
    let alive = true
    setLoading(true)
    landingsApi.list({ scope: tab })
      .then(r => { if (alive) setLandings(r.landings) })
      .catch(() => { if (alive) setLandings([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [tab])

  const filtered = landings.filter(l =>
    !search || l.full_slug.includes(search.toLowerCase()) || (l.seo_title ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Landings</h1>
          <p className="text-sm text-gray-500 mt-1">Creá landings con IA a partir de templates curados.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 bg-[#ff007c] hover:bg-[#e60070] text-white font-semibold px-5 py-2.5 rounded-full"
        >
          <Plus className="w-4 h-4" /> Nueva landing
        </button>
      </div>

      <div className="flex items-center gap-4 border-b border-gray-200 mb-6">
        <button onClick={() => setTab('mine')} className={`pb-3 px-1 text-sm font-medium ${tab === 'mine' ? 'border-b-2 border-[#ff007c] text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          Mías
        </button>
        {isAdmin && (
          <>
            <button onClick={() => setTab('org')} className={`pb-3 px-1 text-sm font-medium ${tab === 'org' ? 'border-b-2 border-[#ff007c] text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              Todas del org
            </button>
            <button onClick={() => setTab('pending_review')} className={`pb-3 px-1 text-sm font-medium ${tab === 'pending_review' ? 'border-b-2 border-[#ff007c] text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              Pendientes de aprobación
            </button>
          </>
        )}
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          placeholder="Buscar por slug o título…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-full pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-[#ff007c]"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
          <p className="text-gray-500">Todavía no hay landings acá.</p>
          <button onClick={() => setShowCreate(true)} className="mt-4 text-[#ff007c] font-medium">Crear la primera</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(l => <LandingCard key={l.id} landing={l} />)}
        </div>
      )}

      {showCreate && <NewLandingModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
