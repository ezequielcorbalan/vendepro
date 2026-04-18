import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GroqAIService } from '../../src/services/groq-ai-service'

const makeOk = (content: string) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content } }] }),
})

const makeError = (status: number) => ({
  ok: false,
  status,
  json: async () => ({ error: 'upstream' }),
})

describe('GroqAIService.editLandingBlock', () => {
  const svc = new GroqAIService('TEST_KEY')
  beforeEach(() => { vi.restoreAllMocks() })

  it('retorna ok cuando JSON respeta el schema del bloque hero', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any).mockImplementationOnce(async () =>
      makeOk(JSON.stringify({ title: 'nuevo', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 })) as any
    )
    const res = await svc.editLandingBlock({
      blockType: 'hero',
      blockData: { title: 'viejo', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 },
      prompt: 'cambialo',
      brandVoice: 'formal',
    })
    expect(res.status).toBe('ok')
    if (res.status === 'ok') expect((res.data as any).title).toBe('nuevo')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('reintenta una vez si el primer JSON es inválido para el schema', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any)
      .mockImplementationOnce(async () => makeOk(JSON.stringify({ title: 'sin imagen' })) as any)
      .mockImplementationOnce(async () => makeOk(JSON.stringify({ title: 'nuevo', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 })) as any)
    const res = await svc.editLandingBlock({
      blockType: 'hero',
      blockData: { title: 'viejo', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 },
      prompt: 'x',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(res.status).toBe('ok')
  })

  it('retorna schema_mismatch si tras retry sigue inválido', async () => {
    vi.spyOn(globalThis, 'fetch' as any)
      .mockImplementation(async () => makeOk(JSON.stringify({ title: 'solo esto' })) as any)
    const res = await svc.editLandingBlock({ blockType: 'hero', blockData: { title: 'x', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 }, prompt: 'x' })
    expect(res.status).toBe('error')
    if (res.status === 'error') expect(res.reason).toBe('schema_mismatch')
  })

  it('retorna provider_error en 5xx', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockImplementationOnce(async () => makeError(503) as any)
    const res = await svc.editLandingBlock({ blockType: 'hero', blockData: { title: 'x', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 }, prompt: 'x' })
    expect(res.status).toBe('error')
    if (res.status === 'error') expect(res.reason).toBe('provider_error')
  })
})
