import { describe, it, expect, vi } from 'vitest'
import {
  ExtractPortalReportFromPdfUseCase,
  base64ByteLength,
} from '../../../src/application/use-cases/ai/extract-portal-report-from-pdf'
import type { PortalReportExtractor } from '../../../src/application/ports/services/ai-service'

const extractor = (): PortalReportExtractor & { extractPortalReportFromPdf: any } => ({
  extractPortalReportFromPdf: vi.fn().mockResolvedValue({
    portals: [
      { source: 'zonaprop', impressions: 5400, portal_visits: 320, inquiries: 12 },
    ],
    total_visits_presenciales: 4,
    market_comparison: { avg_market_price: 118000 },
  }),
})

describe('base64ByteLength', () => {
  it('calcula los bytes reales sin decodificar', () => {
    // 'hola' → aG9sYQ== (4 bytes), 'ab' → YWI= (2 bytes)
    expect(base64ByteLength('aG9sYQ==')).toBe(4)
    expect(base64ByteLength('YWI=')).toBe(2)
    expect(base64ByteLength('')).toBe(0)
  })
})

describe('ExtractPortalReportFromPdfUseCase', () => {
  it('pasa el PDF al extractor y devuelve su resultado tal cual', async () => {
    const ex = extractor()
    const uc = new ExtractPortalReportFromPdfUseCase(ex)
    const report = await uc.execute({ pdfBase64: 'aG9sYQ==' })
    expect(report.portals[0].source).toBe('zonaprop')
    expect(report.total_visits_presenciales).toBe(4)
    expect(ex.extractPortalReportFromPdf).toHaveBeenCalledWith({ pdfBase64: 'aG9sYQ==' })
  })

  it('400 sin PDF', async () => {
    const uc = new ExtractPortalReportFromPdfUseCase(extractor())
    await expect(uc.execute({ pdfBase64: '' })).rejects.toMatchObject({ statusCode: 400 })
    await expect(uc.execute({ pdfBase64: '   ' })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('413 con el peso en el mensaje si el PDF supera los 10 MB', async () => {
    const ex = extractor()
    const uc = new ExtractPortalReportFromPdfUseCase(ex)
    // ~12 MB reales ≈ 16M chars de base64. No hace falta que sea base64 válido:
    // sólo se mide, no se decodifica.
    const huge = 'A'.repeat(16 * 1024 * 1024)
    try {
      await uc.execute({ pdfBase64: huge })
      expect.unreachable()
    } catch (e: any) {
      expect(e.statusCode).toBe(413)
      expect(e.message).toContain('MB')
    }
    expect(ex.extractPortalReportFromPdf).not.toHaveBeenCalled()
  })
})
