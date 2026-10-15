import { describe, it, expect, vi } from 'vitest'
import { GoogleDriveStorage } from '../../src/services/google-drive-storage'
import { GeminiDocumentClassifier, toClassification } from '../../src/services/gemini-document-classifier'

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers })

describe('GoogleDriveStorage', () => {
  it('reusa la carpeta de la propiedad si ya existe (búsqueda por etiqueta, no por nombre)', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ files: [{ id: 'f1', webViewLink: 'https://drive/f1' }] }))
    const folder = await new GoogleDriveStorage('tok', fetchFn as any)
      .ensurePropertyFolder({ rootFolderId: 'root', propertyId: "p'1", name: 'Calle 123' })

    expect(folder).toEqual({ id: 'f1', url: 'https://drive/f1' })
    expect(fetchFn).toHaveBeenCalledOnce()
    const q = new URL(fetchFn.mock.calls[0]![0] as string).searchParams.get('q')!
    expect(q).toContain("key='vendepro_property_id' and value='p\\'1'")
    expect(q).toContain("'root' in parents")
    expect(q).toContain('trashed=false')
  })

  it('crea la carpeta con su etiqueta si no existe', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(json({ files: [] }))
      .mockResolvedValueOnce(json({ id: 'new', webViewLink: 'https://drive/new' }))
    const folder = await new GoogleDriveStorage('tok', fetchFn as any)
      .ensurePropertyFolder({ rootFolderId: 'root', propertyId: 'p1', name: 'Calle 123' })

    expect(folder.id).toBe('new')
    const body = JSON.parse((fetchFn.mock.calls[1]![1] as RequestInit).body as string)
    expect(body).toMatchObject({
      name: 'Calle 123', parents: ['root'], mimeType: 'application/vnd.google-apps.folder',
      appProperties: { vendepro_property_id: 'p1' },
    })
  })

  it('sube en dos pasos (sesión reanudable + bytes)', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { location: 'https://upload/session' } }))
      .mockResolvedValueOnce(json({ id: 'file1', webViewLink: 'https://drive/file1' }))
    const data = new Blob(['%PDF-1.4'], { type: 'application/pdf' })
    const out = await new GoogleDriveStorage('tok', fetchFn as any)
      .upload({ folderId: 'f1', name: 'Título.pdf', mimeType: 'application/pdf', data })

    expect(out).toEqual({ id: 'file1', url: 'https://drive/file1' })
    const [initUrl, init] = fetchFn.mock.calls[0]! as [string, any]
    expect(initUrl).toContain('uploadType=resumable')
    expect(init.headers['X-Upload-Content-Length']).toBe(String(data.size))
    expect(JSON.parse(init.body)).toEqual({ name: 'Título.pdf', parents: ['f1'] })
    expect(fetchFn.mock.calls[1]![0]).toBe('https://upload/session')
  })

  it('un error de Drive se propaga con su mensaje', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ error: { message: 'insufficientPermissions' } }, 403))
    await expect(new GoogleDriveStorage('tok', fetchFn as any).ensureRootFolder('VendéPro'))
      .rejects.toThrow(/insufficientPermissions/)
  })
})

describe('GeminiDocumentClassifier', () => {
  it('normaliza la respuesta del modelo', () => {
    expect(toClassification({ tipo: 'abl', fecha_emision: '2026-09-01', observaciones: ' ok ' }))
      .toEqual({ docType: 'abl', issuedAt: '2026-09-01', authorization: null, observations: 'ok' })
    expect(toClassification({ tipo: 'boleto', fecha_emision: '01/09/2026' }))
      .toEqual({ docType: 'otro', issuedAt: null, authorization: null, observations: null })
  })

  it('lee el plazo de la autorización sólo cuando es una autorización', () => {
    const c = toClassification({
      tipo: 'autorizacion_venta', fecha_emision: '2026-10-01',
      autorizacion: { inicio: '2026-10-01', plazo_dias: 180, fin: null, exclusiva: true },
    })
    expect(c.authorization).toEqual({ startDate: '2026-10-01', durationDays: 180, endDate: null, exclusive: true })
    expect(toClassification({ tipo: 'dni', autorizacion: { inicio: '2026-10-01' } }).authorization).toBeNull()
  })

  it('manda el archivo inline con la pista del propietario', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({
      candidates: [{ content: { parts: [{ text: '{"tipo":"titulo","fecha_emision":"2010-08-10"}' }] } }],
    }))
    const out = await new GeminiDocumentClassifier('key', fetchFn as any).classify({
      data: new Blob(['%PDF']), mimeType: 'application/pdf', fileName: 'x.pdf', declaredType: 'titulo',
    })
    expect(out.docType).toBe('titulo')
    const body = JSON.parse((fetchFn.mock.calls[0]![1] as any).body)
    expect(body.contents[0].parts[0].inline_data.mime_type).toBe('application/pdf')
    expect(body.contents[0].parts[1].text).toContain('El propietario dijo que es "Título de propiedad (escritura)"')
  })

  it('un error del proveedor o de configuración TIRA (el barrido reintenta); no vuelve como "otro"', async () => {
    const doc = { data: new Blob(['x']), mimeType: 'image/jpeg', fileName: 'a.jpg' }
    await expect(new GeminiDocumentClassifier('', vi.fn() as any).classify(doc)).rejects.toThrow(/GEMINI_API_KEY/)
    const caido = vi.fn().mockResolvedValue(new Response('overloaded', { status: 503 }))
    await expect(new GeminiDocumentClassifier('key', caido as any).classify(doc)).rejects.toThrow(/503/)
    const sinRed = vi.fn().mockRejectedValue(new Error('timeout'))
    await expect(new GeminiDocumentClassifier('key', sinRed as any).classify(doc)).rejects.toThrow('timeout')
  })

  it('un documento que el modelo no reconoce sí vuelve como "otro"', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({
      candidates: [{ content: { parts: [{ text: '{"tipo":"otro","observaciones":"ilegible"}' }] } }],
    }))
    const out = await new GeminiDocumentClassifier('key', fetchFn as any).classify({
      data: new Blob(['x']), mimeType: 'image/jpeg', fileName: 'a.jpg',
    })
    expect(out).toMatchObject({ docType: 'otro', observations: 'ilegible' })
  })
})
