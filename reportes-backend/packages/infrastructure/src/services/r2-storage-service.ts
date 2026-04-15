import type { StorageService } from '@vendepro/core'

export class R2StorageService implements StorageService {
  constructor(
    private readonly bucket: R2Bucket,
    private readonly publicBaseUrl: string,
  ) {}

  async upload(key: string, data: ArrayBuffer, contentType: string): Promise<string> {
    await this.bucket.put(key, data, { httpMetadata: { contentType } })
    return this.getUrl(key)
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key)
  }

  getUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`
  }
}
