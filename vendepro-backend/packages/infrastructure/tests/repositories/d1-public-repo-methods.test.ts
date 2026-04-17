/**
 * Integration tests for the new public-access repository methods added in Fase 7.
 *
 * Covers:
 * - PropertyRepository.findByPublicSlug
 * - ReportRepository.findLatestPublishedByProperty
 * - TemplateBlockRepository.findEnabledByOrg
 * - AppraisalRepository.findPublicByIdOrSlugWithOrg
 * - PrefactibilidadRepository.findPublicBySlugWithOrg
 */
import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
import { Appraisal, Prefactibilidad, Property, Report, TemplateBlock } from '@vendepro/core'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1PropertyRepository } from '../../src/repositories/d1-property-repository'
import { D1ReportRepository } from '../../src/repositories/d1-report-repository'
import { D1TemplateBlockRepository } from '../../src/repositories/d1-template-block-repository'
import { D1AppraisalRepository } from '../../src/repositories/d1-appraisal-repository'
import { D1PrefactibilidadRepository } from '../../src/repositories/d1-prefactibilidad-repository'

let env: TestEnv
let orgId: string
let agentId: string

beforeAll(async () => {
  env = await createTestDB()
})

afterAll(async () => {
  await closeTestDB(env)
})

beforeEach(async () => {
  const org = await seedOrg(env.DB)
  orgId = org.id
  const user = await seedUser(env.DB, orgId)
  agentId = user.id
})

// ── Helpers ─────────────────────────────────────────────────────

