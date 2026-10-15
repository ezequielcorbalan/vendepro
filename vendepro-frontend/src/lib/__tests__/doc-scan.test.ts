import { describe, it, expect } from 'vitest'
import { buildPdfFromJpegs, enhanceAsScan, scanFileName } from '../doc-scan'

// JPEG mínimo de mentira: al armador sólo le importan los bytes y las medidas.
const fakeJpeg = (n: number) => new Blob([new Uint8Array(n).fill(0xff)], { type: 'image/jpeg' })

async function pdfText(blob: Blob): Promise<string> {
  return new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()))
}

describe('buildPdfFromJpegs', () => {
  it('arma un PDF con una página por foto', async () => {
    const pdf = await buildPdfFromJpegs([
      { jpeg: fakeJpeg(120), width: 1000, height: 1414 },
      { jpeg: fakeJpeg(80), width: 1414, height: 1000 },
    ])
    const text = await pdfText(pdf)
    expect(pdf.type).toBe('application/pdf')
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text).toContain('/Count 2')
    expect(text.match(/\/Type \/Page /g)).toHaveLength(2)
    expect(text).toContain('/Filter /DCTDecode /Length 120')
    // La página sigue la proporción de la foto: vertical y apaisada.
    expect(text).toContain('/MediaBox [0 0 595 841]')
    expect(text).toContain('/MediaBox [0 0 595 421]')
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
  })

  it('las posiciones del xref apuntan a cada objeto', async () => {
    const pdf = await buildPdfFromJpegs([{ jpeg: fakeJpeg(50), width: 10, height: 10 }])
    const bytes = new Uint8Array(await pdf.arrayBuffer())
    const text = await pdfText(pdf)
    const startxref = Number(text.match(/startxref\n(\d+)/)![1])
    expect(text.slice(startxref, startxref + 4)).toBe('xref')
    const entries = [...text.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map(m => Number(m[1]))
    expect(entries).toHaveLength(5)
    entries.forEach((offset, i) => {
      const head = new TextDecoder('latin1').decode(bytes.slice(offset, offset + 12))
      expect(head.startsWith(`${i + 1} 0 obj`)).toBe(true)
    })
  })
})

describe('enhanceAsScan', () => {
  it('lleva el papel gris a blanco y la tinta a negro', () => {
    // 90 píxeles de "papel" gris claro y 10 de "tinta" gris oscuro.
    const data = new Uint8ClampedArray(100 * 4)
    for (let i = 0; i < 100; i++) {
      const v = i < 10 ? 60 : 180
      data.set([v, v, v, 255], i * 4)
    }
    enhanceAsScan(data)
    expect(data[0]).toBe(0)
    expect(data[50 * 4]).toBe(255)
    expect(data[50 * 4 + 3]).toBe(255) // el alfa no se toca
  })

  it('con el fondo estimado, la mitad en sombra queda tan blanca como la iluminada', () => {
    // Papel con luz despareja: 200 de un lado, 100 del otro; tinta al 40% de su papel.
    const px = (i: number) => {
      const paper = i < 50 ? 200 : 100
      return i % 10 === 0 ? paper * 0.4 : paper
    }
    const data = new Uint8ClampedArray(100 * 4)
    const background = new Uint8ClampedArray(100 * 4)
    for (let i = 0; i < 100; i++) {
      const v = px(i)
      data.set([v, v, v, 255], i * 4)
      const b = i < 50 ? 200 : 100
      background.set([b, b, b, 255], i * 4)
    }
    enhanceAsScan(data, background)
    expect(data[5 * 4]).toBe(255)  // papel con luz
    expect(data[55 * 4]).toBe(255) // papel en sombra: también blanco
    expect(data[60 * 4]).toBe(0)   // tinta en sombra: negra
  })
})

describe('scanFileName', () => {
  it('usa el nombre del documento sin la aclaración entre paréntesis', () => {
    expect(scanFileName('Título de propiedad (escritura)')).toBe('Título de propiedad.pdf')
    expect(scanFileName('DNI del propietario (frente y dorso)')).toBe('DNI del propietario.pdf')
    expect(scanFileName('  ')).toBe('Documento escaneado.pdf')
  })
})
