export interface PdfPutMeta {
  contentType: string
  contentDisposition: string
}

export interface PdfObject {
  body: ReadableStream<Uint8Array>
  size: number
  contentType: string
  contentDisposition: string
}

export interface PdfStorage {
  put(key: string, bytes: Uint8Array, meta: PdfPutMeta): Promise<void>
  get(key: string): Promise<PdfObject | null>
}
