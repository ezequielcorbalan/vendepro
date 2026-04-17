import type { AppraisalRepository, NewAppraisalComparable } from '../../ports/repositories/appraisal-repository'
import type { IdGenerator } from '../../ports/id-generator'

export interface AddAppraisalComparableInput {
  appraisal_id: string
  zonaprop_url?: string | null
  address?: string | null
  total_area?: number | null
  covered_area?: number | null
  price?: number | null
  usd_per_m2?: number | null
  sort_order?: number
}

export class AddAppraisalComparableUseCase {
  constructor(
    private readonly repo: AppraisalRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: AddAppraisalComparableInput): Promise<{ id: string }> {
    const id = this.idGen.generate()
    const comparable: NewAppraisalComparable = {
      id,
      appraisal_id: input.appraisal_id,
      zonaprop_url: input.zonaprop_url ?? null,
      address: input.address ?? null,
      total_area: input.total_area ?? null,
      covered_area: input.covered_area ?? null,
      price: input.price ?? null,
      usd_per_m2: input.usd_per_m2 ?? null,
      sort_order: input.sort_order ?? 0,
    }
    await this.repo.addComparable(comparable)
    return { id }
  }
}
