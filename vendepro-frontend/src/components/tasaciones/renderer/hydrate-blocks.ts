import type {
  TemplateBlock, HydratedBlock, AppraisalContext,
  ResolvedVars, BlockOverrides, RenderMode,
} from './types'

export interface HydrateInput {
  snapshot: TemplateBlock[]
  overrides: BlockOverrides
  appraisal: AppraisalContext
  resolvedVars: ResolvedVars
  mode: RenderMode
}

export function hydrateBlocks(input: HydrateInput): HydratedBlock[] {
  const filtered = (input.mode === 'print')
    ? input.snapshot.filter(b => b.include_in_pdf !== false)
    : [...input.snapshot]

  const sorted = [...filtered].sort((a, b) => a.sort_order - b.sort_order)

  return sorted.map(block => {
    const resolved: Record<string, unknown> = { ...block.data }

    const data = block.data as Record<string, unknown>
    const source = data.source as string | undefined

    if (source === 'appraisal.swot' && input.appraisal.swot) {
      Object.assign(resolved, input.appraisal.swot)
    }
    if (source === 'appraisal.prices' && input.appraisal.prices) {
      Object.assign(resolved, input.appraisal.prices)
    }
    if (source === 'appraisal.*') {
      Object.assign(resolved, {
        property_address: input.appraisal.property_address,
        neighborhood: input.appraisal.neighborhood,
        city: input.appraisal.city,
        property_type: input.appraisal.property_type,
        covered_area: input.appraisal.covered_area,
        total_area: input.appraisal.total_area,
        semi_area: input.appraisal.semi_area,
        weighted_area: input.appraisal.weighted_area,
      })
    }
    if (source === 'appraisal.comparables') {
      ;(resolved as any).comparables = input.appraisal.comparables
    }

    const varsArr = Array.isArray(data.vars) ? (data.vars as string[]) : []
    const chartVars = [data.chart_1_var, data.chart_2_var].filter(Boolean) as string[]
    const allRefs = [...varsArr, ...chartVars]
    if (allRefs.length) {
      const out: Record<string, { value: string; type: string }> = {}
      for (const k of allRefs) {
        const v = input.resolvedVars[k]
        if (v) out[k] = v
      }
      ;(resolved as any).vars_resolved = out
    }

    const ov = input.overrides[block.id]
    const finalData = ov ? { ...resolved, ...ov } : resolved

    return { ...block, resolved_data: finalData }
  })
}
