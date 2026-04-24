import type { AppraisalRepository } from '../../ports/repositories/appraisal-repository'
import type { TemplateBlockRepository } from '../../ports/repositories/template-block-repository'
import type { OrgVariableRepository } from '../../ports/repositories/org-variable-repository'
import type { Appraisal } from '../../../domain/entities/appraisal'
import type { TemplateBlock } from '../../../domain/entities/template-block'

export type ResolvedVars = Record<string, { value: string; type: string }>

export interface GetPublicAppraisalResult {
  appraisal: Appraisal
  org: { name: string; logo_url: string | null; brand_color: string | null }
  blocks: TemplateBlock[]
  resolved_vars: ResolvedVars
}

function extractVarKeys(snapshot: unknown[]): string[] {
  const keys = new Set<string>()
  for (const b of snapshot) {
    const data = (b as any)?.data
    if (!data) continue
    if (Array.isArray(data.vars)) {
      for (const k of data.vars) keys.add(String(k))
    }
    if (data.chart_1_var) keys.add(String(data.chart_1_var))
    if (data.chart_2_var) keys.add(String(data.chart_2_var))
  }
  return Array.from(keys)
}

export class GetPublicAppraisalUseCase {
  constructor(
    private readonly appraisalRepo: AppraisalRepository,
    private readonly templateBlockRepo: TemplateBlockRepository,
    private readonly varsRepo?: OrgVariableRepository,
  ) {}

  async execute(idOrSlug: string): Promise<GetPublicAppraisalResult | null> {
    const result = await this.appraisalRepo.findPublicByIdOrSlugWithOrg(idOrSlug)
    if (!result) return null

    const blocks = await this.templateBlockRepo.findEnabledByOrg(result.appraisal.org_id)

    let resolved_vars: ResolvedVars = {}
    if (this.varsRepo && result.appraisal.template_snapshot_json) {
      let snapshot: unknown[]
      const raw = result.appraisal.template_snapshot_json
      if (typeof raw === 'string') {
        try { snapshot = JSON.parse(raw) } catch { snapshot = [] }
      } else if (Array.isArray(raw)) {
        snapshot = raw
      } else {
        snapshot = []
      }
      const keys = extractVarKeys(snapshot)
      if (keys.length > 0) {
        const map = await this.varsRepo.resolveKeys(result.appraisal.org_id, keys)
        for (const [k, v] of Object.entries(map)) {
          resolved_vars[k] = { value: v.value, type: v.value_type }
        }
      }
    }

    return {
      appraisal: result.appraisal,
      org: result.org,
      blocks,
      resolved_vars,
    }
  }
}
