import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GenerateAppraisalPdfUseCase } from '../../../src/application/use-cases/appraisals/generate-appraisal-pdf'
import { QuotaExceededError } from '../../../src/domain/errors/quota-exceeded-error'
import { RenderTimeoutError } from '../../../src/domain/errors/render-timeout-error'

const fixedNow = new Date('2026-04-24T12:00:00Z')

function makeAppraisal(overrides: Partial<any> = {}) {
  return {
    id: 'a1',
    org_id: 'o1',
    property_address: 'Mistral 3224',
    public_slug: 'mistral-3224',
    template_id: 't1',
    template_snapshot_json: JSON.stringify([
      { id: 'b1', type: 'cover', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0, data: { title: 'X' } },
      { id: 'b2', type: 'market_stats', binding_mode: 'org-variable', include_in_pdf: true, sort_order: 1, data: { vars: ['market.properties_on_sale'] } },
    ]),
    block_overrides_json: null,
    ...overrides,
  }
}

function makeDeps() {
  return {
    appraisalRepo: { findById: vi.fn(), update: vi.fn() },
    pdfRepo: { findCachedByHash: vi.fn(), countByOrgSince: vi.fn(), save: vi.fn() },
    orgVarRepo: { resolveKeys: vi.fn().mockResolvedValue({}) },
    templateRepo: {},
    browserRendering: { renderPdf: vi.fn() },
    pdfStorage: { put: vi.fn(), get: vi.fn() },
    tokenSigner: {
      buildDownloadUrl: vi.fn().mockReturnValue('https://pub/public/pdf/o1/a1/tasacion-mistral-3224.pdf?token=abc'),
      verify: vi.fn(),
    },
    idGen: { generate: vi.fn().mockReturnValue('pdf-id-1') },
    now: () => fixedNow,
  }
}

