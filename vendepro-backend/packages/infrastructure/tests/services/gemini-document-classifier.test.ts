import { describe, it, expect, vi } from 'vitest'
import { GeminiDocumentClassifier, toClassification } from '../../src/services/gemini-document-classifier'

function geminiResponse(text: string) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 })
}

describe('toClassification', () => {
  it('toma la autorización con inicio y plazo', () => {
    expect(toClassification({
      tipo: 'autorizacion_venta', fecha_emision: '2026-10-08',
      autorizacion: { fecha_inicio: '2026-10-08', plazo_dias: 180 }, observaciones: 'Exclusiva',
    })).toEqual({
      docType: 'autorizacion_venta', issuedAt: '2026-10-08',
      authorization: { start_date: '2026-10-08', duration_days: 180 }, observations: 'Exclusiva',
    })
  })

  it('un tipo fuera del catálogo es "otro"', () => {
    expect(toClassification({ tipo: 'boleto_compraventa' }).docType).toBe('otro')
  })

  it('descarta fechas imposibles y plazos absurdos', () => {
    const c = toClassification({
      tipo: 'autorizacion_venta', fecha_emision: '2026-02-30',
      autorizacion: { fecha_inicio: '2026-10-08', plazo_dias: 99999 },
    })
    expect(c.issuedAt).toBeNull()
    expect(c.authorization).toEqual({ start_date: '2026-10-08', duration_days: null })
  })

  it('la autorización sólo cuenta si el tipo es autorización', () => {
    expect(toClassification({ tipo: 'titulo', autorizacion: { fecha_inicio: '2026-10-08', plazo_dias: 90 } }).authorization).toBeNull()
  })
})

describe('GeminiDocumentClassifier', () => {
  it('manda el archivo inline a la API nativa y parsea la respuesta', async () => {
    const fetchFn = vi.fn(async () => geminiResponse('```json\n{"tipo":"dni","fecha_emision":null,"autorizacion":null,"observaciones":"Frente y dorso"}\n```'))
    const out = await new GeminiDocumentClassifier('key', fetchFn as any).classify({ base64: 'AAAA', mimeType: 'image/jpeg', fileName: 'foto.jpg' })

    expect(out).toEqual({ docType: 'dni', issuedAt: null, authorization: null, observations: 'Frente y dorso' })
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain(':generateContent')
    const body = JSON.parse(String(init.body))
    expect(body.contents[0].parts[0]).toEqual({ inline_data: { mime_type: 'image/jpeg', data: 'AAAA' } })
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('key')
  })

  it('un error del proveedor se propaga: el barrido lo deja para la próxima pasada', async () => {
    const fetchFn = vi.fn(async () => new Response('overloaded', { status: 503 }))
    await expect(
      new GeminiDocumentClassifier('key', fetchFn as any).classify({ base64: 'A', mimeType: 'application/pdf', fileName: 'x.pdf' }),
    ).rejects.toThrow(/503/)
  })
})
