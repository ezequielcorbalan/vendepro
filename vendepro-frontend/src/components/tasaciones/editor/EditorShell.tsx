'use client'
import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
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
import { Button } from '@/components/ui/Button'
import { Heading, Text } from '@/components/ui/Typography'
import { Alert } from '@/components/ui/Alert'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useToast } from '@/components/ui/Toast'
import { BlockField, BlockInput, BlockTextarea } from './BlockField'

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
  const [publishing, setPublishing] = useState(false)
  const { toast } = useToast()

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
      toast(e?.message ?? 'No se pudo agregar el comparable', 'error')
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
      toast(e?.message ?? 'No se pudo eliminar el comparable', 'error')
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
        toast(`Alcanzaste el límite de ${e.details.limit} PDFs este mes (se resetea el ${String(e.details.reset_at).slice(0, 10)}).`, 'error')
      } else if (e.code === 'render_timeout') {
        toast('La generación tardó más de lo esperado. Reintentá en unos segundos.', 'error')
      } else {
        toast(e.message ?? 'Error al generar PDF', 'error')
      }
    }
  }

  const ctx = buildCtx({ ...state.appraisal, comparables }, orgCtx)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Button href="/tasaciones" variant="ghost" size="icon" aria-label="Volver a Tasaciones">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Heading level={4} as="h1">{state.appraisal.property_address}</Heading>
        </div>
        <div className="flex items-center gap-3">
          <Button
            href={`/tasaciones/${state.appraisal.id}/wizard`}
            variant="outline"
            size="sm"
            icon={<Wand2 className="w-4 h-4" />}
            title="Abrir el wizard completo de edición"
          >
            Edición completa
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(c => !c)}
            className="hidden lg:inline-flex"
            aria-label={sidebarCollapsed ? 'Mostrar panel de edición' : 'Ocultar panel de edición'}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
          <SaveStatus status={status} errorMsg={errorMsg} lastSavedAt={lastSavedAt} onRetry={retry} />
          {!state.appraisal.public_slug && (
            <Button
              size="sm"
              loading={publishing}
              onClick={async () => {
                setPublishing(true)
                try {
                  await publishAppraisal(state.appraisal.id)
                  location.reload()
                } catch (e: any) {
                  // Era un `alert()` nativo: bloquea la pantalla y se ve como un
                  // error del navegador, no de la app.
                  toast(e?.message ?? 'Error al publicar', 'error')
                  setPublishing(false)
                }
              }}
            >
              Publicar
            </Button>
          )}
          {state.appraisal.public_slug && (
            <Button
              href={`/t/${state.appraisal.public_slug}`}
              target="_blank"
              rel="noopener noreferrer"
              variant="ghost"
              size="sm"
            >
              Ver pública <ExternalLink className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={pdfStatus === 'generating' || (monthlyUsed !== null && monthlyUsed >= 50)}
          >
            {pdfStatus === 'generating' ? 'Generando…' : pdfStatus === 'error' ? 'Error, reintentar' : 'Descargar PDF'}
          </Button>
        </div>
      </header>
      {monthlyUsed !== null && (
        <div className={`px-4 py-1 text-xs ${monthlyUsed >= 40 ? (monthlyUsed >= 50 ? 'text-danger' : 'text-warning') : 'text-gray-500'}`}>
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
        <div className={`border-r border-gray-200 bg-white p-6 ${sidebarCollapsed ? 'hidden' : ''}`}>
          <section>
            <SectionTitle>Datos de la propiedad</SectionTitle>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <AppraisalField label="Dirección" value={state.appraisal.property_address} onChange={v => dispatch({ type: 'patch_appraisal', patch: { property_address: v } })} />
              <AppraisalField label="Barrio" value={state.appraisal.neighborhood} onChange={v => dispatch({ type: 'patch_appraisal', patch: { neighborhood: v } })} />
              <AppraisalField label="Ciudad" value={state.appraisal.city} onChange={v => dispatch({ type: 'patch_appraisal', patch: { city: v } })} />
              <AppraisalField label="Tipología" value={state.appraisal.property_type} onChange={v => dispatch({ type: 'patch_appraisal', patch: { property_type: v } })} />
              <AppraisalField label="Cubierta m²" type="number" value={state.appraisal.covered_area} onChange={v => dispatch({ type: 'patch_appraisal', patch: { covered_area: v ? Number(v) : null } })} />
              <AppraisalField label="Total m²" type="number" value={state.appraisal.total_area} onChange={v => dispatch({ type: 'patch_appraisal', patch: { total_area: v ? Number(v) : null } })} />
              <AppraisalField label="Semi m²" type="number" value={state.appraisal.semi_area} onChange={v => dispatch({ type: 'patch_appraisal', patch: { semi_area: v ? Number(v) : null } })} />
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-500">
                  Ponderada m²
                  <span className="ml-2 font-normal text-gray-400">auto</span>
                </span>
                <div
                  className="flex h-[34px] items-center rounded-control border border-primary/20 bg-primary/5 px-2 text-sm font-semibold text-primary"
                  title={`Pesos: cubierta ${Math.round(weights.covered * 100)}% / semi ${Math.round(weights.semi * 100)}% / descubierta ${Math.round(weights.uncovered * 100)}%`}
                >
                  {computedWeighted !== null ? `${computedWeighted} m²` : '—'}
                </div>
              </label>
            </div>
          </section>

          <section className="mt-6">
            <SectionTitle>Precios</SectionTitle>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <AppraisalField label="Precio sugerido (USD)" type="number" value={state.appraisal.suggested_price} onChange={v => dispatch({ type: 'patch_appraisal', patch: { suggested_price: v ? Number(v) : null } })} />
              <AppraisalField label="Precio de prueba (USD)" type="number" value={state.appraisal.test_price} onChange={v => dispatch({ type: 'patch_appraisal', patch: { test_price: v ? Number(v) : null } })} />
              <AppraisalField label="Cierre esperado (USD)" type="number" value={state.appraisal.expected_close_price} onChange={v => dispatch({ type: 'patch_appraisal', patch: { expected_close_price: v ? Number(v) : null } })} />
              <AppraisalField label="USD/m²" type="number" value={state.appraisal.usd_per_m2} onChange={v => dispatch({ type: 'patch_appraisal', patch: { usd_per_m2: v ? Number(v) : null } })} />
            </div>
          </section>

          <section className="mt-6">
            <SectionTitle>FODA</SectionTitle>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {(['strengths', 'weaknesses', 'opportunities', 'threats'] as const).map(k => (
                <BlockField
                  key={k}
                  label={k === 'strengths' ? 'Fortalezas' : k === 'weaknesses' ? 'Debilidades' : k === 'opportunities' ? 'Oportunidades' : 'Amenazas'}
                >
                  <BlockTextarea rows={3} value={state.appraisal[k] ?? ''} onChange={e => dispatch({ type: 'patch_appraisal', patch: { [k]: e.target.value } })} />
                </BlockField>
              ))}
            </div>
          </section>

          <section className="mt-6">
            <SectionTitle>Comparables</SectionTitle>
            {compError && (
              <Alert tone="danger" className="mt-2 px-2 py-1 text-xs">{compError}</Alert>
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
              <SectionTitle>Bloques del template</SectionTitle>
              <p className="mt-1 text-xs text-gray-400">Los elementos de texto, imagen y separadores se editan directo en el preview.</p>
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
            {/* Cambio de vista del preview: es exactamente el caso de
                `SegmentedControl`. Eran dos botones a mano con el activo en
                gray-900, un tono que el DS no usa para estado activo. */}
            <div className="flex items-center border-b border-gray-200 bg-white px-4 py-2">
              <SegmentedControl
                options={[{ value: 'web', label: 'Web' }, { value: 'print', label: 'Print' }]}
                value={mode}
                onChange={v => setMode(v as RenderMode)}
              />
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

      <Button onClick={() => setMobilePreviewOpen(true)} size="lg" className="fixed bottom-6 right-6 z-30 rounded-full shadow-pop lg:hidden">
        Preview
      </Button>
      {mobilePreviewOpen && (
        <div className="fixed inset-0 z-40 bg-white lg:hidden">
          <Button onClick={() => setMobilePreviewOpen(false)} variant="outline" size="sm" className="absolute right-4 top-4 z-10">Cerrar</Button>
          <div className="h-full overflow-y-auto">
            <TemplateRenderer snapshot={state.snapshot} overrides={state.overrides} appraisal={ctx} mode={mode} editing />
          </div>
        </div>
      )}
    </div>
  )
}

/** Título de sección del panel de edición. Estaba repetido cinco veces como un
 *  `<h2>` con la misma cadena de clases. */
function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text as="h2" size="sm" weight="semibold" className="uppercase tracking-wide text-gray-600">
      {children}
    </Text>
  )
}

/** Un dato de la tasación. Antes era una copia de `BlockField` + un `<input>`
 *  nativo con la misma cadena de clases que los formularios de bloque. */
function AppraisalField({ label, value, onChange, type = 'text' }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
  return (
    <BlockField label={label}>
      <BlockInput type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} />
    </BlockField>
  )
}

function SaveStatus({ status, errorMsg, lastSavedAt, onRetry }: { status: string; errorMsg: string | null; lastSavedAt: number | null; onRetry: () => void }) {
  if (status === 'saving') return <span className="flex items-center gap-1 text-xs text-gray-500"><Loader2 className="h-3 w-3 animate-spin" /> Guardando...</span>
  if (status === 'saved') return <span className="flex items-center gap-1 text-xs text-success"><CheckCircle2 className="h-3 w-3" /> Guardado</span>
  if (status === 'error') return (
    <span title={errorMsg ?? undefined} className="flex max-w-md items-center gap-1 truncate text-xs text-danger">
      <AlertCircle className="h-3 w-3 shrink-0" /> {errorMsg ?? 'Error al guardar'}
      <Button variant="ghost" size="sm" type="button" onClick={onRetry} className="p-0 ml-1 shrink-0 underline">Reintentar</Button>
    </span>
  )
  if (status === 'debouncing') return <span className="text-xs text-gray-400">Cambios pendientes...</span>
  return null
}
