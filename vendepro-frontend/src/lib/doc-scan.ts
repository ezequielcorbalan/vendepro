// Escáner del portal del propietario: fotos de la cámara → un PDF, todo en el
// celular. Sin dependencias: un PDF con imágenes JPEG es texto plano más los
// bytes de cada JPEG tal cual (filtro DCTDecode), así que alcanza con armarlo a mano.

export interface ScannedPage {
  jpeg: Blob
  width: number
  height: number
  /** object URL para la miniatura; liberar con URL.revokeObjectURL. */
  previewUrl: string
}

/** Lado más largo de cada página: legible al imprimir y liviano para subir. */
const MAX_SIDE = 2000
const JPEG_QUALITY = 0.75
/** Ancho de página en puntos (A4 = 595 pt); el alto sigue la proporción de la foto. */
const PAGE_WIDTH_PT = 595

/**
 * Procesa una foto: la achica y, con `enhance`, la pasa a escala de grises con
 * los niveles estirados para que el papel quede blanco y la tinta negra, que es
 * lo que hace legible una foto sacada con mala luz.
 */
export async function processPhoto(file: Blob, enhance: boolean): Promise<ScannedPage> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('El navegador no permite procesar la imagen')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  if (enhance) {
    const background = estimateBackground(canvas, width, height)
    const img = ctx.getImageData(0, 0, width, height)
    enhanceAsScan(img.data, background)
    ctx.putImageData(img, 0, 0)
  }

  const jpeg = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('No se pudo comprimir la foto'))), 'image/jpeg', JPEG_QUALITY),
  )
  return { jpeg, width, height, previewUrl: URL.createObjectURL(jpeg) }
}

/**
 * Cómo cae la luz sobre la hoja: la foto achicada a ~1/32 y desenfocada, vuelta
 * a agrandar. Las letras desaparecen y queda sólo el papel con sus sombras. El
 * canvas hace el trabajo pesado (escalar y desenfocar) en vez de un bucle en JS.
 */
function estimateBackground(source: HTMLCanvasElement, width: number, height: number): Uint8ClampedArray | null {
  const sw = Math.max(8, Math.round(width / 32))
  const sh = Math.max(8, Math.round(height / 32))
  const small = document.createElement('canvas')
  small.width = sw
  small.height = sh
  const sctx = small.getContext('2d')
  const big = document.createElement('canvas')
  big.width = width
  big.height = height
  const bctx = big.getContext('2d')
  if (!sctx || !bctx) return null
  sctx.filter = 'blur(2px)'
  sctx.drawImage(source, 0, 0, sw, sh)
  bctx.imageSmoothingEnabled = true
  bctx.imageSmoothingQuality = 'high'
  bctx.drawImage(small, 0, 0, width, height)
  return bctx.getImageData(0, 0, width, height).data
}

const luma = (d: ArrayLike<number>, i: number) => (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000

/**
 * Escala de grises; si hay `background`, divide cada píxel por la luz que le
 * llega (sombras y luz despareja → papel parejo); después estira los niveles
 * entre los percentiles 2 y 95. El 95 (y no el 98) porque en un documento la
 * mayoría de los píxeles son papel: así el gris del papel termina en blanco.
 */
export function enhanceAsScan(data: Uint8ClampedArray, background?: ArrayLike<number> | null): void {
  const hist = new Uint32Array(256)
  const n = data.length / 4
  for (let i = 0; i < data.length; i += 4) {
    let y = luma(data, i)
    if (background) y = Math.min(255, (y * 255) / Math.max(1, luma(background, i)))
    const v = y | 0
    data[i] = v
    hist[v]++
  }
  const lo = percentile(hist, n, 0.02)
  const hi = Math.max(lo + 1, percentile(hist, n, 0.95))
  const range = hi - lo
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((data[i] - lo) * 255) / range))
    data[i] = data[i + 1] = data[i + 2] = v
  }
}

function percentile(hist: Uint32Array, total: number, p: number): number {
  const target = total * p
  let acc = 0
  for (let v = 0; v < 256; v++) {
    acc += hist[v]
    if (acc >= target) return v
  }
  return 255
}

/** Arma un PDF con una página por imagen JPEG, en el orden recibido. */
export async function buildPdfFromJpegs(pages: Array<{ jpeg: Blob; width: number; height: number }>): Promise<Blob> {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (chunk: Uint8Array | string) => {
    const bytes = typeof chunk === 'string' ? enc.encode(chunk) : chunk
    parts.push(bytes)
    length += bytes.length
  }
  const startObj = (id: number) => {
    offsets[id] = length
    push(`${id} 0 obj\n`)
  }

  // 1 = catálogo, 2 = árbol de páginas; cada página usa 3 objetos: página, contenido, imagen.
  const pageIds = pages.map((_, i) => 3 + i * 3)
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')

  startObj(1)
  push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  startObj(2)
  push(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`)

  for (let i = 0; i < pages.length; i++) {
    const { jpeg, width, height } = pages[i]
    const pageId = pageIds[i]
    const contentId = pageId + 1
    const imageId = pageId + 2
    const w = PAGE_WIDTH_PT
    const h = Math.round((PAGE_WIDTH_PT * height) / width)
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`

    startObj(pageId)
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
        `/Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`,
    )
    startObj(contentId)
    push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`)

    const bytes = new Uint8Array(await jpeg.arrayBuffer())
    startObj(imageId)
    push(
      `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`,
    )
    push(bytes)
    push('\nendstream\nendobj\n')
  }

  const totalObjs = 2 + pages.length * 3
  const xrefAt = length
  let xref = `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`
  for (let id = 1; id <= totalObjs; id++) xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  push(xref)
  push(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`)

  return new Blob(parts as BlobPart[], { type: 'application/pdf' })
}

/** Nombre de archivo a partir del documento elegido ("Título de propiedad.pdf"). */
export function scanFileName(label: string): string {
  const clean = label.replace(/\s*\(.*?\)\s*/g, ' ').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim()
  return `${clean || 'Documento escaneado'}.pdf`
}
