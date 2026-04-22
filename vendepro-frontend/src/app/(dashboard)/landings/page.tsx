'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Search } from 'lucide-react'
import { landingsApi } from '@/lib/landings/api'
import type { Landing } from '@/lib/landings/types'
import LandingCard from '@/components/landings/LandingCard'
import NewLandingModal from '@/components/landings/NewLandingModal'
import { getCurrentUser } from '@/lib/auth'

type Tab = 'mine' | 'org' | 'pending_review'
type TypeTab = 'all' | 'marketing' | 'tasacion'

export default function LandingsPage() {
  const searchParams = useSearchParams()
  const [landings, setLandings] = useState<Landing[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('mine')
  const [typeTab, setTypeTab] = useState<TypeTab>('all')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [createAsTasacionTemplate, setCreateAsTasacionTemplate] = useState(false)
  const user = typeof window !== 'undefined' ? getCurrentUser() : null
  const isAdmin = user?.role === 'admin' || user?.role === 'owner'

  useEffect(() => {
    if (searchParams.get('create_template') === '1') {
      setCreateAsTasacionTemplate(true)
      setShowCreate(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true
    setLoading(true)
    landingsApi.list({ scope: tab })
      .then(r => { if (alive) setLandings(r.landings) })
      .catch(() => { if (alive) setLandings([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [tab])

  const filtered = landings.filter(l => {
    if (typeTab === 'tasacion' && l.template_type !== 'tasacion') return false
    if (typeTab === 'marketing' && l.template_type === 'tasacion') return false
    if (search) {
      const q = search.toLowerCase()
      const inSlug = l.full_slug.includes(q)
      const inTitle = (l.seo_title ?? '').toLowerCase().includes(q)
      if (!inSlug && !inTitle) return false
    }
    return true
  })

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Landings</h1>
          <p className="text-sm text-gray-500 mt-1">Creá landings con IA a partir de templates curados.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setCreateAsTasacionTemplate(true); setShowCreate(true) }}
            className="inline-flex items-center gap-2 bg-white border border-[#ff007c] text-[#ff007c] hover:bg-[#ff007c]/5 font-semibold px-4 py-2.5 rounded-full text-sm"
          >
            <Plus className="w-4 h-4" /> Nueva plantilla de tasación
          </button>
          <button
            onClick={() => { setCreateAsTasacionTemplate(false); setShowCreate(true) }}
            className="inline-flex items-center gap-2 bg-[#ff007c] hover:bg-[#e60070] text-white font-semibold px-5 py-2.5 rounded-full"
          >
            <Plus className="w-4 h-4" /> Nueva landing
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 border-b border-gray-200 mb-4">
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

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {([
          { id: 'all', label: 'Todas' },
          { id: 'marketing', label: 'Marketing' },
          { id: 'tasacion', label: 'Plantillas de tasación' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTypeTab(t.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              typeTab === t.id
                ? 'bg-[#ff007c] text-white border-[#ff007c]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
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

      {showCreate && (
        <NewLandingModal
          onClose={() => { setShowCreate(false); setCreateAsTasacionTemplate(false) }}
          asTasacionTemplate={createAsTasacionTemplate}
        />
      )}
    </div>
  )
}
