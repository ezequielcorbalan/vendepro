import { describe, it, expect } from 'vitest'
import { AppraisalPdf } from '../../src/domain/entities/appraisal-pdf'

describe('AppraisalPdf', () => {
  it('creates with 30-day expiration', () => {
    const pdf = AppraisalPdf.create({
      id: 'p1', org_id: 'o1', appraisal_id: 'a1',
      content_hash: 'abc123', r2_key: 'appraisals/pdfs/o1/a1/abc123.pdf',
      size_bytes: 500000, generated_at: '2026-04-01T10:00:00Z',
    })
    expect(pdf.expires_at).toBe('2026-05-01T10:00:00.000Z')
  })

  it('isExpired() returns true after expiration', () => {
    const pdf = AppraisalPdf.create({
      id: 'p1', org_id: 'o1', appraisal_id: 'a1', content_hash: 'h', r2_key: 'k',
      size_bytes: 0, generated_at: '2020-01-01T00:00:00Z',
    })
    expect(pdf.isExpired(new Date('2026-04-23T00:00:00Z'))).toBe(true)
  })
})
