'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Search } from 'lucide-react'
import { landingsApi } from '@/lib/landings/api'
import type { Landing } from '@/lib/landings/types'
import LandingCard from '@/components/landings/LandingCard'
import NewLandingModal from '@/components/landings/NewLandingModal'
import { getCurrentUser } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'

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
      <PageHeader
        className="mb-6"
        title="Landings"
        subtitle="Creá landings con IA a partir de templates curados."
        actions={
          <>
            <Button
              variant="outline"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => { setCreateAsTasacionTemplate(true); setShowCreate(true) }}
            >
              Nueva plantilla de tasación
            </Button>
            <Button
              icon={<Plus className="w-4 h-4" />}
              onClick={() => { setCreateAsTasacionTemplate(false); setShowCreate(true) }}
            >
              Nueva landing
            </Button>
          </>
        }
      />

      <div className="flex items-center gap-4 border-b border-gray-200 mb-4">
        <button onClick={() => setTab('mine')} className={`pb-3 px-1 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'mine' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Mías
        </button>
        {isAdmin && (
          <>
            <button onClick={() => setTab('org')} className={`pb-3 px-1 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'org' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Todas del org
            </button>
            <button onClick={() => setTab('pending_review')} className={`pb-3 px-1 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'pending_review' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
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
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              typeTab === t.id
                ? 'bg-primary/10 text-primary'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Buscar por slug o título…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 bg-gray-100 rounded-card animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          className="bg-white rounded-card border border-dashed border-gray-200"
          title="Todavía no hay landings acá."
          action={
            <Button variant="ghost" onClick={() => setShowCreate(true)}>Crear la primera</Button>
          }
        />
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
