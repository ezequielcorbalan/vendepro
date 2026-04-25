import { describe, it, expect } from 'vitest'
import { PdfDownloadTokenSignerImpl } from '../../src/services/pdf-download-token-signer'

describe('PdfDownloadTokenSignerImpl', () => {
  const opts = { secret: 'test-secret-1234567890', apiPublicBaseUrl: 'https://api-pub.test' }

  it('signs and verifies a roundtrip', async () => {
    const s = new PdfDownloadTokenSignerImpl(opts)
    const url = await s.buildDownloadUrl({ r2Key: 'k/x.pdf', orgId: 'o1', appraisalId: 'a1', filename: 'tasacion-x.pdf', ttlSec: 60 })
    expect(url).toContain('api-pub.test/public/pdf/o1/a1/tasacion-x.pdf?token=')
    const token = decodeURIComponent(url.split('token=')[1]!)
    const payload = await s.verify(token)
    expect(payload).toEqual({ r2Key: 'k/x.pdf', orgId: 'o1', appraisalId: 'a1' })
  })

  it('rejects a tampered token', async () => {
    const s = new PdfDownloadTokenSignerImpl(opts)
    const url = await s.buildDownloadUrl({ r2Key: 'k/x.pdf', orgId: 'o1', appraisalId: 'a1', filename: 'f.pdf', ttlSec: 60 })
    const token = decodeURIComponent(url.split('token=')[1]!)
    const tampered = token.slice(0, -2) + 'AA'
    expect(await s.verify(tampered)).toBeNull()
  })

  it('rejects an expired token', async () => {
    const s = new PdfDownloadTokenSignerImpl(opts)
    const url = await s.buildDownloadUrl({ r2Key: 'k/x.pdf', orgId: 'o1', appraisalId: 'a1', filename: 'f.pdf', ttlSec: -10 })
    const token = decodeURIComponent(url.split('token=')[1]!)
    expect(await s.verify(token)).toBeNull()
  })

  it('rejects malformed tokens', async () => {
    const s = new PdfDownloadTokenSignerImpl(opts)
    expect(await s.verify('not-a-jwt')).toBeNull()
    expect(await s.verify('a.b')).toBeNull()
    expect(await s.verify('')).toBeNull()
  })
})
