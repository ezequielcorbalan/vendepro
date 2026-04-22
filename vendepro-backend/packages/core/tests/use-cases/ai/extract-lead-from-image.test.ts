import { describe, it, expect, vi } from 'vitest'
import { ExtractLeadFromImageUseCase } from '../../../src/application/use-cases/ai/extract-lead-from-image'

describe('ExtractLeadFromImageUseCase', () => {
  const makeAi = (result = { full_name: 'Marcos' }) => ({
    extractLeadIntent: vi.fn(),
    extractLeadFromImage: vi.fn().mockResolvedValue(result),
    transcribeAudio: vi.fn(),
    extractMetricsFromScreenshot: vi.fn(),
    editLandingBlock: vi.fn(),
    editLandingGlobal: vi.fn(),
  })

  it('forwards base64 + mimeType to AIService and returns the intent', async () => {
    const ai = makeAi({ full_name: 'Marcos García', neighborhood: 'Palermo' })
    const uc = new ExtractLeadFromImageUseCase(ai as any)
    const result = await uc.execute({ imageBase64: 'abc123==', mimeType: 'image/png' })
    expect(ai.extractLeadFromImage).toHaveBeenCalledWith('abc123==', 'image/png')
    expect(result).toEqual({ full_name: 'Marcos García', neighborhood: 'Palermo' })
  })

  it('defaults mimeType to image/jpeg when not provided', async () => {
    const ai = makeAi()
    const uc = new ExtractLeadFromImageUseCase(ai as any)
    await uc.execute({ imageBase64: 'xyz' })
    expect(ai.extractLeadFromImage).toHaveBeenCalledWith('xyz', 'image/jpeg')
  })

  it('throws 400 when imageBase64 is empty', async () => {
    const ai = makeAi()
    const uc = new ExtractLeadFromImageUseCase(ai as any)
    await expect(uc.execute({ imageBase64: '' })).rejects.toMatchObject({
      message: 'imageBase64 is required',
      statusCode: 400,
    })
    expect(ai.extractLeadFromImage).not.toHaveBeenCalled()
  })

  it('throws 413 when base64 exceeds 8 MB', async () => {
    const ai = makeAi()
    const uc = new ExtractLeadFromImageUseCase(ai as any)
    const huge = 'A'.repeat(8 * 1024 * 1024 + 1)
    await expect(uc.execute({ imageBase64: huge })).rejects.toMatchObject({ statusCode: 413 })
    expect(ai.extractLeadFromImage).not.toHaveBeenCalled()
  })

  it('rejects non-image mimeType', async () => {
    const ai = makeAi()
    const uc = new ExtractLeadFromImageUseCase(ai as any)
    await expect(
      uc.execute({ imageBase64: 'abc', mimeType: 'application/pdf' }),
    ).rejects.toMatchObject({ statusCode: 400 })
    expect(ai.extractLeadFromImage).not.toHaveBeenCalled()
  })
})
