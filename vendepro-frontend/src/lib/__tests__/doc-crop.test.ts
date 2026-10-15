import { describe, it, expect } from 'vitest'
import {
  detectDocumentQuad, homography, isConvex, otsuThreshold, outputSize, quadArea, warpPerspective,
  type Quad,
} from '../doc-crop'

/** Imagen gris w×h: fondo oscuro con una "hoja" clara en el polígono dado (píxeles). */
function scene(w: number, h: number, poly: Array<[number, number]>, paper = 220, table = 60): Uint8ClampedArray {
  const g = new Uint8ClampedArray(w * h).fill(table)
  const inside = (x: number, y: number) => {
    let c = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j]
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
    }
    return c
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x, y)) g[y * w + x] = paper
  return g
}

const near = (a: number, b: number, tol = 0.03) => Math.abs(a - b) <= tol

describe('detectDocumentQuad', () => {
  it('encuentra las 4 esquinas de una hoja girada sobre una mesa oscura', () => {
    const w = 200, h = 260
    const corners: Array<[number, number]> = [[50, 30], [170, 55], [150, 230], [25, 200]]
    const q = detectDocumentQuad(scene(w, h, corners), w, h)!
    expect(q).not.toBeNull()
    q.forEach((p, i) => {
      expect(near(p.x, corners[i][0] / (w - 1))).toBe(true)
      expect(near(p.y, corners[i][1] / (h - 1))).toBe(true)
    })
  })

  it('sin una hoja clara (todo uniforme) no inventa un recorte', () => {
    expect(detectDocumentQuad(new Uint8ClampedArray(100 * 100).fill(128), 100, 100)).toBeNull()
  })

  it('si la hoja llena toda la foto no hay nada que recortar', () => {
    const q = detectDocumentQuad(scene(100, 100, [[0, 0], [100, 0], [100, 100], [0, 100]]), 100, 100)
    expect(q).toBeNull()
  })

  it('una mancha clara chica (un reflejo) no es la hoja', () => {
    expect(detectDocumentQuad(scene(100, 100, [[10, 10], [25, 10], [25, 25], [10, 25]]), 100, 100)).toBeNull()
  })
})

describe('geometría', () => {
  it('Otsu separa papel y mesa', () => {
    const g = new Uint8ClampedArray([...Array(50).fill(40), ...Array(50).fill(210)])
    const t = otsuThreshold(g)
    expect(t).toBeGreaterThanOrEqual(40)
    expect(t).toBeLessThan(210)
  })

  it('área y convexidad', () => {
    const square: Quad = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]
    expect(quadArea(square)).toBe(1)
    expect(isConvex(square)).toBe(true)
    const crossed: Quad = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 1 }]
    expect(isConvex(crossed)).toBe(false)
  })

  it('la homografía lleva las esquinas de la salida a las de la foto', () => {
    const quad: Quad = [{ x: 10, y: 20 }, { x: 110, y: 5 }, { x: 120, y: 140 }, { x: 0, y: 130 }]
    const [a, b, c, d, e, f, g, h] = homography(quad, 100, 120)
    const map = (u: number, v: number) => {
      const den = g * u + h * v + 1
      return { x: (a * u + b * v + c) / den, y: (d * u + e * v + f) / den }
    }
    const out = [map(0, 0), map(100, 0), map(100, 120), map(0, 120)]
    out.forEach((p, i) => {
      expect(p.x).toBeCloseTo(quad[i].x, 6)
      expect(p.y).toBeCloseTo(quad[i].y, 6)
    })
  })

  it('el tamaño de salida sigue los lados de la hoja y respeta el máximo', () => {
    const q: Quad = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]
    expect(outputSize(q, 3000, 4000, 2000)).toEqual({ w: 1500, h: 2000 })
  })
})

describe('warpPerspective', () => {
  it('recortar la foto entera la deja igual', () => {
    const w = 8, h = 6
    const src = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < w * h; i++) src.set([i * 3, 100, 200 - i, 255], i * 4)
    const full: Quad = [{ x: 0, y: 0 }, { x: w - 1, y: 0 }, { x: w - 1, y: h - 1 }, { x: 0, y: h - 1 }]
    // Salida del mismo tamaño que el recorte: cada píxel cae justo sobre el suyo.
    const ow = w - 1, oh = h - 1
    const out = warpPerspective(src, w, h, full, ow, oh)
    for (const [u, v] of [[0, 0], [3, 2], [6, 4]]) {
      const o = (v * ow + u) * 4, s0 = (v * w + u) * 4
      expect(Math.abs(out[o] - src[s0])).toBeLessThanOrEqual(1)
      expect(Math.abs(out[o + 2] - src[s0 + 2])).toBeLessThanOrEqual(1)
      expect(out[o + 3]).toBe(255)
    }
  })
})
