export interface BrowserRenderPdfOptions {
  format?: 'A4' | 'Letter'
  margin?: string
  waitUntil?: 'networkidle0' | 'load' | 'domcontentloaded'
  timeoutMs?: number
}

export interface BrowserRenderingService {
  renderPdf(url: string, opts?: BrowserRenderPdfOptions): Promise<Uint8Array>
}
