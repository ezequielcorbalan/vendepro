import type { AppraisalRepository, NewAppraisalComparable } from '../../ports/repositories/appraisal-repository'
import type { AppraisalComparableKind } from '../../../domain/entities/appraisal'
import type { IdGenerator } from '../../ports/id-generator'

export interface AddAppraisalComparableInput {
  appraisal_id: string
  kind?: AppraisalComparableKind
  zonaprop_url?: string | null
  address?: string | null
  total_area?: number | null
  covered_area?: number | null
  price?: number | null
  usd_per_m2?: number | null
  days_on_market?: number | null
  views_per_day?: number | null
  age?: number | null
  closing_price_usd?: number | null
  closed_at?: string | null
  source_sold_property_id?: string | null
  sort_order?: number
}

const VALID_KINDS: AppraisalComparableKind[] = ['publicacion', 'venta']

export class AddAppraisalComparableUseCase {
  constructor(
    private readonly repo: AppraisalRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: AddAppraisalComparableInput): Promise<{ id: string }> {
    const kind: AppraisalComparableKind = input.kind && VALID_KINDS.includes(input.kind)
      ? input.kind
      : 'publicacion'

    // Saneo: campos exclusivos de 'venta' solo se persisten si kind === 'venta'.
    const isVenta = kind === 'venta'

    const id = this.idGen.generate()
    const comparable: NewAppraisalComparable = {
      id,
      appraisal_id: input.appraisal_id,
      kind,
      zonaprop_url: input.zonaprop_url ?? null,
      address: input.address ?? null,
      total_area: input.total_area ?? null,
      covered_area: input.covered_area ?? null,
      price: input.price ?? null,
      usd_per_m2: input.usd_per_m2 ?? null,
      days_on_market: input.days_on_market ?? null,
      views_per_day: input.views_per_day ?? null,
      age: input.age ?? null,
      closing_price_usd: isVenta ? (input.closing_price_usd ?? null) : null,
      closed_at: isVenta ? (input.closed_at ?? null) : null,
      source_sold_property_id: isVenta ? (input.source_sold_property_id ?? null) : null,
      sort_order: input.sort_order ?? 0,
    }
    await this.repo.addComparable(comparable)
    return { id }
  }
}
