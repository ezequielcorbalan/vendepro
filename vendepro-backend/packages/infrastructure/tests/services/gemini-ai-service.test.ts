import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GeminiAIService, ageFromConstructionYear } from '../../src/services/gemini-ai-service'

const ok = (content: string) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content } }] }),
})
const fail = (status: number, body = '{"error":"upstream"}') => ({
  ok: false,
  status,
  text: async () => body,
})

const svc = () => new GeminiAIService('TEST_KEY')

beforeEach(() => vi.restoreAllMocks())

/**
 * El hallazgo del benchmark: un LLM no sabe en qué año estamos. Sobre un aviso
 * que decía "Año de construcción: 1998", 4 de 5 modelos respondieron 26 años de
 * antigüedad en vez de 28, calculando contra su corte de entrenamiento (2024).
 * En una tasación ese error entra al cálculo de valor, así que el modelo lee el
 * año y la resta la hace el sistema.
 */
describe('ageFromConstructionYear', () => {
  const en2026 = new Date('2026-09-02T12:00:00Z')

  it('calcula la antigüedad con el año REAL, no con el que crea el modelo', () => {
    expect(ageFromConstructionYear(1998, en2026)).toBe(28)
    expect(ageFromConstructionYear(2020, en2026)).toBe(6)
    expect(ageFromConstructionYear(2026, en2026)).toBe(0)
  })

  it('avanza sola con el paso del tiempo', () => {
    // Mediodía UTC a propósito: `getFullYear()` es hora LOCAL, así que un
    // 01-01T00:00Z cae en el año anterior desde Argentina (UTC-3).
    expect(ageFromConstructionYear(1998, new Date('2027-06-15T12:00:00Z'))).toBe(29)
  })

  it('devuelve null ante un año imposible, en vez de una antigüedad inventada', () => {
    expect(ageFromConstructionYear(null, en2026)).toBeNull()
    expect(ageFromConstructionYear(2030, en2026)).toBeNull() // futuro
    expect(ageFromConstructionYear(1500, en2026)).toBeNull()
    expect(ageFromConstructionYear(1998.5, en2026)).toBeNull()
  })
})

describe('GeminiAIService · guard de la API key', () => {
  it('falla al construirse con 503 distinguible si falta la key', () => {
    // Sin el guard, `undefined` se serializa como el string "undefined" en el
    // header, el request SALE igual y el proveedor devuelve 401 — que después se
    // disfraza de 500 mudo, de 401 que desloguea, o de 200 con el error adentro.
    for (const mala of ['', '   ', undefined as any, null as any]) {
      expect(() => new GeminiAIService(mala)).toThrow(/GEMINI_API_KEY/)
      try { new GeminiAIService(mala) } catch (e: any) { expect(e.statusCode).toBe(503) }
    }
  })
})

describe('GeminiAIService · extractComparableFromScreenshot', () => {
  it('convierte el año de construcción en antigüedad y sanitiza los números', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(ok(JSON.stringify({
      address: 'Juramento 2380', zonaprop_url: null,
      total_area: '132', covered_area: 118, price: null, usd_per_m2: null,
      days_on_market: 12, views_per_day: 24.08, construction_year: 1998,
    })) as any)

    const r = await svc().extractComparableFromScreenshot('YmFzZTY0', 'image/png')
    expect(r.total_area).toBe(132)          // string numérico -> número
    expect(r.price).toBeNull()
    expect(r.views_per_day).toBe(24.08)
    expect(r.age).toBe(new Date().getFullYear() - 1998)
    expect((r as any).construction_year).toBeUndefined() // no se filtra al dominio
  })

  it('rechaza un formato de imagen no soportado sin salir a la red', async () => {
    const f = vi.spyOn(globalThis, 'fetch' as any)
    await expect(svc().extractComparableFromScreenshot('x', 'image/tiff')).rejects.toThrow(/no soportado/)
    expect(f).not.toHaveBeenCalled()
  })

  it('acepta image/jpg como alias de image/jpeg', async () => {
    const f = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(ok('{}') as any)
    await svc().extractComparableFromScreenshot('YmFzZTY0', 'image/jpg')
    const body = JSON.parse((f.mock.calls[0]![1] as any).body)
    expect(body.messages[0].content[0].image_url.url).toContain('data:image/jpeg;base64,')
  })

  it('propaga el mimeType real y no lo fuerza a PNG', async () => {
    const f = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(ok('{}') as any)
    await svc().extractComparableFromScreenshot('YmFzZTY0', 'image/webp')
    const body = JSON.parse((f.mock.calls[0]![1] as any).body)
    expect(body.messages[0].content[0].image_url.url).toContain('data:image/webp;base64,')
  })
})

describe('GeminiAIService · traducción de errores del proveedor', () => {
  it('un 401 del proveedor NO sale como 401 — desloguearía al usuario', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(fail(401, 'invalid api key') as any)
    await expect(svc().extractLeadIntent('hola')).rejects.toMatchObject({ statusCode: 502 })
  })

  it('propaga 413 tal cual: es un problema del input del usuario', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(fail(413) as any)
    await expect(svc().extractLeadIntent('hola')).rejects.toMatchObject({ statusCode: 413 })
  })
})

describe('GeminiAIService · editLandingBlock', () => {
  it('distingue el timeout del resto, en vez de llamarlo provider_error', async () => {
    // `reason: 'timeout'` estaba declarado en el union y NUNCA se emitía: el
    // AbortError caía en el catch genérico. Cualquiera que midiera timeouts
    // filtrando por esa razón contaba cero para siempre.
    vi.spyOn(globalThis, 'fetch' as any).mockRejectedValue(
      Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
    )
    const r = await svc().editLandingBlock({
      blockType: 'hero', blockData: { title: 'x' }, prompt: 'mejoralo',
    } as any)
    expect(r).toMatchObject({ status: 'error', reason: 'timeout' })
  })

  it('un fallo del proveedor sigue saliendo como provider_error', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(fail(500) as any)
    const r = await svc().editLandingBlock({
      blockType: 'hero', blockData: { title: 'x' }, prompt: 'mejoralo',
    } as any)
    expect(r).toMatchObject({ status: 'error', reason: 'provider_error' })
  })
})
