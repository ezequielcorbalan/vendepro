import type { AppraisalRepository } from '../../ports/repositories/appraisal-repository'

export interface UpdateAppraisalComparableInput {
  id: string
  patch: Partial<{
    zonaprop_url: string | null
    address: string | null
    total_area: number | null
    covered_area: number | null
    price: number | null
    usd_per_m2: number | null
    days_on_market: number | null
    views_per_day: number | null
    age: number | null
    sort_order: number
  }>
}

export class UpdateAppraisalComparableUseCase {
  constructor(private readonly repo: AppraisalRepository) {}

  async execute(input: UpdateAppraisalComparableInput): Promise<void> {
    if (!input.id) throw new Error('id is required')
    await this.repo.updateComparable(input.id, input.patch)
  }
}
