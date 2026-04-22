import { describe, it, expect, vi } from 'vitest'
import { ExtractLeadFromTextUseCase } from '../../../src/application/use-cases/ai/extract-lead-from-text'

describe('ExtractLeadFromTextUseCase', () => {
  const makeAi = (result = { full_name: 'Laura' }) => ({
    extractLeadIntent: vi.fn().mockResolvedValue(result),
    extractLeadFromImage: vi.fn(),
    transcribeAudio: vi.fn(),
    extractMetricsFromScreenshot: vi.fn(),
    editLandingBlock: vi.fn(),
    editLandingGlobal: vi.fn(),
  })

  it('forwards trimmed text to AIService and returns the intent', async () => {
    const ai = makeAi({ full_name: 'Laura Pérez', phone: '11-5534-2210' })
    const uc = new ExtractLeadFromTextUseCase(ai as any)
    const result = await uc.execute({ text: '  Hola, soy Laura Pérez  ' })
    expect(ai.extractLeadIntent).toHaveBeenCalledWith('Hola, soy Laura Pérez')
    expect(result).toEqual({ full_name: 'Laura Pérez', phone: '11-5534-2210' })
  })

  it('throws 400 when text is empty', async () => {
    const ai = makeAi()
    const uc = new ExtractLeadFromTextUseCase(ai as any)
    await expect(uc.execute({ text: '' })).rejects.toMatchObject({ message: 'text is required', statusCode: 400 })
    expect(ai.extractLeadIntent).not.toHaveBeenCalled()
  })

  it('throws 400 when text is whitespace only', async () => {
    const ai = makeAi()
    const uc = new ExtractLeadFromTextUseCase(ai as any)
    await expect(uc.execute({ text: '   \n\t ' })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 413 when text exceeds max length', async () => {
    const ai = makeAi()
    const uc = new ExtractLeadFromTextUseCase(ai as any)
    const huge = 'a'.repeat(9_000)
    await expect(uc.execute({ text: huge })).rejects.toMatchObject({ statusCode: 413 })
    expect(ai.extractLeadIntent).not.toHaveBeenCalled()
  })
})
