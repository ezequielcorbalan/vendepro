import type { PdfStorage, PdfObject, PdfPutMeta } from '@vendepro/core'

export class R2PdfStorage implements PdfStorage {
  constructor(private readonly bucket: R2Bucket) {}

  async put(key: string, bytes: Uint8Array, meta: PdfPutMeta): Promise<void> {
    await this.bucket.put(key, bytes, {
      httpMetadata: {
        contentType: meta.contentType,
        contentDisposition: meta.contentDisposition,
      },
    })
  }

  async get(key: string): Promise<PdfObject | null> {
    const obj = await this.bucket.get(key)
    if (!obj) return null
    return {
      body: obj.body as ReadableStream<Uint8Array>,
      size: obj.size,
      contentType: obj.httpMetadata?.contentType ?? 'application/pdf',
      contentDisposition: obj.httpMetadata?.contentDisposition ?? `attachment; filename="${key.split('/').pop()}"`,
    }
  }
}
