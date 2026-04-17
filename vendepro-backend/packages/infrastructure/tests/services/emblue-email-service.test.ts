import { describe, it, expect, vi, afterEach } from 'vitest'
import { EmBlueEmailService } from '../../src/services/emblue-email-service'

describe('EmBlueEmailService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends a POST to the emBlue v2.3 send endpoint with auth header and wrapped recipient', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 }),
    )

    const svc = new EmBlueEmailService('test-api-key')
    await svc.send({
      from: { email: 'noreply@vendepro.com.ar', name: 'VendéPro CRM' },
      to: { email: 'user@example.com', name: 'Jane User' },
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: 'Hi',
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://api.embluemail.com/v2.3/send')
    expect(init?.method).toBe('POST')

    const headers = init?.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer test-api-key')
    expect(headers['Content-Type']).toBe('application/json')

    const parsedBody = JSON.parse(init?.body as string)
    expect(parsedBody.from).toEqual({ email: 'noreply@vendepro.com.ar', name: 'VendéPro CRM' })
    expect(parsedBody.to).toEqual([{ email: 'user@example.com', name: 'Jane User' }])
    expect(parsedBody.subject).toBe('Hello')
    expect(parsedBody.html).toBe('<p>Hi</p>')
    expect(parsedBody.text).toBe('Hi')
  })

  it('throws when the emBlue API returns a non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('error', { status: 500 }),
    )

    const svc = new EmBlueEmailService('test-api-key')
    await expect(
      svc.send({
        from: { email: 'noreply@vendepro.com.ar', name: 'VendéPro CRM' },
        to: { email: 'user@example.com', name: 'Jane User' },
        subject: 's',
        html: 'h',
        text: 't',
      }),
    ).rejects.toThrow(/emBlue send failed: 500/)
  })
})
