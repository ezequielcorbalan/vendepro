import type { StorageService } from '@vendepro/core'

export class R2StorageService implements StorageService {
  constructor(
    private readonly bucket: R2Bucket,
    private readonly publicBaseUrl: string | undefined | null,
  ) {}

  async upload(key: string, data: ArrayBuffer, contentType: string): Promise<string> {
    await this.bucket.put(key, data, { httpMetadata: { contentType } })
    return this.getUrl(key)
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key)
  }

  /**
   * Construye la URL pública del asset. Si `R2_PUBLIC_URL` no está seteado
   * (típico en dev local o en un deploy nuevo), caemos a la ruta relativa
   * `/photo/<key>` que sirve el proxy público del propio worker (definido
   * en `api-properties/src/routes/photos.ts`). El frontend recibe la ruta
   * relativa y la resuelve contra el host del worker.
   */
  getUrl(key: string): string {
    const base = (this.publicBaseUrl ?? '').trim().replace(/\/+$/, '')
    if (!base) return `/photo/${key}`
    return `${base}/${key}`
  }
}
