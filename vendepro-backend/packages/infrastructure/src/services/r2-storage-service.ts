import type { StorageService } from '@vendepro/core'

export class R2StorageService implements StorageService {
  constructor(
    private readonly bucket: R2Bucket,
    private readonly publicBaseUrl: string,
  ) {
    // Guard explícito. R2_PUBLIC_URL no estuvo seteada NUNCA en ningún worker:
    // `${undefined}/${key}` fabricaba URLs "undefined/reports/..." que se
    // guardaban en la base y recién se notaban como imagen rota en el reporte
    // público (2026-09-10). Las fotos de landings no lo sufrían porque el
    // frontend arma la URL por su cuenta contra /photo/<key> — por eso el bug
    // vivió tanto. Mejor reventar acá, visible, que persistir basura.
    if (!publicBaseUrl || typeof publicBaseUrl !== 'string' || publicBaseUrl.trim().length === 0) {
      const err = new Error(
        'Falta R2_PUBLIC_URL en el worker: las URLs de fotos saldrían rotas ("undefined/...").',
      ) as Error & { statusCode: number }
      err.statusCode = 500
      throw err
    }
    this.publicBaseUrl = publicBaseUrl.trim().replace(/\/+$/, '')
  }

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
