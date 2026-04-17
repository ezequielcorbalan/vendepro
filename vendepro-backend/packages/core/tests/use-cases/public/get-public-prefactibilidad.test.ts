import { describe, it, expect, vi } from 'vitest'
import { GetPublicPrefactibilidadUseCase } from '../../../src/application/use-cases/public/get-public-prefactibilidad'
import { Prefactibilidad } from '../../../src/domain/entities/prefactibilidad'

const makePrefact = () =>
  Prefactibilidad.create({
    id: 'pref-1',
    org_id: 'org-1',
    agent_id: 'agent-1',
    lead_id: null,
    public_slug: 'prefact-libertador',
    status: 'generated',
    address: 'Av. Libertador 5000',
    neighborhood: 'Núñez',
    city: 'Buenos Aires',
    lot_area: 600,
    lot_frontage: null,
    lot_depth: null,
    zoning: null,
    fot: null,
    fos: null,
    max_height: null,
    lot_price: null,
    lot_price_per_m2: null,
    lot_description: null,
    lot_photos: null,
    project_name: null,
    project_description: null,
    buildable_area: null,
    total_units: null,
    units_mix: null,
    parking_spots: null,
    amenities: null,
    project_renders: null,
    construction_cost_per_m2: null,
    total_construction_cost: null,
    professional_fees: null,
    permits_cost: null,
    commercialization_cost: null,
    other_costs: null,
    total_investment: null,
    avg_sale_price_per_m2: null,
    total_sellable_area: null,
    projected_revenue: null,
    gross_margin: null,
    margin_pct: null,
    tir: null,
    payback_months: null,
    comparables: null,
    timeline: null,
    executive_summary: null,
    recommendation: null,
    video_url: null,
    agent_notes: null,
  })

const mockOrg = { name: 'Inmobiliaria MG', logo_url: null, brand_color: '#ff007c' }

describe('GetPublicPrefactibilidadUseCase', () => {
  it('returns prefact and org when slug matches', async () => {
    const prefactRepo = {
      findPublicBySlugWithOrg: vi.fn().mockResolvedValue({ prefact: makePrefact(), org: mockOrg }),
    } as any

    const uc = new GetPublicPrefactibilidadUseCase(prefactRepo)
    const result = await uc.execute('prefact-libertador')

    expect(result).not.toBeNull()
    expect(result!.prefact.id).toBe('pref-1')
    expect(result!.org.name).toBe('Inmobiliaria MG')
    expect(prefactRepo.findPublicBySlugWithOrg).toHaveBeenCalledWith('prefact-libertador')
  })

  it('returns null when slug not found', async () => {
    const prefactRepo = {
      findPublicBySlugWithOrg: vi.fn().mockResolvedValue(null),
    } as any

    const uc = new GetPublicPrefactibilidadUseCase(prefactRepo)
    const result = await uc.execute('no-such-slug')

    expect(result).toBeNull()
  })
})
