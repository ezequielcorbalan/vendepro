// ============================================================
// API Client — routes requests to the 8 backend microservices
// ============================================================

const APIS = {
  auth:         process.env.NEXT_PUBLIC_API_AUTH_URL         ?? 'https://auth.api.vendepro.com.ar',
  crm:          process.env.NEXT_PUBLIC_API_CRM_URL          ?? 'https://crm.api.vendepro.com.ar',
  properties:   process.env.NEXT_PUBLIC_API_PROPERTIES_URL   ?? 'https://properties.api.vendepro.com.ar',
  transactions: process.env.NEXT_PUBLIC_API_TRANSACTIONS_URL ?? 'https://transactions.api.vendepro.com.ar',
  analytics:    process.env.NEXT_PUBLIC_API_ANALYTICS_URL    ?? 'https://analytics.api.vendepro.com.ar',
  ai:           process.env.NEXT_PUBLIC_API_AI_URL           ?? 'https://ai.api.vendepro.com.ar',
  admin:        process.env.NEXT_PUBLIC_API_ADMIN_URL        ?? 'https://admin.api.vendepro.com.ar',
  public:       process.env.NEXT_PUBLIC_API_PUBLIC_URL       ?? 'https://public.api.vendepro.com.ar',
} as const

export type ApiName = keyof typeof APIS

// ── Token helpers (localStorage for client, cookie for SSR) ─
const TOKEN_KEY = 'reportes_token'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem('reportes_user')
}

// ── Fetch helper with auth header ─────────────────────────
export async function apiFetch(
  api: ApiName,
  path: string,
  options?: RequestInit
): Promise<Response> {
  const base = APIS[api]
  const url = `${base}${path}`

  const token = getToken()
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> | undefined),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // Don't override Content-Type for FormData
  if (!(options?.body instanceof FormData) && !headers['Content-Type']) {
    if (options?.body && typeof options.body === 'string') {
      headers['Content-Type'] = 'application/json'
    }
  }

  return fetch(url, { ...options, headers })
}

// ── Server-side fetch (for Server Components) ─────────────
// Uses cookie-based auth when running on server
export async function serverFetch(
  api: ApiName,
  path: string,
  cookieHeader?: string,
  options?: RequestInit
): Promise<Response> {
  const base = APIS[api]
  const url = `${base}${path}`

  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> | undefined),
  }

  if (cookieHeader) {
    headers['Cookie'] = cookieHeader
  }

  return fetch(url, { ...options, headers, cache: 'no-store' })
}
