'use client'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('vendepro_token')
}

export function setToken(token: string) {
  localStorage.setItem('vendepro_token', token)
}

export function removeToken() {
  localStorage.removeItem('vendepro_token')
}

export function getAuthHeaders(): Record<string, string> {
  const token = getToken()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}
