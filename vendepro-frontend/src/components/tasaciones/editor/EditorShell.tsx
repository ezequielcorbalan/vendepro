'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Loader2, CheckCircle2, AlertCircle, PanelLeftClose, PanelLeftOpen, Wand2 } from 'lucide-react'
import { useEditorState } from './useEditorState'
import { useAutosave } from './useAutosave'
import { BlockList } from './BlockList'
import { SyncBanner } from './SyncBanner'
import { EditableCanvas, PALETTE, isWebOnly } from './EditableCanvas'
import { FREE_BLOCK_TYPES } from '../renderer/types'
import { TemplateRenderer } from '../renderer/TemplateRenderer'
import { publishAppraisal, generatePdf, addComparable, updateComparable, deleteComparable } from '../shared/api'
import type { ComparableData } from '../shared/ComparableCard'
import { ComparablesSection, type ComparableItem } from '../shared/ComparablesSection'
import { apiFetch } from '@/lib/api'
import {
  calcWeightedArea,
  DEFAULT_SURFACE_WEIGHTS,
  isValidWeights,
  type SurfaceWeights,
} from '@/lib/surface-weights'
import type { TemplateBlock, AppraisalContext, RenderMode } from '../renderer/types'

interface Props {
  initial: any
  snapshot: TemplateBlock[]
  context: 'appraisal' | 'template'
}

interface OrgCtx { name: string; logo_url: string | null; brand_color: string | null; brand_accent_color: string | null }

function buildCtx(a: any, org: OrgCtx | null): AppraisalContext {
  return {
    id: a.id,
    property_address: a.property_address,
    neighborhood: a.neighborhood ?? null,
    city: a.city ?? null,
    property_type: a.property_type ?? null,
    covered_area: a.covered_area ?? null,
    total_area: a.total_area ?? null,
    semi_area: a.semi_area ?? null,
    weighted_area: a.weighted_area ?? null,
    swot: { strengths: a.strengths ?? null, weaknesses: a.weaknesses ?? null, opportunities: a.opportunities ?? null, threats: a.threats ?? null },
    prices: { suggested: a.suggested_price ?? null, test: a.test_price ?? null, expected_close: a.expected_close_price ?? null, usd_per_m2: a.usd_per_m2 ?? null },
    comparables: a.comparables ?? [],
    agent: a.agent ?? (a.agent_name ? { name: a.agent_name, phone: a.agent_phone ?? null, email: a.agent_email ?? null, avatar_url: a.agent_avatar_url ?? null } : null),
    org: a.org ?? org,
  }
}

