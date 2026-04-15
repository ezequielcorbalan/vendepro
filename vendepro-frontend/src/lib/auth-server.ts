import { cookies } from 'next/headers'
import type { CurrentUser } from './auth'

/**
 * Server-side getCurrentUser — reads the vendepro_token JWT cookie.
 * Only call this in Server Components or Route Handlers (not in client code).
 */
export async function getCurrentUserServer(): Promise<CurrentUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('vendepro_token')?.value
  if (!token) return null

  try {
    // Decode JWT payload (base64url → JSON)
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
    )
    return {
      id: payload.sub ?? '',
      email: payload.email ?? '',
      full_name: payload.full_name ?? payload.name ?? '',
      name: payload.name ?? payload.full_name ?? '',
      role: payload.role ?? 'agent',
      org_id: payload.org_id ?? '',
    }
  } catch {
    return null
  }
}
