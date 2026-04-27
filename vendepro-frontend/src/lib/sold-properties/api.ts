// Client helper para la API de propiedades vendidas (cierres reales).

import { apiFetch } from '@/lib/api'

export interface SoldProperty {
  id: string
  org_id: string
  property_type: string
  neighborhood: string | null
  address_approx: string | null
  covered_area: number | null
  total_area: number | null
  semi_area: number | null
  rooms: number | null
  bedrooms: number | null
  bathrooms: number | null
  parking: number | null
  listing_price_usd: number | null
  closing_price_usd: number | null
  closed_at: string | null
  notes: string | null
  agent_id: string | null
  external_agent_name: string | null
  external_agency: string | null
  photos: string[]
  shared_with_network: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  // calculados por el backend
  origin: 'mine' | 'team' | 'external'
  usd_per_m2: number | null
}

export interface SoldPropertyFilters {
  origin?: 'mine' | 'team' | 'external' | 'all'
  property_type?: string
  neighborhood?: string
  min_covered_area?: number
  max_covered_area?: number
  closed_after?: string
  closed_before?: string
  search?: string
  limit?: number
  offset?: number
}

function qs(filters: SoldPropertyFilters): string {
  const sp = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  })
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export async function listSoldProperties(filters: SoldPropertyFilters = {}): Promise<SoldProperty[]> {
  const res = await apiFetch('properties', `/sold-properties${qs(filters)}`)
  if (!res.ok) return []
  const data = (await res.json()) as any
  return Array.isArray(data) ? data : []
}

export async function getSoldProperty(id: string): Promise<SoldProperty | null> {
  const res = await apiFetch('properties', `/sold-properties/${id}`)
  if (!res.ok) return null
  return (await res.json()) as SoldProperty
}

export async function createSoldProperty(input: Partial<SoldProperty>): Promise<{ id: string } | null> {
  const res = await apiFetch('properties', '/sold-properties', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.ok) return null
  return (await res.json()) as { id: string }
}

export async function updateSoldProperty(id: string, input: Partial<SoldProperty>): Promise<boolean> {
  const res = await apiFetch('properties', `/sold-properties/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  return res.ok
}

export async function deleteSoldProperty(id: string): Promise<boolean> {
  const res = await apiFetch('properties', `/sold-properties/${id}`, { method: 'DELETE' })
  return res.ok
}

export async function uploadPhotoToR2(file: File): Promise<string | null> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await apiFetch('properties', '/upload-photo', { method: 'POST', body: fd })
  if (!res.ok) return null
  const data = (await res.json()) as any
  return data.url ?? null
}

export const PROPERTY_TYPES = [
  { value: 'departamento', label: 'Departamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'ph', label: 'PH' },
  { value: 'lote', label: 'Lote' },
  { value: 'galpon', label: 'Galpón' },
  { value: 'oficina', label: 'Oficina' },
  { value: 'local', label: 'Local' },
  { value: 'campo', label: 'Campo' },
  { value: 'otro', label: 'Otro' },
] as const