export function EditorShell({ initial, snapshot, context }: Props) {
  const [state, dispatch] = useEditorState(initial, snapshot)
  const [mode, setMode] = useState<RenderMode>('web')
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)
  const [openBlockId, setOpenBlockId] = useState<string | null>(null)

  const addBlock = useCallback((type: Parameters<typeof isWebOnly>[0], atIndex: number) => {
    const seed = PALETTE.find(p => p.type === type)?.seed ?? {}
    dispatch({ type: 'add_block', blockType: type, atIndex, data: seed, webOnly: isWebOnly(type) })
  }, [dispatch])
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'generating' | 'error'>('idle')
  const [monthlyUsed, setMonthlyUsed] = useState<number | null>(null)

  const [weights, setWeights] = useState<SurfaceWeights>(DEFAULT_SURFACE_WEIGHTS)
  const [orgCtx, setOrgCtx] = useState<OrgCtx | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Comparables se manejan aparte del autosave del appraisal: cada uno tiene
  // su propia tabla y endpoints. Mantenemos una lista local que sincronizamos
  // contra los endpoints add/update/delete.
  const [comparables, setComparables] = useState<Array<ComparableData & { id: string; sort_order?: number }>>(
    () => (initial.comparables ?? []).map((c: any) => ({ ...c }))
  )
  const compSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  // Comparables guardan fire & forget; si falla la persistencia avisamos al
  // usuario en vez de tragarnos el error en consola (puede creer que guardó).
  const [compError, setCompError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch('admin', '/org-settings').then(r => r.json() as Promise<any>).then(d => {
      if (isValidWeights(d.surface_weights)) setWeights(d.surface_weights)
      if (d.name) setOrgCtx({ name: d.name, logo_url: d.logo_url ?? null, brand_color: d.brand_color ?? null, brand_accent_color: d.brand_accent_color ?? null })
    }).catch(() => {})
  }, [])

  const handleAddComparable = async (data: ComparableData) => {
    try {
      const result = await addComparable({
        appraisal_id: state.appraisal.id,
        sort_order: comparables.length,
        kind: data.kind ?? 'publicacion',
        zonaprop_url: data.zonaprop_url ?? null,
        address: data.address ?? null,
        total_area: data.total_area ?? null,
        covered_area: data.covered_area ?? null,
        price: data.price ?? null,
        usd_per_m2: data.usd_per_m2 ?? null,
        days_on_market: data.days_on_market ?? null,
        views_per_day: data.views_per_day ?? null,
        age: data.age ?? null,
        closing_price_usd: data.closing_price_usd ?? null,
        closed_at: data.closed_at ?? null,
        source_sold_property_id: data.source_sold_property_id ?? null,
      })
      setComparables(prev => [...prev, { ...data, id: result.id, sort_order: prev.length }])
    } catch (e: any) {
      alert(e?.message ?? 'No se pudo agregar el comparable')
    }
  }

  const handlePatchComparable = (id: string, patch: Partial<ComparableData>) => {
    setComparables(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
    if (compSaveTimers.current[id]) clearTimeout(compSaveTimers.current[id])
    compSaveTimers.current[id] = setTimeout(() => {
      updateComparable(id, patch)
        .then(() => setCompError(null))
        .catch((e: any) => {
          // No revertimos el estado local — el usuario puede reintentar editando.
          console.error('No se pudo guardar el comparable', e)
          setCompError(e?.message ?? 'No se pudo guardar un comparable. Reintentá editándolo.')
        })
    }, 800)
  }

  const handleRemoveComparable = async (id: string) => {
    if (!confirm('¿Eliminar este comparable?')) return
    try {
      await deleteComparable(id)
      setComparables(prev => prev.filter(c => c.id !== id))
    } catch (e: any) {
      alert(e?.message ?? 'No se pudo eliminar el comparable')
    }
  }

  const handleMoveComparable = (index: number, delta: -1 | 1) => {
    const target = index + delta
    if (target < 0 || target >= comparables.length) return
    setComparables(prev => {
      const next = [...prev]
      const tmp = next[index]
      next[index] = next[target]
      next[target] = tmp
      // Persistir nuevos sort_order de los dos afectados (fire & forget).
      const a = next[index], b = next[target]
      const onMoveErr = () => setCompError('No se pudo reordenar los comparables. Reintentá.')
      if (a?.id) updateComparable(a.id, { sort_order: index }).catch(onMoveErr)
      if (b?.id) updateComparable(b.id, { sort_order: target }).catch(onMoveErr)
      return next
    })
  }

  const computedWeighted = calcWeightedArea(
    state.appraisal.covered_area,
    state.appraisal.semi_area,
    state.appraisal.total_area,
    weights,
  )

  useEffect(() => {
    if (computedWeighted !== null && computedWeighted !== state.appraisal.weighted_area) {
      dispatch({ type: 'patch_appraisal', patch: { weighted_area: computedWeighted } })
    }
  }, [computedWeighted])

  const onConsume = useCallback((saved: { appraisal: Record<string, unknown>; overrides: Record<string, Record<string, unknown>> }) => dispatch({ type: 'consume', saved }), [dispatch])
  const { status, errorMsg, lastSavedAt, retry } = useAutosave({
    appraisalId: state.appraisal.id,
    pending: state.pendingPatches,
    onConsume,
  })

  const handleDownloadPdf = async () => {
    if (!state.appraisal.public_slug) {
      if (!confirm('El PDF incluye un link público a /t/... ¿Continuar?')) return
    }
    setPdfStatus('generating')
    try {
      const result = await generatePdf(state.appraisal.id)
      setMonthlyUsed(result.monthly_used)
      window.location.href = result.pdf_url
      setPdfStatus('idle')
    } catch (e: any) {
      setPdfStatus('error')
      if (e.code === 'quota_exceeded') {
        alert(`Alcanzaste el límite de ${e.details.limit} PDFs este mes (se resetea el ${String(e.details.reset_at).slice(0, 10)}).`)
      } else if (e.code === 'render_timeout') {
        alert('La generación tardó más de lo esperado. Reintentá en unos segundos.')
      } else {
        alert(e.message ?? 'Error al generar PDF')
      }
    }
  }

  const ctx = buildCtx({ ...state.appraisal, comparables }, orgCtx)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/tasaciones" className="text-slate-500"><ArrowLeft className="h-5 w-5" /></Link>
          <h1 className="text-sm font-semibold">{state.appraisal.property_address}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/tasaciones/${state.appraisal.id}/wizard`}
            className="flex items-center gap-2 rounded-control border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-ink"
            title="Abrir el wizard completo de edición"
          >
            <Wand2 className="w-4 h-4" /> Edición completa
          </Link>
          <button
            onClick={() => setSidebarCollapsed(c => !c)}
            className="hidden lg:flex items-center justify-center rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title={sidebarCollapsed ? 'Mostrar panel de edición' : 'Ocultar panel de edición'}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          <SaveStatus status={status} errorMsg={errorMsg} lastSavedAt={lastSavedAt} onRetry={retry} />
          {!state.appraisal.public_slug && (
            <button
              onClick={async () => {
                try {
                  await publishAppraisal(state.appraisal.id)
                  location.reload()
                } catch (e: any) {
                  alert(e?.message ?? 'Error al publicar')
                }
              }}
              className="rounded bg-gradient-to-br from-brand-pink to-brand-orange px-3 py-1 text-xs font-semibold text-white"
            >
              Publicar
            </button>
          )}
          {state.appraisal.public_slug && (
            <a href={`/t/${state.appraisal.public_slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-slate-600 hover:text-brand-pink">
              Ver pública <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button
            onClick={handleDownloadPdf}
            disabled={pdfStatus === 'generating' || (monthlyUsed !== null && monthlyUsed >= 50)}
            className="rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            {pdfStatus === 'generating' ? 'Generando...' : pdfStatus === 'error' ? 'Error, reintentar' : 'Descargar PDF'}
          </button>
        </div>
      </header>
      {monthlyUsed !== null && (
        <div className={`px-4 py-1 text-xs ${monthlyUsed >= 40 ? (monthlyUsed >= 50 ? 'text-rose-600' : 'text-amber-600') : 'text-slate-500'}`}>
          PDFs este mes: {monthlyUsed} / 50
        </div>
      )}

      {state.appraisal.template_id && (
        <SyncBanner
          appraisalId={state.appraisal.id}
          templateId={state.appraisal.template_id}
          templateSyncedAt={state.appraisal.template_synced_at ?? null}
          onSynced={() => { if (typeof window !== 'undefined') window.location.reload() }}
        />
      )}

      <div className={`grid grid-cols-1 ${!sidebarCollapsed ? 'lg:grid-cols-2' : ''}`}>
        <div className={`border-r border-slate-200 bg-white p-6 ${sidebarCollapsed ? 'hidden' : ''}`}>
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Datos de la propiedad</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <AppraisalField label="Dirección" value={state.appraisal.property_address} onChange={v => dispatch({ type: 'patch_appraisal', patch: { property_address: v } })} />
              <AppraisalField label="Barrio" value={state.appraisal.neighborhood} onChange={v => dispatch({ type: 'patch_appraisal', patch: { neighborhood: v } })} />
              <AppraisalField label="Ciudad" value={state.appraisal.city} onChange={v => dispatch({ type: 'patch_appraisal', patch: { city: v } })} />
              <AppraisalField label="Tipología" value={state.appraisal.property_type} onChange={v => dispatch({ type: 'patch_appraisal', patch: { property_type: v } })} />
              <AppraisalField label="Cubierta m²" type="number" value={state.appraisal.covered_area} onChange={v => dispatch({ type: 'patch_appraisal', patch: { covered_area: v ? Number(v) : null } })} />
              <AppraisalField label="Total m²" type="number" value={state.appraisal.total_area} onChange={v => dispatch({ type: 'patch_appraisal', patch: { total_area: v ? Number(v) : null } })} />
              <AppraisalField label="Semi m²" type="number" value={state.appraisal.semi_area} onChange={v => dispatch({ type: 'patch_appraisal', patch: { semi_area: v ? Number(v) : null } })} />
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">
                  Ponderada m²
                  <span className="ml-2 font-normal text-slate-400">auto</span>
                </span>
                <div
                  className="flex h-[34px] items-center rounded border border-rose-200 bg-rose-50 px-2 text-sm font-semibold text-brand-pink"
                  title={`Pesos: cubierta ${Math.round(weights.covered * 100)}% / semi ${Math.round(weights.semi * 100)}% / descubierta ${Math.round(weights.uncovered * 100)}%`}
                >
                  {computedWeighted !== null ? `${computedWeighted} m²` : '—'}
                </div>
              </label>
            </div>
          </section>

          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Precios</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <AppraisalField label="Precio sugerido (USD)" type="number" value={state.appraisal.suggested_price} onChange={v => dispatch({ type: 'patch_appraisal', patch: { suggested_price: v ? Number(v) : null } })} />
              <AppraisalField label="Precio de prueba (USD)" type="number" value={state.appraisal.test_price} onChange={v => dispatch({ type: 'patch_appraisal', patch: { test_price: v ? Number(v) : null } })} />
              <AppraisalField label="Cierre esperado (USD)" type="number" value={state.appraisal.expected_close_price} onChange={v => dispatch({ type: 'patch_appraisal', patch: { expected_close_price: v ? Number(v) : null } })} />
              <AppraisalField label="USD/m²" type="number" value={state.appraisal.usd_per_m2} onChange={v => dispatch({ type: 'patch_appraisal', patch: { usd_per_m2: v ? Number(v) : null } })} />
            </div>
          </section>

          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">FODA</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {(['strengths', 'weaknesses', 'opportunities', 'threats'] as const).map(k => (
                <label key={k} className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500 capitalize">{k === 'strengths' ? 'Fortalezas' : k === 'weaknesses' ? 'Debilidades' : k === 'opportunities' ? 'Oportunidades' : 'Amenazas'}</span>
                  <textarea rows={3} value={state.appraisal[k] ?? ''} onChange={e => dispatch({ type: 'patch_appraisal', patch: { [k]: e.target.value } })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
                </label>
              ))}
            </div>
          </section>

          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Comparables</h2>
            {compError && (
              <div className="mt-2 flex items-start gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-600">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{compError}</span>
              </div>
            )}
            <div className="mt-3">
              <ComparablesSection<string>
                items={comparables.map(c => ({ ...c, key: c.id })) as ComparableItem<string>[]}
                onAdd={handleAddComparable}
                onPatch={(id, patch) => handlePatchComparable(id, patch)}
                onRemove={(id) => handleRemoveComparable(id)}
                onMove={(index, delta) => handleMoveComparable(index, delta)}
                hideHint
              />
            </div>
          </section>

          {state.snapshot.some(b => !FREE_BLOCK_TYPES.has(b.type)) && (
            <section className="mt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Bloques del template</h2>
              <p className="mt-1 text-xs text-slate-400">Los elementos de texto, imagen y separadores se editan directo en el preview.</p>
              <div className="mt-3">
                <BlockList
                  blocks={state.snapshot.filter(b => !FREE_BLOCK_TYPES.has(b.type))}
                  overrides={state.overrides}
                  onPatchOverride={(id, patch) => dispatch({ type: 'patch_override', blockId: id, patch })}
                  context={context}
                  openId={openBlockId}
                />
              </div>
            </section>
          )}
        </div>

        <div className={sidebarCollapsed ? 'block' : 'hidden lg:block'}>
          <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
              <button onClick={() => setMode('web')} className={`rounded px-3 py-1 text-xs ${mode === 'web' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Web</button>
              <button onClick={() => setMode('print')} className={`rounded px-3 py-1 text-xs ${mode === 'print' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Print</button>
            </div>
            {mode === 'web' ? (
              <EditableCanvas
                snapshot={state.snapshot}
                overrides={state.overrides}
                appraisal={ctx}
                mode="web"
                onAdd={addBlock}
                onRemove={(id) => dispatch({ type: 'remove_block', blockId: id })}
                onReorder={(from, to) => dispatch({ type: 'reorder_blocks', from, to })}
                onPatchData={(id, patch) => dispatch({ type: 'patch_block_data', blockId: id, patch })}
                onPatchOverride={(id, patch) => dispatch({ type: 'patch_override', blockId: id, patch })}
                onEditStructured={(id) => { setSidebarCollapsed(false); setOpenBlockId(id) }}
              />
            ) : (
              <TemplateRenderer snapshot={state.snapshot} overrides={state.overrides} appraisal={ctx} mode="print" />
            )}
          </div>
        </div>
      </div>

      <button onClick={() => setMobilePreviewOpen(true)} className="fixed bottom-6 right-6 z-30 rounded-full bg-gradient-to-br from-brand-pink to-brand-orange px-5 py-3 text-sm font-semibold text-white shadow-pop lg:hidden">
        Preview
      </button>
      {mobilePreviewOpen && (
        <div className="fixed inset-0 z-40 bg-white lg:hidden">
          <button onClick={() => setMobilePreviewOpen(false)} className="absolute right-4 top-4 z-10 rounded-full bg-slate-900 px-3 py-1 text-xs text-white">Cerrar</button>
          <div className="h-full overflow-y-auto">
            <TemplateRenderer snapshot={state.snapshot} overrides={state.overrides} appraisal={ctx} mode={mode} editing />
          </div>
        </div>
      )}
    </div>
  )
}

function AppraisalField({ label, value, onChange, type = 'text' }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-slate-500">{label}</span>
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm" />
    </label>
  )
}

function SaveStatus({ status, errorMsg, lastSavedAt, onRetry }: { status: string; errorMsg: string | null; lastSavedAt: number | null; onRetry: () => void }) {
  if (status === 'saving') return <span className="flex items-center gap-1 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> Guardando...</span>
  if (status === 'saved') return <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Guardado</span>
  if (status === 'error') return (
    <span title={errorMsg ?? undefined} className="flex max-w-md items-center gap-1 truncate text-xs text-rose-600">
      <AlertCircle className="h-3 w-3 shrink-0" /> {errorMsg ?? 'Error al guardar'}
      <button onClick={onRetry} className="ml-1 shrink-0 underline">Reintentar</button>
    </span>
  )
  if (status === 'debouncing') return <span className="text-xs text-slate-400">Cambios pendientes...</span>
  return null
}
