'use client'
import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { WizardState } from '../use-wizard-form'
import { getTemplate, listVariables } from '../../shared/api'
import { TemplateRenderer } from '../../renderer/TemplateRenderer'
import type { AppraisalContext, ResolvedVars, TemplateBlock } from '../../renderer/types'

function extractVarKeys(snapshot: TemplateBlock[]): string[] {
  const keys = new Set<string>()
  for (const b of snapshot) {
    const data = (b as any)?.data
    if (!data) continue
    if (Array.isArray(data.vars)) for (const k of data.vars) keys.add(String(k))
    if (data.chart_1_var) keys.add(String(data.chart_1_var))
    if (data.chart_2_var) keys.add(String(data.chart_2_var))
  }
  return Array.from(keys)
}

interface Props {
  templateId: string | null
  property: WizardState['property']
  details: WizardState['details']
  comparables: WizardState['comparables']
  generatePublicSlug: boolean
  onTogglePublicSlug: () => void
}

/** Build an AppraisalContext preview from the wizard data. */
function buildCtx(
  property: WizardState['property'],
  details: WizardState['details'],
  comparables: WizardState['comparables'],
): AppraisalContext {
  return {
    id: 'preview',
    property_address: property.address,
    neighborhood: property.neighborhood ?? null,
    city: property.city ?? null,
    property_type: property.property_type ?? null,
    covered_area: property.covered_area ?? null,
    total_area: property.total_area ?? null,
    semi_area: property.semi_area ?? null,
    weighted_area: property.weighted_area ?? null,
    swot: {
      strengths: details.strengths ?? null,
      weaknesses: details.weaknesses ?? null,
      opportunities: details.opportunities ?? null,
      threats: details.threats ?? null,
    },
    prices: {
      suggested: details.suggested_price ?? null,
      test: details.test_price ?? null,
      expected_close: details.expected_close_price ?? null,
      usd_per_m2: details.usd_per_m2 ?? null,
    },
    comparables: comparables.map((c, i) => ({
      id: `preview-${i}`,
      appraisal_id: 'preview',
      ...c,
      sort_order: i,
    })),
    agent: null,
    org: null,
  }
}

export function StepReview({ templateId, property, details, comparables, generatePublicSlug, onTogglePublicSlug }: Props) {
  const [snapshot, setSnapshot] = useState<TemplateBlock[] | null>(null)
  const [variables, setVariables] = useState<Array<{ key: string; value: string; value_type: string }> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!templateId) {
      setSnapshot([])
      return
    }
    setLoading(true)
    setError(null)
    Promise.all([
      getTemplate(templateId).then((t: any) => {
        const blocks: TemplateBlock[] = Array.isArray(t.blocks)
          ? t.blocks
          : Array.isArray(t.snapshot)
            ? t.snapshot
            : []
        setSnapshot(blocks)
      }),
      listVariables()
        .then((vars) => setVariables(vars as any))
        .catch(() => setVariables([])),
    ])
      .catch(() => setError('No se pudo cargar la plantilla para la previsualización'))
      .finally(() => setLoading(false))
  }, [templateId])

  const resolvedVars: ResolvedVars = useMemo(() => {
    if (!snapshot || !variables) return {}
    const referenced = new Set(extractVarKeys(snapshot))
    const out: ResolvedVars = {}
    for (const v of variables) {
      if (referenced.has(v.key)) out[v.key] = { value: v.value, type: v.value_type }
    }
    return out
  }, [snapshot, variables])

  const ctx = buildCtx(property, details, comparables)

  return (
    <div className="space-y-6">
      {/* Public slug toggle */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
        <div>
          <p className="text-sm font-medium text-slate-800">Generar link público</p>
          <p className="text-xs text-slate-500">
            La tasación será accesible por un link único sin login.
          </p>
        </div>
        <button
          type="button"
          onClick={onTogglePublicSlug}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
            generatePublicSlug ? 'bg-[#ff007c]' : 'bg-slate-200'
          }`}
          role="switch"
          aria-checked={generatePublicSlug}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
              generatePublicSlug ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Preview */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Previsualización</h3>

        {loading && (
          <div className="flex items-center gap-2 py-8 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Cargando plantilla…</span>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && snapshot !== null && (
          <>
            {snapshot.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                <p className="text-sm text-slate-500">
                  {templateId
                    ? 'La plantilla no tiene bloques configurados.'
                    : 'Podrás agregar bloques desde el editor.'}
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <TemplateRenderer snapshot={snapshot} appraisal={ctx} resolvedVars={resolvedVars} mode="web" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
