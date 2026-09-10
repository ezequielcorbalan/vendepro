import { describe, it, expect, vi } from 'vitest'
import { R2StorageService } from '../../src/services/r2-storage-service'

const bucket = { put: vi.fn(), delete: vi.fn() } as any

describe('R2StorageService', () => {
  it('revienta claro si falta la base URL — nunca más URLs "undefined/..."', () => {
    for (const mala of [undefined as any, null as any, '', '   ']) {
      expect(() => new R2StorageService(bucket, mala)).toThrow(/R2_PUBLIC_URL/)
      try { new R2StorageService(bucket, mala) } catch (e: any) { expect(e.statusCode).toBe(500) }
    }
  })

  it('arma la URL pública y tolera la barra final de la base', async () => {
    const svc = new R2StorageService(bucket, 'https://properties.api.vendepro.com.ar/photo/')
    expect(svc.getUrl('reports/org/rep/foto.png'))
      .toBe('https://properties.api.vendepro.com.ar/photo/reports/org/rep/foto.png')
    const url = await svc.upload('k.png', new ArrayBuffer(4), 'image/png')
    expect(url).toBe('https://properties.api.vendepro.com.ar/photo/k.png')
    expect(bucket.put).toHaveBeenCalled()
  })
})
