import { describe, it, expect } from 'vitest'
import { HmacUnsubscribeTokenSigner } from '../../src/services/unsubscribe-token-signer-impl'

describe('HmacUnsubscribeTokenSigner', () => {
  const signer = new HmacUnsubscribeTokenSigner('super-secret')

  it('firma y verifica round-trip', async () => {
    const token = await signer.sign({ orgId: 'org_mg', email: 'Cliente@Test.com' })
    const payload = await signer.verify(token)
    expect(payload).toEqual({ orgId: 'org_mg', email: 'cliente@test.com' })
  })

  it('el token es URL-safe (sin ., +, /, = extra)', async () => {
    const token = await signer.sign({ orgId: 'org_mg', email: 'a@b.com' })
    // Formato payload.firma — exactamente un separador
    expect(token.split('.')).toHaveLength(2)
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
  })

  it('rechaza token con firma adulterada', async () => {
    const token = await signer.sign({ orgId: 'org_mg', email: 'a@b.com' })
    const [payload, sig] = token.split('.')
    const tampered = `${payload}.${sig!.slice(0, -2)}xx`
    expect(await signer.verify(tampered)).toBeNull()
  })

  it('rechaza payload adulterado (org ajena)', async () => {
    const token = await signer.sign({ orgId: 'org_mg', email: 'a@b.com' })
    const [, sig] = token.split('.')
    const fake = btoa(JSON.stringify({ o: 'org_otra', e: 'a@b.com' }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
    expect(await signer.verify(`${fake}.${sig}`)).toBeNull()
  })

  it('rechaza token firmado con otro secreto', async () => {
    const other = new HmacUnsubscribeTokenSigner('otro-secreto')
    const token = await other.sign({ orgId: 'org_mg', email: 'a@b.com' })
    expect(await signer.verify(token)).toBeNull()
  })

  it('rechaza basura sin explotar', async () => {
    expect(await signer.verify('')).toBeNull()
    expect(await signer.verify('no-token')).toBeNull()
    expect(await signer.verify('a.b.c')).toBeNull()
    expect(await signer.verify('!!!.???')).toBeNull()
  })
})
