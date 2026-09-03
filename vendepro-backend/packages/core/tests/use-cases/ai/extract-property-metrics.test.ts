import { describe, it, expect, vi } from 'vitest'
import { ExtractPropertyMetricsUseCase } from '../../../src/application/use-cases/ai/extract-property-metrics'

describe('ExtractPropertyMetricsUseCase', () => {
  const makeAi = (result: Record<string, unknown> = { views: 100 }) => ({
    extractLeadIntent: vi.fn(),
    transcribeAudio: vi.fn(),
    extractMetricsFromScreenshot: vi.fn().mockResolvedValue(result),
  })

  it('calls AIService.extractMetricsFromScreenshot with the image and returns metrics', async () => {
    const ai = makeAi({ views: 250, inquiries: 3 })
    const useCase = new ExtractPropertyMetricsUseCase(ai as any)
    const result = await useCase.execute({ imageBase64: 'base64data' })
    expect(ai.extractMetricsFromScreenshot).toHaveBeenCalledWith('base64data', undefined)
    expect(result).toEqual({ views: 250, inquiries: 3 })
  })

  /**
   * El mimeType tiene que LLEGAR al servicio. Antes el use case no lo aceptaba,
   * así que el adapter declaraba toda imagen como `image/png` y un screenshot
   * JPEG —lo que sale de la mayoría de las herramientas de captura— rebotaba
   * con 400 en el proveedor por mismatch de media type.
   */
  it('propaga el mimeType al servicio', async () => {
    const ai = makeAi()
    const useCase = new ExtractPropertyMetricsUseCase(ai as any)
    await useCase.execute({ imageBase64: 'base64data', mimeType: 'image/jpeg' })
    expect(ai.extractMetricsFromScreenshot).toHaveBeenCalledWith('base64data', 'image/jpeg')
  })

  it('throws when imageBase64 is empty', async () => {
    const ai = makeAi()
    const useCase = new ExtractPropertyMetricsUseCase(ai as any)
    await expect(useCase.execute({ imageBase64: '' })).rejects.toThrow('imageBase64 is required')
    expect(ai.extractMetricsFromScreenshot).not.toHaveBeenCalled()
  })

  it('throws when imageBase64 is whitespace only', async () => {
    const ai = makeAi()
    const useCase = new ExtractPropertyMetricsUseCase(ai as any)
    await expect(useCase.execute({ imageBase64: '   ' })).rejects.toThrow('imageBase64 is required')
  })
})
