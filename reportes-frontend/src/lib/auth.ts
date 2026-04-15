// ============================================================
// Auth helpers — client-side session management
// ============================================================

export interface CurrentUser {
  id: string
  email: string
  full_name: string
  name: string        // alias for full_name
  role: string
  org_id: string
  phone?: string | null
  photo_url?: string | null
}

const USER_KEY = 'reportes_user'

export function getCurrentUser(): CurrentUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CurrentUser
  } catch {
    return null
  }
}

export function setCurrentUser(user: CurrentUser): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function logout(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem('reportes_token')
}
