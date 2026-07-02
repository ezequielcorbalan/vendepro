// ============================================================
// Tasaciones API wrappers
// Alineados con las rutas reales del backend:
//   - admin API: /appraisal-templates, /org-variables
//   - properties API: /appraisals (query ?id=), /appraisals/publish, /appraisals/comparables
// ============================================================

import { apiFetch } from '@/lib/api'

// ── Templates (admin API) ─────────────────────────────────

export async function listTemplates(params?: { active?: boolean; kind?: string }): Promise<any[]> {
  const qs = new URLSearchParams()
  if (params?.active !== undefined) qs.set('active', params.active ? '1' : '0')
  if (params?.kind) qs.set('kind', params.kind)
  const query = qs.size ? `?${qs}` : ''
  const r = await apiFetch('admin', `/appraisal-templates${query}`)
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    throw new Error(err?.error ?? `HTTP ${r.status}`)
  }
  return (await r.json()) as any
}

export async function getTemplate(id: string): Promise<any> {
  const r = await apiFetch('admin', `/appraisal-templates/${id}`)
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    throw new Error(err?.error ?? `HTTP ${r.status}`)
  }
  return (await r.json()) as any
}

export async function createTemplate(body: any): Promise<any> {
  const r = await apiFetch('admin', `/appraisal-templates`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    const e = new Error(err?.error ?? `HTTP ${r.status}`) as any
    e.details = err?.details
    throw e
  }
  return (await r.json()) as any
}

export async function updateTemplate(id: string, body: any): Promise<any> {
  const r = await apiFetch('admin', `/appraisal-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    const e = new Error(err?.error ?? `HTTP ${r.status}`) as any
    e.details = err?.details
    throw e
  }
  return (await r.json()) as any
}

export async function duplicateTemplate(id: string, body?: { new_name?: string }): Promise<{ id: string }> {
  const r = await apiFetch('admin', `/appraisal-templates/${id}/duplicate`, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    throw new Error(err?.error ?? `HTTP ${r.status}`)
  }
  return (await r.json()) as any
}

// Archive = DELETE en la API admin (archiva, no borra físico).
export async function archiveTemplate(id: string): Promise<any> {
  const r = await apiFetch('admin', `/appraisal-templates/${id}`, {
    method: 'DELETE',
  })
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    throw new Error(err?.error ?? `HTTP ${r.status}`)
  }
  return (await r.json()) as any
}

// ── Variables (admin API, ruta real: /org-variables) ──────

export async function listVariables(params?: { namespace?: string }): Promise<any[]> {
  const qs = new URLSearchParams()
  if (params?.namespace) qs.set('namespace', params.namespace)
  const query = qs.size ? `?${qs}` : ''
  const r = await apiFetch('admin', `/org-variables${query}`)
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    throw new Error(err?.error ?? `HTTP ${r.status}`)
  }
  return (await r.json()) as any
}

export async function createVariable(body: any): Promise<{ id: string }> {
  const r = await apiFetch('admin', `/org-variables`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    throw new Error(err?.error ?? `HTTP ${r.status}`)
  }
  return (await r.json()) as any
}

export async function updateVariable(id: string, body: { value?: string; label?: string }): Promise<any> {
  const r = await apiFetch('admin', `/org-variables/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    throw new Error(err?.error ?? `HTTP ${r.status}`)
  }
  return (await r.json()) as any
}

export async function deleteVariable(id: string): Promise<void> {
  const r = await apiFetch('admin', `/org-variables/${id}`, {
    method: 'DELETE',
  })
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    throw new Error(err?.error ?? `HTTP ${r.status}`)
  }
}

// ── Appraisals (properties API, ruta real: /appraisals?id=) ─

export async function getAppraisal(id: string): Promise<any> {
  const r = await apiFetch('properties', `/appraisals?id=${encodeURIComponent(id)}`)
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    throw new Error(err?.error ?? `HTTP ${r.status}`)
  }
  const data = (await r.json()) as any
  if (data?.error || !data?.id) throw new Error(data?.error ?? 'Tasación no encontrada')
  return data
}

export async function createAppraisal(body: any): Promise<{ id: string; status: string }> {
  const r = await apiFetch('properties', `/appraisals`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    throw new Error(err?.error ?? `HTTP ${r.status}`)
  }
  return (await r.json()) as any
}

export async function updateAppraisal(id: string, body: any): Promise<any> {
  const r = await apiFetch('properties', `/appraisals?id=${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    throw new Error(err?.error ?? `HTTP ${r.status}`)
  }
  return (await r.json()) as any
}

export async function publishAppraisal(id: string): Promise<any> {
  const r = await apiFetch('properties', `/appraisals/publish?id=${encodeURIComponent(id)}`, {
    method: 'POST',
  })
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    throw new Error(err?.error ?? `HTTP ${r.status}`)
  }
  return (await r.json()) as any
}

export async function syncTemplate(appraisalId: string): Promise<{ synced: boolean }> {
  const r = await apiFetch('properties', `/appraisals/${appraisalId}/sync-template`, { method: 'POST' })
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    throw new Error(err?.error ?? `HTTP ${r.status}`)
  }
  return (await r.json()) as any
}

export async function patchBlockOverride(
  appraisalId: string,
  blockId: string,
  patch: Record<string, unknown>,
): Promise<any> {
  const r = await apiFetch('properties', `/appraisals/${appraisalId}/blocks/${blockId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    throw new Error(err?.error ?? `HTTP ${r.status}`)
  }
  return (await r.json()) as any
}

// ── Comparables (properties API, ruta real: /appraisals/comparables) ──

export async function addComparable(body: any): Promise<any> {
  const r = await apiFetch('properties', `/appraisals/comparables`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    throw new Error(err?.error ?? `HTTP ${r.status}`)
  }
  return (await r.json()) as any
}

export async function updateComparable(id: string, patch: Record<string, unknown>): Promise<any> {
  const r = await apiFetch('properties', `/appraisals/comparables`, {
    method: 'PUT',
    body: JSON.stringify({ id, ...patch }),
  })
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    throw new Error(err?.error ?? `HTTP ${r.status}`)
  }
  return (await r.json()) as any
}

export async function deleteComparable(id: string): Promise<any> {
  const r = await apiFetch('properties', `/appraisals/comparables?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    throw new Error(err?.error ?? `HTTP ${r.status}`)
  }
  return (await r.json()) as any
}

// ── PDF generation (properties API) ──────────────────────────

export async function generatePdf(appraisalId: string): Promise<{
  pdf_url: string
  expires_at: string
  from_cache: boolean
  monthly_used: number
}> {
  const r = await apiFetch('properties', `/appraisals/${appraisalId}/pdf`, { method: 'POST' })
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    const e = new Error(err?.error ?? `HTTP ${r.status}`) as any
    e.code = err?.error
    e.details = err
    throw e
  }
  return (await r.json()) as any
}
