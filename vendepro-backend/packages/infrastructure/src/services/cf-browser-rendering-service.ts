import puppeteer from '@cloudflare/puppeteer'
import type { BrowserRenderingService, BrowserRenderPdfOptions } from '@vendepro/core'
import { RenderTimeoutError, RenderFailedError } from '@vendepro/core'

export class CfBrowserRenderingService implements BrowserRenderingService {
  constructor(private readonly binding: Fetcher) {}

  async renderPdf(url: string, opts: BrowserRenderPdfOptions = {}): Promise<Uint8Array> {
    const browser = await puppeteer.launch(this.binding as any)
    try {
      const page = await browser.newPage()
      try {
        await page.goto(url, {
          waitUntil: opts.waitUntil ?? 'networkidle0',
          timeout: opts.timeoutMs ?? 30000,
        })
      } catch (e: any) {
        if (/timeout/i.test(String(e?.message ?? ''))) throw new RenderTimeoutError()
        throw new RenderFailedError(String(e?.message ?? 'page.goto failed'))
      }
      try {
        const margin = opts.margin ?? '12mm'
        const buffer = await page.pdf({
          format: (opts.format ?? 'A4') as any,
          margin: { top: margin, bottom: margin, left: margin, right: margin },
          printBackground: true,
          preferCSSPageSize: true,
        })
        return new Uint8Array(buffer as unknown as ArrayBuffer)
      } catch (e: any) {
        throw new RenderFailedError(String(e?.message ?? 'page.pdf failed'))
      }
    } finally {
      try { await browser.close() } catch {}
    }
  }
}
