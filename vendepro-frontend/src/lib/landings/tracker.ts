// Tracker client-only. No tocar en SSR.

const VISITOR_COOKIE = 'vendepro_lvid'
const SESSION_STORAGE_KEY = 'vendepro_lsid'
const VISITOR_TTL_DAYS = 30

function uuid(): string {
  return crypto.randomUUID()
}

export function getOrCreateVisitorId(): string | null {
  if (typeof window === 'undefined') return null
  const existing = readCookie(VISITOR_COOKIE)
  if (existing) return existing
  const id = uuid()
  setCookie(VISITOR_COOKIE, id, VISITOR_TTL_DAYS)
  return id
}

export function getOrCreateSessionId(): string | null {
  if (typeof window === 'undefined') return null
  const existing = sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (existing) return existing
  const id = uuid()
  sessionStorage.setItem(SESSION_STORAGE_KEY, id)
  return id
}

export function readUtmFromUrl(): { source?: string | null; medium?: string | null; campaign?: string | null; referrer?: string | null } {
  if (typeof window === 'undefined') return {}
  const q = new URLSearchParams(window.location.search)
  return {
    source: q.get('utm_source'),
    medium: q.get('utm_medium'),
    campaign: q.get('utm_campaign'),
    referrer: document.referrer || null,
  }
}

function readCookie(name: string): string | null {
  const parts = document.cookie.split('; ')
  for (const p of parts) {
    const [k, v] = p.split('=')
    if (k === name) return decodeURIComponent(v ?? '')
  }
  return null
}

function setCookie(name: string, value: string, days: number): void {
  const exp = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax; Secure`
}
