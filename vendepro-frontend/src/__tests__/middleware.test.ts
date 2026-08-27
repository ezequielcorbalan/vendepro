import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '../middleware'

const BASE = 'https://app.vendepro.com.ar'

/** JWT de mentira: solo el payload importa, el middleware no verifica la firma. */
function jwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.firma-irrelevante`
}

const HOUR = 3600
const now = () => Math.floor(Date.now() / 1000)
const TOKEN_VIGENTE = jwt({ sub: 'user-1', exp: now() + HOUR })
const TOKEN_VENCIDO = jwt({ sub: 'user-1', exp: now() - HOUR })
const TOKEN_SIN_EXP = jwt({ sub: 'integracion-1' })

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

describe('middleware — /login con sesión activa', () => {
  it('manda al dashboard si el token sigue vigente', () => {
    expect(redirectTo('/login', { token: TOKEN_VIGENTE })).toContain('/dashboard')
  })

  it('deja ver el login si no hay token', () => {
    expect(redirectTo('/login')).toBeNull()
  })

  // Sin esto, un token vencido mandaría al dashboard, la primera llamada daría
  // 401 y el usuario volvería al login: un rebote inútil en vez del formulario.
  it('deja ver el login si el token está vencido', () => {
    expect(redirectTo('/login', { token: TOKEN_VENCIDO })).toBeNull()
  })

  it('deja ver el login si la cookie no es un JWT', () => {
    expect(redirectTo('/login', { token: 'no-es-un-jwt' })).toBeNull()
  })

  it('trata como vigente un token sin exp (integración)', () => {
    expect(redirectTo('/login', { token: TOKEN_SIN_EXP })).toContain('/dashboard')
  })

  it('no toca /forgot-password aunque haya sesión', () => {
    expect(redirectTo('/forgot-password', { token: TOKEN_VIGENTE })).toBeNull()
  })
})
