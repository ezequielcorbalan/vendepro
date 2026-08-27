import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '../middleware'

const BASE = 'https://app.vendepro.com.ar'

function request(path: string, opts?: { token?: string }) {
  const req = new NextRequest(new URL(path, BASE))
  if (opts?.token) req.cookies.set('vendepro_token', opts.token)
  return req
}

/** Location del redirect, o null si el middleware dejó pasar. */
function redirectTo(path: string, opts?: { token?: string }): string | null {
  const res = middleware(request(path, opts))
  const location = res.headers.get('location')
  return res.status >= 300 && res.status < 400 && location ? location : null
}

describe('middleware — rutas de recuperación de contraseña', () => {
  // El usuario que recupera la contraseña por definición no tiene sesión. Antes
  // estas rutas no estaban en PUBLIC_PATHS: el middleware lo mandaba a /login y
  // el redirect descartaba el ?token= del email, dejando el flujo inservible.
  it('deja pasar /forgot-password sin sesión', () => {
    expect(redirectTo('/forgot-password')).toBeNull()
  })

  it('deja pasar /reset-password sin sesión, conservando el token', () => {
    expect(redirectTo('/reset-password?token=abc123')).toBeNull()
  })

  it('sigue protegiendo una ruta privada sin sesión', () => {
    expect(redirectTo('/leads')).toContain('/login')
  })

  it('deja pasar una ruta privada con sesión', () => {
    expect(redirectTo('/leads', { token: 'jwt-de-prueba' })).toBeNull()
  })
})
