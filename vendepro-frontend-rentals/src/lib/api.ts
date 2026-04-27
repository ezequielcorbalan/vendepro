import { API_BASE } from './constants'
import { getAuthHeaders } from './auth'
import { mockFetch } from './mock-data'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

export async function apiFetch(path: string, options: RequestInit = {}) {
  if (USE_MOCK && (!options.method || options.method === 'GET')) {
    const data = mockFetch(path)
    if (data !== null) return data
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...(options.headers as Record<string, string> || {}),
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const err = (await res.json()) as any
    throw new Error(err.error || `HTTP ${res.status}`)
  }

  return (await res.json()) as any
}
