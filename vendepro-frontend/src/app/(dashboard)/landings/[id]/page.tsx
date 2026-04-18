'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Landing, Block } from '@/lib/landings/types'
import { landingsApi } from '@/lib/landings/api'
import { getCurrentUser } from '@/lib/auth'
import BlockRenderer from '@/components/landings/BlockRenderer'
import BlockListSidebar from '@/components/landings/BlockListSidebar'
import InspectorPanel from '@/components/landings/InspectorPanel'
import AIChatPanel from '@/components/landings/AIChatPanel'
import EditorToolbar from '@/components/landings/EditorToolbar'
import VersionsDrawer from '@/components/landings/VersionsDrawer'
import ConfigDrawer from '@/components/landings/ConfigDrawer'
import PublishReviewBanner from '@/components/landings/PublishReviewBanner'
import AnalyticsDashboard from '@/components/landings/analytics/AnalyticsDashboard'
import { X } from 'lucide-react'

export default function LandingEditorPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const user = typeof window !== 'undefined' ? getCurrentUser() : null
  const isAdmin = user?.role === 'admin' || user?.role === 'owner'

  const [landing, setLanding] = useState<Landing | null>(null)
  const [blocks, setBlocks] = useState<Block[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [rightTab, setRightTab] = useState<'inspector' | 'ai'>('inspector')
  const [viewport, setViewport] = useState<'mobile' | 'desktop'>('desktop')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const saveTimer = useRef<any>(null)

  useEffect(() => {
    landingsApi.get(params.id).then(r => {
      setLanding(r.landing)
      setBlocks(r.landing.blocks)
      setSelectedId(r.landing.blocks[0]?.id ?? null)
    })
  }, [params.id])

  // Auto-save throttled (30s)
  useEffect(() => {
    if (!dirty || !landing) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        await landingsApi.updateBlocks(landing.id, blocks, 'auto-save')
        setDirty(false)
      } finally { setSaving(false) }
    }, 30000)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [dirty, blocks, landing])

  const updateBlock = useCallback((blockId: string, patch: Partial<Block['data']>) => {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, data: { ...b.data, ...patch } } as Block : b))
    setDirty(true)
  }, [])

  const selectedBlock = useMemo(() => blocks.find(b => b.id === selectedId) ?? null, [blocks, selectedId])

  async function manualSave() {
    if (!landing) return
    setSaving(true)
    try { await landingsApi.updateBlocks(landing.id, blocks, 'manual-save'); setDirty(false) }
    finally { setSaving(false) }
  }

  async function refresh() {
    if (!landing) return
    const r = await landingsApi.get(landing.id)
    setLanding(r.landing); setBlocks(r.landing.blocks); setDirty(false)
  }

  if (!landing) return <div className="p-12 text-center text-gray-500">Cargando editor…</div>

  const viewportClass = viewport === 'mobile' ? 'max-w-[420px]' : 'max-w-5xl'

  return (
    <div className="h-[calc(100vh-0px)] flex flex-col bg-gray-50">
      <EditorToolbar
        landing={landing} isAdmin={isAdmin} dirty={dirty} saving={saving}
        onOpenVersions={() => setShowVersions(true)}
        onOpenConfig={() => setShowConfig(true)}
        onOpenAnalytics={() => setShowAnalytics(true)}
        onOpenPreview={() => window.open(`/landings/${landing.id}/preview`, '_blank')}
        onRequestPublish={async () => { await manualSave(); await landingsApi.requestPublish(landing.id); await refresh() }}
        onPublish={async () => { await manualSave(); await landingsApi.publish(landing.id); await refresh() }}
        onRejectPublish={async (note) => { await landingsApi.rejectPublish(landing.id, note); await refresh() }}
      />

      {landing.status === 'draft' && landing.last_review_note && <PublishReviewBanner note={landing.last_review_note} />}

      <div className="flex-1 grid grid-cols-[240px_1fr_340px] min-h-0">
        <BlockListSidebar
          blocks={blocks}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onReorder={(ordered) => { setBlocks(ordered); setDirty(true) }}
          onRemove={async (bid) => { await landingsApi.removeBlock(landing.id, bid); await refresh() }}
          onToggleVisibility={(bid, v) => {
            setBlocks(prev => prev.map(b => b.id === bid ? { ...b, visible: v } : b))
            setDirty(true)
          }}
          onAdd={async (block) => { await landingsApi.addBlock(landing.id, block); await refresh() }}
        />

        <div className="flex flex-col bg-gray-100 overflow-hidden">
          <div className="flex gap-2 justify-center p-2 border-b border-gray-200 bg-white">
            <button onClick={() => setViewport('mobile')} className={`text-xs px-3 py-1.5 rounded-md ${viewport === 'mobile' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}>📱 Móvil</button>
            <button onClick={() => setViewport('desktop')} className={`text-xs px-3 py-1.5 rounded-md ${viewport === 'desktop' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}>💻 Desktop</button>
            <span className="mx-2 w-px bg-gray-200" />
            <button onClick={manualSave} disabled={!dirty || saving} className="text-xs px-3 py-1.5 rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-50">Guardar</button>
          </div>
          <div className="flex-1 overflow-auto py-6 px-4">
            <div className={`mx-auto bg-white rounded-2xl shadow-md overflow-hidden ${viewportClass}`}>
              <BlockRenderer
                blocks={blocks}
                mode="editor"
                selectedBlockId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          </div>
        </div>

        <aside className="bg-white border-l border-gray-200 flex flex-col overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button onClick={() => setRightTab('inspector')} className={`flex-1 py-3 text-sm font-medium ${rightTab === 'inspector' ? 'border-b-2 border-[#ff007c] text-gray-900' : 'text-gray-500'}`}>Inspector</button>
            <button onClick={() => setRightTab('ai')} className={`flex-1 py-3 text-sm font-medium ${rightTab === 'ai' ? 'border-b-2 border-[#ff007c] text-gray-900' : 'text-gray-500'}`}>✨ Chat IA</button>
          </div>
          <div className="flex-1 overflow-auto">
            {rightTab === 'inspector' && selectedBlock && (
              <InspectorPanel block={selectedBlock} onChange={(patch) => updateBlock(selectedBlock.id, patch)} />
            )}
            {rightTab === 'ai' && (
              <AIChatPanel
                landingId={landing.id}
                selectedBlockId={selectedId}
                onProposalAccepted={async () => { await refresh() }}
              />
            )}
          </div>
        </aside>
      </div>

      {showVersions && <VersionsDrawer landingId={landing.id} onClose={() => setShowVersions(false)} onRollback={refresh} />}
      {showConfig && <ConfigDrawer landing={landing} onClose={() => setShowConfig(false)} onSaved={refresh} />}
      {showAnalytics && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowAnalytics(false)}>
          <aside className="absolute right-0 top-0 h-full w-[520px] bg-gray-50 shadow-xl overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
              <h2 className="font-semibold text-gray-900">Analytics</h2>
              <button onClick={() => setShowAnalytics(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4">
              <AnalyticsDashboard landingId={landing.id} />
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
