import { cookies } from 'next/headers'
import { getDB, generateId } from './db'
import type { Profile } from './types'

const SESSION_COOKIE = 'reportes_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days
const HMAC_SECRET = 'reportes-mg-session-hmac-2026'

// HMAC-SHA256 signed session token
async function hmacSign(payload: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(HMAC_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hmacVerify(payload: string, signature: string): Promise<boolean> {
  const expected = await hmacSign(payload)
  return expected === signature
}

async function encodeSession(userId: string): Promise<string> {
  const payload = JSON.stringify({ uid: userId, exp: Date.now() + SESSION_MAX_AGE * 1000 })
  const b64 = btoa(payload)
  const sig = await hmacSign(b64)
  return `${b64}.${sig}`
}

async function decodeSession(token: string): Promise<{ uid: string; exp: number } | null> {
  try {
    // Support both old (unsigned) and new (signed) tokens
    const dotIdx = token.indexOf('.')
    if (dotIdx > 0) {
      // New signed format: base64.hmac
      const b64 = token.substring(0, dotIdx)
      const sig = token.substring(dotIdx + 1)
      if (!await hmacVerify(b64, sig)) return null
      const payload = JSON.parse(atob(b64))
      if (payload.exp < Date.now()) return null
      return payload
    }
    // Legacy unsigned format (backwards compatible, will be replaced on next login)
    const payload = JSON.parse(atob(token))
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'reportes-mg-salt-2026')
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function login(email: string, password: string): Promise<Profile | null> {
  const db = await getDB()
  const hash = await hashPassword(password)

  const user = await db.prepare(
    'SELECT id, email, full_name, phone, photo_url, role, org_id, created_at FROM users WHERE email = ? AND password_hash = ?'
  ).bind(email.toLowerCase(), hash).first<Profile>()

  if (!user) return null

  // Set session cookie
  const token = await encodeSession(user.id)
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })

  return user
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function getCurrentUser(): Promise<Profile | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    if (!token) return null

    const session = await decodeSession(token)
    if (!session) return null

    const db = await getDB()
    const user = await db.prepare(
      'SELECT id, email, full_name, phone, photo_url, role, org_id, created_at FROM users WHERE id = ?'
    ).bind(session.uid).first<Profile>()

    return user || null
  } catch {
    return null
  }
}

export async function createUser(
  email: string,
  password: string,
  fullName: string,
  role: 'admin' | 'supervisor' | 'agent' = 'agent',
  phone?: string
): Promise<{ id: string } | { error: string }> {
  const db = await getDB()
  const id = generateId()
  const hash = await hashPassword(password)

  try {
    await db.prepare(
      'INSERT INTO users (id, email, password_hash, full_name, phone, role) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, email.toLowerCase(), hash, fullName, phone || null, role).run()

    return { id }
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return { error: 'Ya existe un usuario con ese email' }
    }
    return { error: err.message || 'Error al crear usuario' }
  }
}
