import type { PrefactibilidadRepository } from '../../ports/repositories/prefactibilidad-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { Prefactibilidad } from '../../../domain/entities/prefactibilidad'

export interface CreatePrefactibilidadInput {
  org_id: string
  agent_id: string
  lead_id?: string | null
  address: string
  neighborhood?: string | null
  city?: string
  lot_area?: number | null
  lot_frontage?: number | null
  lot_depth?: number | null
  zoning?: string | null
  fot?: number | null
  fos?: number | null
  max_height?: string | null
  lot_price?: number | null
  lot_price_per_m2?: number | null
  lot_description?: string | null
  project_name?: string | null
  project_description?: string | null
  buildable_area?: number | null
  total_units?: number | null
  units_mix?: string | null
  parking_spots?: number | null
  amenities?: string | null
  construction_cost_per_m2?: number | null
  total_construction_cost?: number | null
  professional_fees?: number | null
  permits_cost?: number | null
  commercialization_cost?: number | null
  other_costs?: number | null
  total_investment?: number | null
  avg_sale_price_per_m2?: number | null
  total_sellable_area?: number | null
  projected_revenue?: number | null
  gross_margin?: number | null
  margin_pct?: number | null
  comparables?: string | null
  timeline?: string | null
  executive_summary?: string | null
  recommendation?: string | null
}

export class CreatePrefactibilidadUseCase {
  constructor(
    private readonly repo: PrefactibilidadRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: CreatePrefactibilidadInput): Promise<{ id: string; slug: string }> {
    const id = this.idGen.generate()
    const slug = `pf-${id.slice(0, 12)}`

    const prefact = Prefactibilidad.create({
      id,
      org_id: input.org_id,
      agent_id: input.agent_id,
      lead_id: input.lead_id ?? null,
      public_slug: slug,
      status: 'draft',
      address: input.address,
      neighborhood: input.neighborhood ?? null,
      city: input.city ?? 'Buenos Aires',
      lot_area: input.lot_area ?? null,
      lot_frontage: input.lot_frontage ?? null,
      lot_depth: input.lot_depth ?? null,
      zoning: input.zoning ?? null,
      fot: input.fot ?? null,
      fos: input.fos ?? null,
      max_height: input.max_height ?? null,
      lot_price: input.lot_price ?? null,
      lot_price_per_m2: input.lot_price_per_m2 ?? null,
      lot_description: input.lot_description ?? null,
      lot_photos: null,
      project_name: input.project_name ?? null,
      project_description: input.project_description ?? null,
      buildable_area: input.buildable_area ?? null,
      total_units: input.total_units ?? null,
      units_mix: input.units_mix ?? null,
      parking_spots: input.parking_spots ?? null,
      amenities: input.amenities ?? null,
      project_renders: null,
      construction_cost_per_m2: input.construction_cost_per_m2 ?? null,
      total_construction_cost: input.total_construction_cost ?? null,
      professional_fees: input.professional_fees ?? null,
      permits_cost: input.permits_cost ?? null,
      commercialization_cost: input.commercialization_cost ?? null,
      other_costs: input.other_costs ?? null,
      total_investment: input.total_investment ?? null,
      avg_sale_price_per_m2: input.avg_sale_price_per_m2 ?? null,
      total_sellable_area: input.total_sellable_area ?? null,
      projected_revenue: input.projected_revenue ?? null,
      gross_margin: input.gross_margin ?? null,
      margin_pct: input.margin_pct ?? null,
      tir: null,
      payback_months: null,
      comparables: input.comparables ?? null,
      timeline: input.timeline ?? null,
      executive_summary: input.executive_summary ?? null,
      recommendation: input.recommendation ?? null,
      video_url: null,
      agent_notes: null,
    })

    await this.repo.save(prefact)
    return { id, slug }
  }
}