describe('GenerateAppraisalPdfUseCase', () => {
  let deps: ReturnType<typeof makeDeps>
  beforeEach(() => { deps = makeDeps() })

  it('returns cached PDF without calling the renderer', async () => {
    deps.appraisalRepo.findById.mockResolvedValue(makeAppraisal())
    deps.pdfRepo.findCachedByHash.mockResolvedValue({
      id: 'pdf-prev', org_id: 'o1', appraisal_id: 'a1',
      content_hash: 'hashZ', r2_key: 'appraisals/pdfs/o1/a1/hashZ.pdf',
      size_bytes: 12345, generated_at: '2026-04-20T10:00:00Z',
      expires_at: '2026-05-20T10:00:00Z',
    })
    deps.pdfRepo.countByOrgSince.mockResolvedValue(7)

    const uc = new GenerateAppraisalPdfUseCase(deps as any)
    const result = await uc.execute({ appraisalId: 'a1', orgId: 'o1', userId: 'u1' })

    expect(result.from_cache).toBe(true)
    expect(result.pdf_url).toContain('/public/pdf/o1/a1/')
    expect(result.monthly_used).toBe(7)
    expect(deps.browserRendering.renderPdf).not.toHaveBeenCalled()
    expect(deps.pdfStorage.put).not.toHaveBeenCalled()
  })

  it('throws QuotaExceededError when over 50 on cache miss', async () => {
    deps.appraisalRepo.findById.mockResolvedValue(makeAppraisal())
    deps.pdfRepo.findCachedByHash.mockResolvedValue(null)
    deps.pdfRepo.countByOrgSince.mockResolvedValue(50)

    const uc = new GenerateAppraisalPdfUseCase(deps as any)
    await expect(uc.execute({ appraisalId: 'a1', orgId: 'o1', userId: 'u1' }))
      .rejects.toBeInstanceOf(QuotaExceededError)
  })

  it('allows cache hits even when quota is at the limit', async () => {
    deps.appraisalRepo.findById.mockResolvedValue(makeAppraisal())
    deps.pdfRepo.findCachedByHash.mockResolvedValue({
      id: 'pdf-prev', org_id: 'o1', appraisal_id: 'a1',
      content_hash: 'hashZ', r2_key: 'appraisals/pdfs/o1/a1/hashZ.pdf',
      size_bytes: 12345, generated_at: '2026-04-20T10:00:00Z',
      expires_at: '2026-05-20T10:00:00Z',
    })
    deps.pdfRepo.countByOrgSince.mockResolvedValue(50)

    const uc = new GenerateAppraisalPdfUseCase(deps as any)
    const result = await uc.execute({ appraisalId: 'a1', orgId: 'o1', userId: 'u1' })
    expect(result.from_cache).toBe(true)
  })

  it('renders + persists + returns URL on cache miss (happy path)', async () => {
    deps.appraisalRepo.findById.mockResolvedValue(makeAppraisal())
    deps.pdfRepo.findCachedByHash.mockResolvedValue(null)
    deps.pdfRepo.countByOrgSince.mockResolvedValue(10)
    deps.browserRendering.renderPdf.mockResolvedValue(new Uint8Array([1, 2, 3]))
    deps.pdfStorage.put.mockResolvedValue(undefined)
    deps.pdfRepo.save.mockResolvedValue(undefined)

    const uc = new GenerateAppraisalPdfUseCase(deps as any)
    const result = await uc.execute({ appraisalId: 'a1', orgId: 'o1', userId: 'u1' })

    expect(deps.browserRendering.renderPdf).toHaveBeenCalledTimes(1)
    const [renderUrl] = deps.browserRendering.renderPdf.mock.calls[0]
    expect(renderUrl).toBe('https://app.vendepro.com.ar/t/mistral-3224?print=1')

    expect(deps.pdfStorage.put).toHaveBeenCalledTimes(1)
    const [r2Key, bytes, meta] = deps.pdfStorage.put.mock.calls[0]
    expect(r2Key).toMatch(/^appraisals\/pdfs\/o1\/a1\/[0-9a-f]{64}\.pdf$/)
    expect(bytes).toEqual(new Uint8Array([1, 2, 3]))
    expect(meta.contentType).toBe('application/pdf')

    expect(deps.pdfRepo.save).toHaveBeenCalledTimes(1)

    expect(result.from_cache).toBe(false)
    expect(result.monthly_used).toBe(11)
    expect(result.pdf_url).toContain('/public/pdf/o1/a1/')
  })

  it('generates public_slug when null before rendering', async () => {
    deps.appraisalRepo.findById.mockResolvedValue(makeAppraisal({ public_slug: null }))
    deps.pdfRepo.findCachedByHash.mockResolvedValue(null)
    deps.pdfRepo.countByOrgSince.mockResolvedValue(5)
    deps.appraisalRepo.update.mockResolvedValue(undefined)
    deps.browserRendering.renderPdf.mockResolvedValue(new Uint8Array([1]))

    const uc = new GenerateAppraisalPdfUseCase(deps as any)
    await uc.execute({ appraisalId: 'a1', orgId: 'o1', userId: 'u1' })

    expect(deps.appraisalRepo.update).toHaveBeenCalledWith('a1', 'o1', expect.objectContaining({ public_slug: expect.any(String) }))
    const [slug] = deps.browserRendering.renderPdf.mock.calls[0][0].match(/\/t\/([^?]+)/)!.slice(1)
    expect(slug.length).toBeGreaterThan(0)
  })

  it('propagates RenderTimeoutError from the renderer', async () => {
    deps.appraisalRepo.findById.mockResolvedValue(makeAppraisal())
    deps.pdfRepo.findCachedByHash.mockResolvedValue(null)
    deps.pdfRepo.countByOrgSince.mockResolvedValue(5)
    deps.browserRendering.renderPdf.mockRejectedValue(new RenderTimeoutError())

    const uc = new GenerateAppraisalPdfUseCase(deps as any)
    await expect(uc.execute({ appraisalId: 'a1', orgId: 'o1', userId: 'u1' }))
      .rejects.toBeInstanceOf(RenderTimeoutError)
    expect(deps.pdfStorage.put).not.toHaveBeenCalled()
    expect(deps.pdfRepo.save).not.toHaveBeenCalled()
  })

  it('produces same content_hash for identical input', async () => {
    const uc = new GenerateAppraisalPdfUseCase(deps as any)
    deps.appraisalRepo.findById.mockResolvedValue(makeAppraisal())
    deps.pdfRepo.findCachedByHash.mockResolvedValue(null)
    deps.pdfRepo.countByOrgSince.mockResolvedValue(1)
    deps.browserRendering.renderPdf.mockResolvedValue(new Uint8Array([9]))

    await uc.execute({ appraisalId: 'a1', orgId: 'o1', userId: 'u1' })
    const firstKey = deps.pdfStorage.put.mock.calls[0][0]

    // Reset storage mocks but return same content hash flow
    deps.pdfStorage.put.mockClear()
    deps.pdfRepo.save.mockClear()
    deps.browserRendering.renderPdf.mockResolvedValue(new Uint8Array([9]))

    await uc.execute({ appraisalId: 'a1', orgId: 'o1', userId: 'u1' })
    const secondKey = deps.pdfStorage.put.mock.calls[0][0]

    expect(firstKey).toBe(secondKey)
  })

  it('produces different content_hash when overrides change', async () => {
    const uc = new GenerateAppraisalPdfUseCase(deps as any)
    deps.pdfRepo.findCachedByHash.mockResolvedValue(null)
    deps.pdfRepo.countByOrgSince.mockResolvedValue(1)
    deps.browserRendering.renderPdf.mockResolvedValue(new Uint8Array([9]))

    deps.appraisalRepo.findById.mockResolvedValueOnce(makeAppraisal({ block_overrides_json: null }))
    await uc.execute({ appraisalId: 'a1', orgId: 'o1', userId: 'u1' })
    const firstKey = deps.pdfStorage.put.mock.calls[0][0]

    deps.pdfStorage.put.mockClear()
    deps.appraisalRepo.findById.mockResolvedValueOnce(makeAppraisal({ block_overrides_json: JSON.stringify({ b1: { title: 'CHANGED' } }) }))
    await uc.execute({ appraisalId: 'a1', orgId: 'o1', userId: 'u1' })
    const secondKey = deps.pdfStorage.put.mock.calls[0][0]

    expect(firstKey).not.toBe(secondKey)
  })
})
