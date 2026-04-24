import { describe, it, expect, beforeEach } from 'vitest'
import { Miniflare } from 'miniflare'
import { D1AppraisalPdfRepository } from '../../src/repositories/d1-appraisal-pdf-repository'
import { AppraisalPdf } from '@vendepro/core'

const MIG = `CREATE TABLE appraisal_pdfs (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, appraisal_id TEXT NOT NULL,
  content_hash TEXT NOT NULL, r2_key TEXT NOT NULL, size_bytes INTEGER,
  generated_at TEXT NOT NULL, expires_at TEXT NOT NULL);`

describe('D1AppraisalPdfRepository', () => {
  let db: D1Database; let repo: D1AppraisalPdfRepository
  beforeEach(async () => {
    const mf = new Miniflare({ d1Databases: { DB: ':memory:' }, modules: true, script: 'export default {}' })
    db = await mf.getD1Database('DB'); await db.prepare(MIG).run()
    repo = new D1AppraisalPdfRepository(db)
  })

  const makePdf = (o: any = {}) => AppraisalPdf.create({
    id: o.id ?? 'p1', org_id: o.org_id ?? 'o1', appraisal_id: o.appraisal_id ?? 'a1',
    content_hash: o.content_hash ?? 'h1', r2_key: 'k', size_bytes: 0,
    generated_at: o.generated_at ?? '2026-04-01T00:00:00Z',
  })

  it('finds cached by hash when not expired', async () => {
    await repo.save(makePdf())
    const found = await repo.findCachedByHash('h1', new Date('2026-04-15T00:00:00Z'))
    expect(found?.id).toBe('p1')
  })

  it('does not return expired cached entry', async () => {
    await repo.save(makePdf())
    const found = await repo.findCachedByHash('h1', new Date('2030-01-01T00:00:00Z'))
    expect(found).toBeNull()
  })

  it('counts by org since a date', async () => {
    await repo.save(makePdf({ id: 'p1', generated_at: '2026-04-05T00:00:00Z' }))
    await repo.save(makePdf({ id: 'p2', content_hash: 'h2', generated_at: '2026-04-15T00:00:00Z' }))
    await repo.save(makePdf({ id: 'p3', content_hash: 'h3', generated_at: '2026-03-15T00:00:00Z' }))
    const n = await repo.countByOrgSince('o1', '2026-04-01T00:00:00Z')
    expect(n).toBe(2)
  })
})
