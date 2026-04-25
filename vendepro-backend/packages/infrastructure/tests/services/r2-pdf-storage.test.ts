import { describe, it, expect, vi } from 'vitest'
import { R2PdfStorage } from '../../src/services/r2-pdf-storage'

describe('R2PdfStorage', () => {
  it('put forwards bytes + httpMetadata', async () => {
    const bucket = { put: vi.fn().mockResolvedValue(undefined), get: vi.fn() }
    const svc = new R2PdfStorage(bucket as any)
    await svc.put('k/1.pdf', new Uint8Array([1, 2]), { contentType: 'application/pdf', contentDisposition: 'attachment; filename="x.pdf"' })
    expect(bucket.put).toHaveBeenCalledWith('k/1.pdf', new Uint8Array([1, 2]), {
      httpMetadata: { contentType: 'application/pdf', contentDisposition: 'attachment; filename="x.pdf"' },
    })
  })

  it('get returns object when present', async () => {
    const bucket = {
      put: vi.fn(),
      get: vi.fn().mockResolvedValue({
        body: new ReadableStream(),
        size: 42,
        httpMetadata: { contentType: 'application/pdf', contentDisposition: 'attachment' },
      }),
    }
    const svc = new R2PdfStorage(bucket as any)
    const out = await svc.get('k/1.pdf')
    expect(out?.size).toBe(42)
    expect(out?.contentType).toBe('application/pdf')
  })

  it('get returns null when not found', async () => {
    const bucket = { put: vi.fn(), get: vi.fn().mockResolvedValue(null) }
    const svc = new R2PdfStorage(bucket as any)
    expect(await svc.get('k/missing.pdf')).toBeNull()
  })
})
