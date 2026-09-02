import { describe, it, expect, vi, afterEach } from 'vitest'
import { ResendEmailService } from '../../src/services/resend-email-service'

const baseInput = {
  from: { email: 'hola@mg.com', name: 'Marcela Genta' },
  to: { email: 'user@inmobiliaria.com.ar', name: 'Jane User' },
  subject: 'Hello',
  html: '<p>Hi</p>',
  text: 'Hi',
}

describe('ResendEmailService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('envía POST a /emails con auth, direcciones formateadas y reply_to/tags', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"id":"re_1"}', { status: 200 }),
    )

    const svc = new ResendEmailService('re_test_key')
    await svc.send({
      ...baseInput,
      replyTo: 'respuestas@mg.com',
      tags: { kind: 'test', campaign_id: 'c1' },
      idempotencyKey: 'idem-123',
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init?.method).toBe('POST')

    const headers = init?.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer re_test_key')
    expect(headers['Idempotency-Key']).toBe('idem-123')

    const body = JSON.parse(init?.body as string)
    expect(body.from).toBe('Marcela Genta <hola@mg.com>')
    expect(body.to).toEqual(['Jane User <user@inmobiliaria.com.ar>'])
    expect(body.reply_to).toBe('respuestas@mg.com')
    expect(body.tags).toEqual([
      { name: 'kind', value: 'test' },
      { name: 'campaign_id', value: 'c1' },
    ])
  })

  it('omite reply_to/tags/Idempotency-Key cuando no se pasan', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"id":"re_1"}', { status: 200 }),
    )
    const svc = new ResendEmailService('re_test_key')
    await svc.send(baseInput)

    const [, init] = fetchSpy.mock.calls[0]
    const headers = init?.headers as Record<string, string>
    expect(headers['Idempotency-Key']).toBeUndefined()
    const body = JSON.parse(init?.body as string)
    expect(body).not.toHaveProperty('reply_to')
    expect(body).not.toHaveProperty('tags')
  })

  it('incluye el mensaje de error del body en el throw', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"message":"Domain is not verified"}', { status: 403 }),
    )
    const svc = new ResendEmailService('re_test_key')
    await expect(svc.send(baseInput)).rejects.toThrow(/Resend send failed: 403 Domain is not verified/)
  })

  it('sendBatch manda un array a /emails/batch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"data":[]}', { status: 200 }),
    )
    const svc = new ResendEmailService('re_test_key')
    await svc.sendBatch([baseInput, { ...baseInput, to: { email: 'otro@inmobiliaria.com.ar', name: '' } }])

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails/batch')
    const body = JSON.parse(init?.body as string)
    expect(body).toHaveLength(2)
    expect(body[1].to).toEqual(['otro@inmobiliaria.com.ar']) // sin nombre → email pelado
  })

  it('sendBatch con lista vacía no llama a la API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const svc = new ResendEmailService('re_test_key')
    await svc.sendBatch([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('sendBatch rechaza más de 100 emails', async () => {
    const svc = new ResendEmailService('re_test_key')
    const inputs = Array.from({ length: 101 }, () => baseInput)
    await expect(svc.sendBatch(inputs)).rejects.toThrow(/hasta 100/)
  })

  /**
   * Guard de entregabilidad. `example.com` (RFC 2606) y `.local` (RFC 6762) son
   * dominios reservados: no existen en el DNS y rebotan duro. El smoke de
   * produccion creaba ~15 leads por corrida con direcciones @test.local, y crear
   * un lead dispara automatizaciones (api-crm:167), asi que cada deploy mandaba
   * una tanda de emails imposibles de entregar — quemando cuota y, peor,
   * reputacion de remitente.
   */
  it('NO sale a la red con un dominio reservado, y no rompe al llamador', async () => {
    const f = vi.spyOn(globalThis, 'fetch' as any)
    const svc = new ResendEmailService('re_test_key')
    await expect(
      svc.send({ ...baseInput, to: { email: 'smoke-a1-xyz@test.local', name: 'Smoke' } }),
    ).resolves.toBeUndefined()
    expect(f).not.toHaveBeenCalled()
  })

  it('sendBatch filtra los reservados y manda el resto', async () => {
    const f = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      { ok: true, status: 200, json: async () => ({}) } as any,
    )
    const svc = new ResendEmailService('re_test_key')
    await svc.sendBatch([
      baseInput,
      { ...baseInput, to: { email: 'smoke@test.local', name: '' } },
      { ...baseInput, to: { email: 'x@example.com', name: '' } },
    ])
    const body = JSON.parse((f.mock.calls[0]![1] as any).body)
    expect(body).toHaveLength(1)
    expect(body[0].to).toEqual(['Jane User <user@inmobiliaria.com.ar>'])
  })

  it('sendBatch no llama a la red si TODOS son reservados', async () => {
    const f = vi.spyOn(globalThis, 'fetch' as any)
    const svc = new ResendEmailService('re_test_key')
    await svc.sendBatch([{ ...baseInput, to: { email: 'a@test.local', name: '' } }])
    expect(f).not.toHaveBeenCalled()
  })

})
