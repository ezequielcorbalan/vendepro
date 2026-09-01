'use client'
import { useEffect, useMemo, useState } from 'react'
import { Loader2, FileText } from 'lucide-react'
import type { WizardState } from '../use-wizard-form'
import { getTemplate, listVariables } from '../../shared/api'
import { TemplateRenderer } from '../../renderer/TemplateRenderer'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  APPRAISAL_BLOCK_TYPES,
  type AppraisalBlockType,
  type AppraisalContext,
  type BlockOverrides,
  type ResolvedVars,
  type TemplateBlock,
} from '../../renderer/types'

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
  customBlocks: WizardState['customBlocks']
  blockOverrides: BlockOverrides
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

export function StepReview({ templateId, property, details, comparables, customBlocks, blockOverrides }: Props) {
  const [snapshot, setSnapshot] = useState<TemplateBlock[] | null>(null)
  const [variables, setVariables] = useState<Array<{ key: string; value: string; value_type: string }> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Snapshot sintético cuando es "desde cero" con bloques elegidos.
  const customSnapshot: TemplateBlock[] = useMemo(() => {
    if (templateId) return []
    const orderOf = (t: AppraisalBlockType) => APPRAISAL_BLOCK_TYPES.indexOf(t)
    return [...customBlocks]
      .sort((a, b) => orderOf(a.type) - orderOf(b.type))
      .map((b, i) => ({
        id: `custom-${b.type}`,
        type: b.type,
        binding_mode: 'tasacion' as const,
        include_in_pdf: true,
        sort_order: i,
        data: b.data,
      }))
  }, [templateId, customBlocks])

  useEffect(() => {
    if (!templateId) {
      setSnapshot(customSnapshot)
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
  }, [templateId, customSnapshot])

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
      {/* Hint sobre las dos acciones del footer */}
      <div className="rounded-card border border-gray-200 bg-gray-50 px-5 py-4 text-sm text-gray-600">
        Revisá la previsualización y elegí abajo:{' '}
        <span className="font-medium text-ink">Guardar borrador</span> deja la tasación
        privada (sólo accesible desde el editor); <span className="font-medium text-ink">Publicar</span>{' '}
        además genera un link público para compartir con el propietario.
      </div>

      {/* Preview */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Previsualización</h3>

        {loading && (
          <div className="flex items-center gap-2 py-8 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Cargando plantilla…</span>
          </div>
        )}

        {error && (
          <div className="rounded-control border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {!loading && !error && snapshot !== null && (
          <>
            {snapshot.length === 0 ? (
              <div className="rounded-card border border-dashed border-gray-200 bg-gray-50">
                <EmptyState
                  icon={<FileText className="w-6 h-6" />}
                  title={templateId
                    ? 'La plantilla no tiene bloques configurados.'
                    : 'No elegiste ningún bloque. Podés agregarlos desde el editor más adelante.'}
                />
              </div>
            ) : (
              <div className="overflow-hidden rounded-card border border-gray-200 bg-white">
                <TemplateRenderer
                  snapshot={snapshot}
                  overrides={blockOverrides}
                  appraisal={ctx}
                  resolvedVars={resolvedVars}
                  mode="web"
                  editing
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
