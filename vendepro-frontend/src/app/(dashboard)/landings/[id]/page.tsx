'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Smartphone, Monitor, Sparkles } from 'lucide-react'
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
import LandingMobileInfo from '@/components/landings/LandingMobileInfo'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Tabs } from '@/components/ui/Tabs'
import { Drawer } from '@/components/ui/Drawer'

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

  const updateBlockMeta = useCallback((blockId: string, patch: Partial<Pick<Block, 'is_variable' | 'visible'>>) => {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, ...patch } as Block : b))
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

  if (!landing) return <div className="p-12 text-center text-gray-500">Cargando…</div>

  const viewportClass = viewport === 'mobile' ? 'max-w-[420px]' : 'max-w-5xl'

  return (
    <>
      {/* Mobile (< lg): info + URL, sin editor */}
      <div className="lg:hidden">
        <LandingMobileInfo landing={landing} />
      </div>

      {/* Desktop (>= lg): editor completo 3-panes */}
      <div className="hidden lg:flex h-[calc(100vh-0px)] flex-col bg-gray-50">
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
          <div className="flex gap-2 justify-center items-center p-2 border-b border-gray-200 bg-white">
            <SegmentedControl
              options={[
                { value: 'mobile', label: 'Móvil', icon: <Smartphone className="w-3.5 h-3.5" /> },
                { value: 'desktop', label: 'Desktop', icon: <Monitor className="w-3.5 h-3.5" /> },
              ]}
              value={viewport}
              onChange={(v) => setViewport(v as 'mobile' | 'desktop')}
            />
            <span className="mx-2 w-px self-stretch bg-gray-200" />
            <Button variant="ghost" onClick={manualSave} disabled={!dirty || saving}>Guardar</Button>
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
          <Tabs
            items={[
              { value: 'inspector', label: 'Inspector' },
              { value: 'ai', label: 'Chat IA', icon: <Sparkles className="w-3.5 h-3.5" /> },
            ]}
            value={rightTab}
            onChange={(v) => setRightTab(v as 'inspector' | 'ai')}
          />
          <div className="flex-1 overflow-auto">
            {rightTab === 'inspector' && selectedBlock && (
              <InspectorPanel
                block={selectedBlock}
                onChange={(patch) => updateBlock(selectedBlock.id, patch)}
                onBlockChange={(patch) => updateBlockMeta(selectedBlock.id, patch)}
              />
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
        <Drawer open onClose={() => setShowAnalytics(false)} title="Analytics" width="w-[520px]">
          <AnalyticsDashboard landingId={landing.id} />
        </Drawer>
      )}
      </div>
    </>
  )
}
