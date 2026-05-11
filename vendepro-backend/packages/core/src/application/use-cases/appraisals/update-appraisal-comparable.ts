import type { AppraisalRepository } from '../../ports/repositories/appraisal-repository'
import type { AppraisalComparableKind } from '../../../domain/entities/appraisal'

export interface UpdateAppraisalComparableInput {
  id: string
  patch: Partial<{
    kind: AppraisalComparableKind
    zonaprop_url: string | null
    address: string | null
    total_area: number | null
    covered_area: number | null
    price: number | null
    usd_per_m2: number | null
    days_on_market: number | null
    views_per_day: number | null
    age: number | null
    closing_price_usd: number | null
    closed_at: string | null
    source_sold_property_id: string | null
    sort_order: number
  }>
}

const VALID_KINDS: AppraisalComparableKind[] = ['publicacion', 'venta']

export class UpdateAppraisalComparableUseCase {
  constructor(private readonly repo: AppraisalRepository) {}

  async execute(input: UpdateAppraisalComparableInput): Promise<void> {
    if (!input.id) throw new Error('id is required')
    const patch = { ...input.patch }
    if (patch.kind && !VALID_KINDS.includes(patch.kind)) {
      throw new Error(`kind inválido: ${patch.kind}`)
    }
    // Si se está pasando kind='publicacion' explícitamente, limpiamos los campos
    // exclusivos de venta. Si kind no viene en el patch, se respeta lo persistido.
    if (patch.kind === 'publicacion') {
      patch.closing_price_usd = null
      patch.closed_at = null
      patch.source_sold_property_id = null
    }
    await this.repo.updateComparable(input.id, patch)
  }
}
