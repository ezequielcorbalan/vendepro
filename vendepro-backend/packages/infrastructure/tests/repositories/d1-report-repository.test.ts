import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
import { Report } from '@vendepro/core'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1ReportRepository } from '../../src/repositories/d1-report-repository'

describe('D1ReportRepository', () => {
  let env: TestEnv
  let orgId: string
  let agentId: string
  let propertyId: string

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
    propertyId = nextId('prop')
    await env.DB
      .prepare(
        `INSERT INTO properties (
           id, org_id, address, neighborhood, city, property_type,
           owner_name, owner_phone, owner_email,
           public_slug, agent_id, status, created_at, updated_at
         ) VALUES (?, ?, 'X', 'Y', 'CABA', 'departamento', 'Owner', '+5491100000000', 'o@test.com', ?, ?, 'active', datetime('now'), datetime('now'))`,
      )
      .bind(propertyId, orgId, `slug-${propertyId}`, agentId)
      .run()
  })

  const buildReport = (overrides: Partial<Parameters<typeof Report.create>[0]> = {}) =>
    Report.create({
      id: nextId('rep'),
      property_id: propertyId,
      period_label: 'Marzo 2026',
      period_start: '2026-03-01',
      period_end: '2026-03-31',
      status: 'draft',
      created_by: agentId,
      published_at: null,
      ...overrides,
    })

  it('save + findById scopes by org_id (added by migration 006)', async () => {
    const repo = new D1ReportRepository(env.DB)
    const r = buildReport()
    await repo.save(r)

    const found = await repo.findById(r.id, orgId)
    expect(found).not.toBeNull()
    const o = found!.toObject()
    expect(o.id).toBe(r.id)
    expect(o.property_id).toBe(propertyId)
    expect(o.period_label).toBe('Marzo 2026')
    expect(o.status).toBe('draft')
    expect(o.created_by).toBe(agentId)

    // Wrong org returns null
    const otherOrg = await seedOrg(env.DB)
    expect(await repo.findById(r.id, otherOrg.id)).toBeNull()
  })

  it('findByProperty returns reports scoped by org and property', async () => {
    const repo = new D1ReportRepository(env.DB)
    const r1 = buildReport({ period_label: 'A' })
    const r2 = buildReport({ period_label: 'B' })
    await repo.save(r1)
    await repo.save(r2)

    const list = await repo.findByProperty(propertyId, orgId)
    expect(list.length).toBe(2)
    const labels = list.map((r) => r.period_label).sort()
    expect(labels).toEqual(['A', 'B'])
  })

  it('findPublicBySlug returns null (reports has no public_slug column)', async () => {
    const repo = new D1ReportRepository(env.DB)
    const result = await repo.findPublicBySlug('anything')
    expect(result).toBeNull()
  })

  it('delete cascades to report_metrics, report_content, and report_photos', async () => {
    const repo = new D1ReportRepository(env.DB)
    const r = buildReport()
    await repo.save(r)

    // Seed child rows
    await env.DB
      .prepare(
        `INSERT INTO report_metrics (id, report_id, source, impressions) VALUES (?, ?, 'zonaprop', 100)`,
      )
      .bind(nextId('met'), r.id)
      .run()
    await env.DB
      .prepare(
        `INSERT INTO report_content (id, report_id, section, title, body, sort_order)
         VALUES (?, ?, 'strategy', 'T', 'B', 0)`,
      )
      .bind(nextId('cnt'), r.id)
      .run()
    await env.DB
      .prepare(
        `INSERT INTO report_photos (id, report_id, photo_url, photo_type, sort_order)
         VALUES (?, ?, 'u', 'property', 0)`,
      )
      .bind(nextId('pho'), r.id)
      .run()

    // Sanity check — child rows exist
    const beforeMetrics = (await env.DB.prepare('SELECT COUNT(*) as c FROM report_metrics WHERE report_id = ?').bind(r.id).first()) as any
    expect(beforeMetrics.c).toBe(1)

    await repo.delete(r.id, orgId)

    const after = await repo.findById(r.id, orgId)
    expect(after).toBeNull()

    const afterMetrics = (await env.DB.prepare('SELECT COUNT(*) as c FROM report_metrics WHERE report_id = ?').bind(r.id).first()) as any
    const afterContent = (await env.DB.prepare('SELECT COUNT(*) as c FROM report_content WHERE report_id = ?').bind(r.id).first()) as any
    const afterPhotos = (await env.DB.prepare('SELECT COUNT(*) as c FROM report_photos WHERE report_id = ?').bind(r.id).first()) as any
    expect(afterMetrics.c).toBe(0)
    expect(afterContent.c).toBe(0)
    expect(afterPhotos.c).toBe(0)
  })
})
