'use client'
import { useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useEditorState } from './useEditorState'
import { useAutosave } from './useAutosave'
import { BlockList } from './BlockList'
import { SyncBanner } from './SyncBanner'
import { TemplateRenderer } from '../renderer/TemplateRenderer'
import { publishAppraisal, generatePdf } from '../shared/api'
import type { TemplateBlock, AppraisalContext, RenderMode } from '../renderer/types'

interface Props {
  initial: any
  snapshot: TemplateBlock[]
  context: 'appraisal' | 'template'
}

function buildCtx(a: any): AppraisalContext {
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
    agent: a.agent ?? null,
    org: a.org ?? null,
  }
}

export function EditorShell({ initial, snapshot, context }: Props) {
  const [state, dispatch] = useEditorState(initial)
  const [mode, setMode] = useState<RenderMode>('web')
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'generating' | 'error'>('idle')
  const [monthlyUsed, setMonthlyUsed] = useState<number | null>(null)

  const onConsume = useCallback((saved: { appraisal: Record<string, unknown>; overrides: Record<string, Record<string, unknown>> }) => dispatch({ type: 'consume', saved }), [dispatch])
  const { status, lastSavedAt, retry } = useAutosave({
    appraisalId: state.appraisal.id,
    pending: state.pendingPatches,
    dirty: state.dirty,
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

  const ctx = buildCtx(state.appraisal)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/tasaciones" className="text-slate-500"><ArrowLeft className="h-5 w-5" /></Link>
          <h1 className="text-sm font-semibold">{state.appraisal.property_address}</h1>
        </div>
        <div className="flex items-center gap-3">
          <SaveStatus status={status} lastSavedAt={lastSavedAt} onRetry={retry} />
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
              className="rounded bg-[#ff007c] px-3 py-1 text-xs font-semibold text-white"
            >
              Publicar
            </button>
          )}
          {state.appraisal.public_slug && (
            <a href={`/t/${state.appraisal.public_slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-slate-600 hover:text-[#ff007c]">
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

      <div className="grid grid-cols-1 lg:grid-cols-2">
        <div className="border-r border-slate-200 bg-white p-6">
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
              <AppraisalField label="Ponderada m²" type="number" value={state.appraisal.weighted_area} onChange={v => dispatch({ type: 'patch_appraisal', patch: { weighted_area: v ? Number(v) : null } })} />
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

          {snapshot.length > 0 && (
            <section className="mt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Bloques del template</h2>
              <div className="mt-3">
                <BlockList blocks={snapshot} overrides={state.overrides} onPatchOverride={(id, patch) => dispatch({ type: 'patch_override', blockId: id, patch })} context={context} />
              </div>
            </section>
          )}
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
              <button onClick={() => setMode('web')} className={`rounded px-3 py-1 text-xs ${mode === 'web' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Web</button>
              <button onClick={() => setMode('print')} className={`rounded px-3 py-1 text-xs ${mode === 'print' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Print</button>
            </div>
            <TemplateRenderer snapshot={snapshot} overrides={state.overrides} appraisal={ctx} mode={mode} />
          </div>
        </div>
      </div>

      <button onClick={() => setMobilePreviewOpen(true)} className="fixed bottom-6 right-6 z-30 rounded-full bg-[#ff007c] px-5 py-3 text-sm font-semibold text-white shadow-lg lg:hidden">
        Preview
      </button>
      {mobilePreviewOpen && (
        <div className="fixed inset-0 z-40 bg-white lg:hidden">
          <button onClick={() => setMobilePreviewOpen(false)} className="absolute right-4 top-4 z-10 rounded-full bg-slate-900 px-3 py-1 text-xs text-white">Cerrar</button>
          <div className="h-full overflow-y-auto">
            <TemplateRenderer snapshot={snapshot} overrides={state.overrides} appraisal={ctx} mode={mode} />
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

function SaveStatus({ status, lastSavedAt, onRetry }: { status: string; lastSavedAt: number | null; onRetry: () => void }) {
  if (status === 'saving') return <span className="flex items-center gap-1 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> Guardando...</span>
  if (status === 'saved') return <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Guardado</span>
  if (status === 'error') return (
    <span className="flex items-center gap-1 text-xs text-rose-600">
      <AlertCircle className="h-3 w-3" /> Error al guardar
      <button onClick={onRetry} className="ml-1 underline">Reintentar</button>
    </span>
  )
  if (status === 'debouncing') return <span className="text-xs text-slate-400">Cambios pendientes...</span>
  return null
}