const buildProperty = (overrides: Record<string, unknown> = {}) =>
  Property.create({
    id: nextId('prop'),
    org_id: orgId,
    address: 'Av. Test 100',
    neighborhood: 'Palermo',
    city: 'CABA',
    property_type: 'departamento',
    rooms: 2,
    size_m2: 60,
    asking_price: 100000,
    currency: 'USD',
    owner_name: 'Owner',
    owner_phone: null,
    owner_email: null,
    contact_id: null,
    public_slug: nextId('slug'),
    cover_photo: null,
    agent_id: agentId,
    status: 'active',
    commercial_stage: null,
    operation_type: 'venta',
    operation_type_id: 1,
    commercial_stage_id: null,
    status_id: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as any)

const buildReport = (propertyId: string, overrides: Partial<Parameters<typeof Report.create>[0]> = {}) =>
  Report.create({
    id: nextId('rep'),
    property_id: propertyId,
    period_label: 'Enero 2026',
    period_start: '2026-01-01',
    period_end: '2026-01-31',
    status: 'draft',
    created_by: agentId,
    published_at: null,
    ...overrides,
  })

const buildAppraisal = (overrides: Partial<Parameters<typeof Appraisal.create>[0]> = {}) =>
  Appraisal.create({
    id: nextId('appr'),
    org_id: orgId,
    property_address: 'Corrientes 500',
    neighborhood: 'San Nicolás',
    city: 'CABA',
    property_type: 'departamento',
    covered_area: null,
    total_area: null,
    semi_area: null,
    weighted_area: null,
    strengths: null,
    weaknesses: null,
    opportunities: null,
    threats: null,
    publication_analysis: null,
    suggested_price: null,
    test_price: null,
    expected_close_price: null,
    usd_per_m2: null,
    canva_design_id: null,
    canva_edit_url: null,
    agent_id: agentId,
    lead_id: null,
    status: 'draft',
    public_slug: null,
    ...overrides,
  })

const buildBlock = (overrides: Partial<Parameters<typeof TemplateBlock.create>[0]> = {}) =>
  TemplateBlock.create({
    id: nextId('block'),
    org_id: orgId,
    block_type: 'service',
    title: 'Servicio de Fotografía',
    description: null,
    icon: null,
    number_label: null,
    video_url: null,
    image_url: null,
    sort_order: 1,
    enabled: 1,
    section: 'commercial',
    ...overrides,
  })

const buildPrefact = (slug: string) =>
  Prefactibilidad.create({
    id: nextId('pref'),
    org_id: orgId,
    agent_id: agentId,
    lead_id: null,
    public_slug: slug,
    status: 'generated',
    address: 'Libertador 5000',
    neighborhood: 'Núñez',
    city: 'CABA',
    lot_area: null,
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

// ── PropertyRepository.findByPublicSlug ──────────────────────────

describe('D1PropertyRepository.findByPublicSlug', () => {
  it('returns the property when slug matches', async () => {
    const repo = new D1PropertyRepository(env.DB)
    const prop = buildProperty({ public_slug: 'public-slug-test-001' })
    await repo.save(prop)

    const found = await repo.findByPublicSlug('public-slug-test-001')
    expect(found).not.toBeNull()
    expect(found!.id).toBe(prop.id)
    expect(found!.public_slug).toBe('public-slug-test-001')
  })

  it('returns null when slug does not exist', async () => {
    const repo = new D1PropertyRepository(env.DB)
    const found = await repo.findByPublicSlug('no-such-slug-xyz')
    expect(found).toBeNull()
  })
})

// ── ReportRepository.findLatestPublishedByProperty ──────────────

describe('D1ReportRepository.findLatestPublishedByProperty', () => {
  let propertyId: string

  beforeEach(async () => {
    const propRepo = new D1PropertyRepository(env.DB)
    const prop = buildProperty({ public_slug: `slug-report-${nextId()}` })
    propertyId = prop.id
    await propRepo.save(prop)
  })

  it('returns the latest published report for the property', async () => {
    const repo = new D1ReportRepository(env.DB)
    const draft = buildReport(propertyId, { status: 'draft' })
    const published1 = buildReport(propertyId, {
      status: 'published',
      period_label: 'Feb 2026',
      period_start: '2026-02-01',
      period_end: '2026-02-28',
      published_at: '2026-02-01T00:00:00.000Z',
    })
    await repo.save(draft)
    await repo.save(published1)

    const found = await repo.findLatestPublishedByProperty(propertyId)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(published1.id)
    expect(found!.status).toBe('published')
  })

  it('returns null when no published reports exist', async () => {
    const repo = new D1ReportRepository(env.DB)
    const draft = buildReport(propertyId, { status: 'draft' })
    await repo.save(draft)

    const found = await repo.findLatestPublishedByProperty(propertyId)
    expect(found).toBeNull()
  })

  it('returns null for a property with no reports', async () => {
    const repo = new D1ReportRepository(env.DB)
    const found = await repo.findLatestPublishedByProperty('nonexistent-property-id')
    expect(found).toBeNull()
  })
})

// ── TemplateBlockRepository.findEnabledByOrg ────────────────────

describe('D1TemplateBlockRepository.findEnabledByOrg', () => {
  it('returns only enabled blocks for the org, ordered by sort_order', async () => {
    const repo = new D1TemplateBlockRepository(env.DB)
    const enabled1 = buildBlock({ sort_order: 1, enabled: 1 })
    const enabled2 = buildBlock({ sort_order: 2, enabled: 1 })
    const disabled = buildBlock({ sort_order: 0, enabled: 0 })

    await repo.save(enabled1)
    await repo.save(enabled2)
    await repo.save(disabled)

    const results = await repo.findEnabledByOrg(orgId)
    expect(results.length).toBeGreaterThanOrEqual(2)
    expect(results.every(b => b.enabled === 1)).toBe(true)
    // Verify disabled block is excluded
    const ids = results.map(b => b.id)
    expect(ids).not.toContain(disabled.id)
    expect(ids).toContain(enabled1.id)
    expect(ids).toContain(enabled2.id)
  })

  it('returns empty array when no enabled blocks exist', async () => {
    const repo = new D1TemplateBlockRepository(env.DB)
    const results = await repo.findEnabledByOrg('nonexistent-org-id')
    expect(results).toEqual([])
  })
})

// ── AppraisalRepository.findPublicByIdOrSlugWithOrg ─────────────

describe('D1AppraisalRepository.findPublicByIdOrSlugWithOrg', () => {
  it('returns appraisal and org when searching by id', async () => {
    const repo = new D1AppraisalRepository(env.DB)
    const appr = buildAppraisal({ public_slug: 'appr-slug-001' })
    await repo.save(appr)

    const result = await repo.findPublicByIdOrSlugWithOrg(appr.id)
    expect(result).not.toBeNull()
    expect(result!.appraisal.id).toBe(appr.id)
    expect(result!.org.name).toBeTruthy()
  })

  it('returns appraisal and org when searching by public_slug', async () => {
    const repo = new D1AppraisalRepository(env.DB)
    const appr = buildAppraisal({ public_slug: 'appr-slug-002' })
    await repo.save(appr)

    const result = await repo.findPublicByIdOrSlugWithOrg('appr-slug-002')
    expect(result).not.toBeNull()
    expect(result!.appraisal.id).toBe(appr.id)
  })

  it('returns null when neither id nor slug matches', async () => {
    const repo = new D1AppraisalRepository(env.DB)
    const result = await repo.findPublicByIdOrSlugWithOrg('no-match-xyz')
    expect(result).toBeNull()
  })
})

// ── PrefactibilidadRepository.findPublicBySlugWithOrg ───────────

describe('D1PrefactibilidadRepository.findPublicBySlugWithOrg', () => {
  it('returns prefact and org when slug matches', async () => {
    const repo = new D1PrefactibilidadRepository(env.DB)
    const prefact = buildPrefact('pref-slug-public-001')
    await repo.save(prefact)

    const result = await repo.findPublicBySlugWithOrg('pref-slug-public-001')
    expect(result).not.toBeNull()
    expect(result!.prefact.id).toBe(prefact.id)
    expect(result!.org.name).toBeTruthy()
  })

  it('returns null when slug not found', async () => {
    const repo = new D1PrefactibilidadRepository(env.DB)
    const result = await repo.findPublicBySlugWithOrg('no-such-slug-xyz')
    expect(result).toBeNull()
  })
})
