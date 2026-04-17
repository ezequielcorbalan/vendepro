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
    expect(ai.extractMetricsFromScreenshot).toHaveBeenCalledWith('base64data')
    expect(result).toEqual({ views: 250, inquiries: 3 })
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
