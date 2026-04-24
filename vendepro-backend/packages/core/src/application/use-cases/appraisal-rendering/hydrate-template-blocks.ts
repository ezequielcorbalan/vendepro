import type { OrgVariableRepository, AppraisalTemplateBlock } from '@vendepro/core'

export interface HydratedBlock extends AppraisalTemplateBlock {
  resolved_data: Record<string, unknown> & {
    vars_resolved?: Record<string, { value: string; type: string }>
  }
}

export interface HydrateInput {
  orgId: string
  snapshot: AppraisalTemplateBlock[]
  overrides: Record<string, Record<string, unknown>>
  appraisal: Record<string, unknown>
  mode?: 'web' | 'print'
}

export class HydrateTemplateBlocksUseCase {
  constructor(private readonly varsRepo: OrgVariableRepository) {}

  async execute(input: HydrateInput): Promise<{ blocks: HydratedBlock[] }> {
    const filtered = (input.mode === 'print')
      ? input.snapshot.filter(b => b.include_in_pdf !== false)
      : [...input.snapshot]
    filtered.sort((a, b) => a.sort_order - b.sort_order)

    const allVarKeys = new Set<string>()
    for (const b of filtered) {
      const vars = (b.data as any)?.vars
      if (Array.isArray(vars)) for (const k of vars) allVarKeys.add(String(k))
      const c1 = (b.data as any)?.chart_1_var
      const c2 = (b.data as any)?.chart_2_var
      if (c1) allVarKeys.add(String(c1))
      if (c2) allVarKeys.add(String(c2))
    }
    const varsMap = allVarKeys.size ? await this.varsRepo.resolveKeys(input.orgId, Array.from(allVarKeys)) : {}

    const blocks: HydratedBlock[] = filtered.map(b => {
      const resolved: Record<string, unknown> = { ...(b.data as any) }
      if ((b.data as any)?.source === 'appraisal.swot' && (input.appraisal as any).swot) {
        Object.assign(resolved, (input.appraisal as any).swot)
      }
      if ((b.data as any)?.source === 'appraisal.prices' && (input.appraisal as any).prices) {
        Object.assign(resolved, (input.appraisal as any).prices)
      }
      if ((b.data as any)?.source === 'appraisal.*' && (input.appraisal as any).property) {
        Object.assign(resolved, (input.appraisal as any).property)
      }
      if ((b.data as any)?.source === 'appraisal.comparables' && Array.isArray((input.appraisal as any).comparables)) {
        ;(resolved as any).comparables = (input.appraisal as any).comparables
      }
      const refs = collectVarRefs(b)
      if (refs.length) {
        const out: Record<string, { value: string; type: string }> = {}
        for (const k of refs) {
          const v = varsMap[k]
          if (v) out[k] = { value: v.value, type: v.value_type }
        }
        ;(resolved as any).vars_resolved = out
      }
      const ov = input.overrides[b.id]
      const merged = ov ? { ...resolved, ...ov } : resolved
      return { ...b, resolved_data: merged }
    })

    return { blocks }
  }
}

function collectVarRefs(b: AppraisalTemplateBlock): string[] {
  const out: string[] = []
  const vars = (b.data as any)?.vars
  if (Array.isArray(vars)) out.push(...vars.map(String))
  const c1 = (b.data as any)?.chart_1_var; const c2 = (b.data as any)?.chart_2_var
  if (c1) out.push(String(c1)); if (c2) out.push(String(c2))
  return out
}
