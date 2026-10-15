// Recorte semiautomático del escáner: detectar las 4 esquinas de la hoja y
// enderezarla (corregir la perspectiva). Sin OpenCV: el caso típico —una hoja
// clara sobre una mesa más oscura— se resuelve con un umbral y geometría.

export interface Point { x: number; y: number }
/** Esquinas en orden: arriba-izq, arriba-der, abajo-der, abajo-izq. Normalizadas 0..1. */
export type Quad = [Point, Point, Point, Point]

/** Recuadro por defecto cuando no se detecta la hoja: casi toda la foto. */
export const DEFAULT_QUAD: Quad = [
  { x: 0.04, y: 0.04 }, { x: 0.96, y: 0.04 }, { x: 0.96, y: 0.96 }, { x: 0.04, y: 0.96 },
]

/** Umbral de Otsu: el que mejor separa dos grupos (papel y fondo) en el histograma. */
export function otsuThreshold(gray: Uint8ClampedArray | Uint8Array): number {
  const hist = new Array<number>(256).fill(0)
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++
  const total = gray.length
  let sumAll = 0
  for (let v = 0; v < 256; v++) sumAll += v * hist[v]
  let sumB = 0, wB = 0, best = 0, threshold = 127
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break
    sumB += t * hist[t]
    const mB = sumB / wB
    const mF = (sumAll - sumB) / wF
    const between = wB * wF * (mB - mF) ** 2
    if (between > best) { best = between; threshold = t }
  }
  return threshold
}

/**
 * Busca la hoja en una imagen chica en escala de grises (w × h, un byte por
 * píxel). Toma la mancha clara más grande y sus 4 extremos (el más arriba-izq
 * es el de menor x+y, etc.), que funciona aunque la hoja esté girada.
 * null si no hay una hoja razonable: el editor arranca con DEFAULT_QUAD.
 */
export function detectDocumentQuad(gray: Uint8ClampedArray | Uint8Array, w: number, h: number): Quad | null {
  const t = otsuThreshold(gray)
  const label = new Int32Array(w * h).fill(-1)
  let bestId = -1, bestSize = 0
  const stack: number[] = []
  let id = 0
  for (let start = 0; start < w * h; start++) {
    if (gray[start] <= t || label[start] !== -1) continue
    let size = 0
    stack.push(start)
    label[start] = id
    while (stack.length) {
      const p = stack.pop() as number
      size++
      const x = p % w, y = (p - x) / w
      const ns = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]
      for (const n of ns) {
        if (n >= 0 && label[n] === -1 && gray[n] > t) { label[n] = id; stack.push(n) }
      }
    }
    if (size > bestSize) { bestSize = size; bestId = id }
    id++
  }
  if (bestId < 0 || bestSize < w * h * 0.15) return null

  let tl = { s: Infinity, x: 0, y: 0 }, br = { s: -Infinity, x: 0, y: 0 }
  let tr = { s: -Infinity, x: 0, y: 0 }, bl = { s: Infinity, x: 0, y: 0 }
  for (let p = 0; p < w * h; p++) {
    if (label[p] !== bestId) continue
    const x = p % w, y = (p - x) / w
    if (x + y < tl.s) tl = { s: x + y, x, y }
    if (x + y > br.s) br = { s: x + y, x, y }
    if (x - y > tr.s) tr = { s: x - y, x, y }
    if (x - y < bl.s) bl = { s: x - y, x, y }
  }
  const quad: Quad = [
    { x: tl.x / (w - 1), y: tl.y / (h - 1) },
    { x: tr.x / (w - 1), y: tr.y / (h - 1) },
    { x: br.x / (w - 1), y: br.y / (h - 1) },
    { x: bl.x / (w - 1), y: bl.y / (h - 1) },
  ]
  const area = quadArea(quad)
  // Demasiado chica = no es la hoja; casi toda la foto = la hoja llena el
  // cuadro (o el fondo es claro): no hay nada útil que recortar.
  if (area < 0.15 || area > 0.97 || !isConvex(quad)) return null
  return quad
}

/** Área de un cuadrilátero (fórmula del zapato), en las mismas unidades que los puntos. */
export function quadArea(q: Quad): number {
  let a = 0
  for (let i = 0; i < 4; i++) {
    const p = q[i], n = q[(i + 1) % 4]
    a += p.x * n.y - n.x * p.y
  }
  return Math.abs(a) / 2
}

/** Las esquinas forman un cuadrilátero convexo (todas las vueltas para el mismo lado). */
export function isConvex(q: Quad): boolean {
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4]
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (Math.abs(cross) < 1e-9) continue
    const s = Math.sign(cross)
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return sign !== 0
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

/** Tamaño de la hoja enderezada (en píxeles), a partir de sus lados. */
export function outputSize(q: Quad, imgW: number, imgH: number, maxSide: number): { w: number; h: number } {
  const px = q.map(p => ({ x: p.x * imgW, y: p.y * imgH })) as Quad
  let w = Math.max(dist(px[0], px[1]), dist(px[3], px[2]))
  let h = Math.max(dist(px[0], px[3]), dist(px[1], px[2]))
  const scale = Math.min(1, maxSide / Math.max(w, h))
  w = Math.max(1, Math.round(w * scale))
  h = Math.max(1, Math.round(h * scale))
  return { w, h }
}

/**
 * Homografía que lleva el rectángulo de salida (0..w, 0..h) a las esquinas
 * de la foto: para cada píxel de la hoja derecha dice de qué punto de la foto
 * leerlo. Devuelve los 8 coeficientes (h33 = 1).
 */
export function homography(dst: Quad, w: number, h: number): number[] {
  const src: Point[] = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }]
  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const { x: u, y: v } = src[i]
    const { x, y } = dst[i]
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); b.push(x)
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); b.push(y)
  }
  return solve(A, b)
}

/** Eliminación gaussiana con pivoteo parcial (sistema 8×8). */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r
    ;[M[c], M[piv]] = [M[piv], M[c]]
    const d = M[c][c] || 1e-12
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = M[r][c] / d
      if (f === 0) continue
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-12))
}

/**
 * Endereza la hoja: para cada píxel de salida busca su punto en la foto
 * (homografía) y lo interpola entre los 4 vecinos. `quad` en píxeles de `src`.
 */
export function warpPerspective(
  src: Uint8ClampedArray, sw: number, sh: number, quad: Quad, ow: number, oh: number,
): Uint8ClampedArray {
  const [a, b, c, d, e, f, g, hh] = homography(quad, ow, oh)
  const out = new Uint8ClampedArray(ow * oh * 4)
  for (let v = 0; v < oh; v++) {
    for (let u = 0; u < ow; u++) {
      const den = g * u + hh * v + 1
      const x = Math.min(sw - 1.001, Math.max(0, (a * u + b * v + c) / den))
      const y = Math.min(sh - 1.001, Math.max(0, (d * u + e * v + f) / den))
      const x0 = x | 0, y0 = y | 0
      const fx = x - x0, fy = y - y0
      const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4
      const o = (v * ow + u) * 4
      for (let k = 0; k < 3; k++) {
        const top = src[i00 + k] * (1 - fx) + src[i10 + k] * fx
        const bottom = src[i01 + k] * (1 - fx) + src[i11 + k] * fx
        out[o + k] = top * (1 - fy) + bottom * fy
      }
      out[o + 3] = 255
    }
  }
  return out
}
