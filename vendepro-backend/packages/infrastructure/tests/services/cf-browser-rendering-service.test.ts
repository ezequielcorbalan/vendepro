import { describe, it, expect, vi } from 'vitest'
import { CfBrowserRenderingService } from '../../src/services/cf-browser-rendering-service'
import { RenderTimeoutError } from '@vendepro/core'

vi.mock('@cloudflare/puppeteer', () => {
  return {
    default: {
      launch: vi.fn(),
    },
  }
})

describe('CfBrowserRenderingService', () => {
  it('returns bytes on happy path', async () => {
    const puppeteer = (await import('@cloudflare/puppeteer')).default as any
    const page = { goto: vi.fn().mockResolvedValue(undefined), pdf: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])) }
    const browser = { newPage: vi.fn().mockResolvedValue(page), close: vi.fn().mockResolvedValue(undefined) }
    puppeteer.launch.mockResolvedValue(browser)

    const svc = new CfBrowserRenderingService({} as any)
    const bytes = await svc.renderPdf('https://example.test', { format: 'A4' })
    expect(bytes).toEqual(new Uint8Array([1, 2, 3]))
    expect(page.goto).toHaveBeenCalledWith('https://example.test', expect.objectContaining({ timeout: 30000 }))
  })

  it('maps timeout error to RenderTimeoutError', async () => {
    const puppeteer = (await import('@cloudflare/puppeteer')).default as any
    const page = { goto: vi.fn().mockRejectedValue(new Error('Navigation timeout exceeded')) }
    const browser = { newPage: vi.fn().mockResolvedValue(page), close: vi.fn().mockResolvedValue(undefined) }
    puppeteer.launch.mockResolvedValue(browser)

    const svc = new CfBrowserRenderingService({} as any)
    await expect(svc.renderPdf('https://example.test')).rejects.toBeInstanceOf(RenderTimeoutError)
  })
})
