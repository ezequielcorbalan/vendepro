import { describe, it, expect } from 'vitest'
import { Prefactibilidad } from '../../src/domain/entities/prefactibilidad'

const baseProps = {
  id: 'pref-1',
  org_id: 'org_mg',
  agent_id: 'agent-1',
  lead_id: 'lead-1',
  public_slug: null,
  status: 'draft' as const,
  address: 'Av. Siempreviva 742',
  neighborhood: 'Palermo',
  city: 'CABA',
  lot_area: 500,
  lot_frontage: 20,
  lot_depth: 25,
  zoning: 'R2A',
  fot: 1.6,
  fos: 0.6,
  max_height: '12m',
  lot_price: 500000,
  lot_price_per_m2: 1000,
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
}

describe('Prefactibilidad entity', () => {
  it('creates a valid prefactibilidad', () => {
    const p = Prefactibilidad.create(baseProps)
    expect(p.id).toBe('pref-1')
    expect(p.org_id).toBe('org_mg')
    expect(p.agent_id).toBe('agent-1')
    expect(p.lead_id).toBe('lead-1')
    expect(p.status).toBe('draft')
    expect(p.address).toBe('Av. Siempreviva 742')
    expect(p.created_at).toBeDefined()
    expect(p.updated_at).toBeDefined()
  })

  it('creates with null lead_id and public_slug', () => {
    const p = Prefactibilidad.create({ ...baseProps, lead_id: null, public_slug: null })
    expect(p.lead_id).toBeNull()
    expect(p.public_slug).toBeNull()
  })

  it('respects created_at / updated_at if provided', () => {
    const created = '2026-01-01T00:00:00.000Z'
    const updated = '2026-02-01T00:00:00.000Z'
    const p = Prefactibilidad.create({ ...baseProps, created_at: created, updated_at: updated })
    expect(p.created_at).toBe(created)
    expect(p.updated_at).toBe(updated)
  })

  it('auto-generates timestamps if not provided', () => {
    const p = Prefactibilidad.create(baseProps)
    expect(() => new Date(p.created_at).toISOString()).not.toThrow()
    expect(() => new Date(p.updated_at).toISOString()).not.toThrow()
  })

  it('update() applies partial changes and bumps updated_at', async () => {
    const p = Prefactibilidad.create({ ...baseProps, updated_at: '2026-01-01T00:00:00.000Z' })
    const before = p.updated_at
    // Ensure at least 1ms elapses
    await new Promise((r) => setTimeout(r, 2))
    p.update({ status: 'generated', address: 'Calle Falsa 123' })
    expect(p.status).toBe('generated')
    expect(p.address).toBe('Calle Falsa 123')
    expect(p.updated_at).not.toBe(before)
  })

  it('update() allows transitioning to sent status', () => {
    const p = Prefactibilidad.create(baseProps)
    p.update({ status: 'sent', public_slug: 'abc-123' })
    expect(p.status).toBe('sent')
    expect(p.public_slug).toBe('abc-123')
  })

  it('toObject round-trips full state', () => {
    const p = Prefactibilidad.create(baseProps)
    const obj = p.toObject()
    expect(obj.id).toBe(baseProps.id)
    expect(obj.org_id).toBe(baseProps.org_id)
    expect(obj.agent_id).toBe(baseProps.agent_id)
    expect(obj.lead_id).toBe(baseProps.lead_id)
    expect(obj.status).toBe(baseProps.status)
    expect(obj.address).toBe(baseProps.address)
    expect(obj.city).toBe(baseProps.city)
    expect(obj.lot_area).toBe(baseProps.lot_area)
    expect(obj.created_at).toBe(p.created_at)
    expect(obj.updated_at).toBe(p.updated_at)
  })
})
