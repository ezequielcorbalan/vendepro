import { describe, it, expect } from 'vitest'
import { mapProviderStatus, providerError } from '../../src/services/provider-error'

/**
 * El test que importa es el primero: 401 y 403 NO pueden salir hacia el frontend.
 * `apiFetch` (frontend/src/lib/api.ts) hace `clearToken()` + redirect a /login
 * ante cualquier 401, así que propagar el 401 del proveedor desloguea al usuario
 * y le borra el trabajo sin guardar. Pasó en producción el 2026-09-02.
 */
describe('mapProviderStatus', () => {
  it('NUNCA devuelve 401 ni 403, para ningún status de entrada', () => {
    for (let status = 100; status <= 599; status++) {
      const out = mapProviderStatus(status)
      expect(out, `status ${status} del proveedor se convirtió en ${out}`).not.toBe(401)
      expect(out, `status ${status} del proveedor se convirtió en ${out}`).not.toBe(403)
    }
  })

  it('401 y 403 del proveedor salen como 502 — es problema nuestro, no del usuario', () => {
    expect(mapProviderStatus(401)).toBe(502)
    expect(mapProviderStatus(403)).toBe(502)
  })

  it('propaga los 4xx que describen el input del usuario', () => {
    expect(mapProviderStatus(400)).toBe(400) // imagen inválida
    expect(mapProviderStatus(413)).toBe(413) // imagen demasiado grande
    expect(mapProviderStatus(415)).toBe(415) // formato no soportado
    expect(mapProviderStatus(422)).toBe(422)
  })

  it('propaga 429 para que el usuario sepa que puede reintentar', () => {
    expect(mapProviderStatus(429)).toBe(429)
  })

  it('colapsa 5xx y el resto de 4xx a 502', () => {
    expect(mapProviderStatus(404)).toBe(502)
    expect(mapProviderStatus(500)).toBe(502)
    expect(mapProviderStatus(503)).toBe(502)
  })
})

describe('providerError', () => {
  it('adjunta el cuerpo del proveedor al mensaje, para poder diagnosticar', () => {
    const err = providerError(401, '{"error":{"message":"invalid x-api-key"}}', {
      provider: 'anthropic',
    })
    expect(err.statusCode).toBe(502)
    expect(err.message).toContain('anthropic 401')
    expect(err.message).toContain('invalid x-api-key')
  })

  it('con un fallo del input usa el mensaje accionable que le pasan', () => {
    const err = providerError(400, 'bad image', {
      provider: 'anthropic',
      inputMessage: 'Probá con otra captura.',
    })
    expect(err.statusCode).toBe(400)
    expect(err.message).toContain('Probá con otra captura.')
  })

  it('no filtra el cuerpo crudo del proveedor al usuario como único mensaje', () => {
    // El mensaje SIEMPRE arranca con texto nuestro en castellano; el cuerpo del
    // proveedor va entre corchetes al final.
    const err = providerError(500, 'upstream exploded', { provider: 'groq' })
    expect(err.message.startsWith('El servicio de IA no está disponible')).toBe(true)
  })

  it('recorta cuerpos largos para no inflar los logs', () => {
    const err = providerError(500, 'x'.repeat(5000), { provider: 'groq' })
    expect(err.message.length).toBeLessThan(500)
  })
})
