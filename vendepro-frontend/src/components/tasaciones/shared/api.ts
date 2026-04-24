// ============================================================
// Tasaciones API wrappers
// All functions call apiFetch(api, path, options?) following
// the real signature: first arg = ApiName, second = path.
// JSON responses are cast `as any` per project rules.
// ============================================================

import { apiFetch } from '@/lib/api'

// ── Templates (admin API) ─────────────────────────────────

export async function listTemplates(params?: { active?: boolean; kind?: string }): Promise<any[]> {
  const qs = new URLSearchParams()
  if (params?.active !== undefined) qs.set('active', params.active ? '1' : '0')
  if (params?.kind) qs.set('kind', params.kind)
  const query = qs.size ? `?${qs}` : ''
  const r = await apiFetch('admin', `/appraisal-templates${query}`)
  return (await r.json()) as any
}

export async function getTemplate(id: string): Promise<any> {
  const r = await apiFetch('admin', `/appraisal-templates/${id}`)
  return (await r.json()) as any
}

export async function createTemplate(body: any): Promise<any> {
  const r = await apiFetch('admin', `/appraisal-templates`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return (await r.json()) as any
}

export async function updateTemplate(id: string, body: any): Promise<any> {
  const r = await apiFetch('admin', `/appraisal-templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
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

export async function archiveTemplate(id: string): Promise<any> {
  const r = await apiFetch('admin', `/appraisal-templates/${id}/archive`, {
    method: 'POST',
  })
  return (await r.json()) as any
}

// ── Variables (admin API) ─────────────────────────────────

export async function listVariables(params?: { scope?: string }): Promise<any[]> {
  const qs = new URLSearchParams()
  if (params?.scope) qs.set('scope', params.scope)
  const query = qs.size ? `?${qs}` : ''
  const r = await apiFetch('admin', `/appraisal-variables${query}`)
  return (await r.json()) as any
}

export async function createVariable(body: any): Promise<{ id: string }> {
  const r = await apiFetch('admin', `/appraisal-variables`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    throw new Error(err?.error ?? `HTTP ${r.status}`)
  }
  return (await r.json()) as any
}

export async function updateVariable(id: string, body: { value?: string; label?: string }): Promise<{ updated: boolean }> {
  const r = await apiFetch('admin', `/appraisal-variables/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    throw new Error(err?.error ?? `HTTP ${r.status}`)
  }
  return (await r.json()) as any
}

export async function deleteVariable(id: string): Promise<void> {
  const r = await apiFetch('admin', `/appraisal-variables/${id}`, {
    method: 'DELETE',
  })
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    throw new Error(err?.error ?? `HTTP ${r.status}`)
  }
}

// ── Appraisals (properties API) ───────────────────────────

export async function getAppraisal(id: string): Promise<any> {
  const r = await apiFetch('properties', `/appraisals/${id}`)
  return (await r.json()) as any
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
  const r = await apiFetch('properties', `/appraisals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    throw new Error(err?.error ?? `HTTP ${r.status}`)
  }
  return (await r.json()) as any
}

export async function publishAppraisal(id: string): Promise<any> {
  const r = await apiFetch('properties', `/appraisals/${id}/publish`, {
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

// ── Comparables (properties API) ──────────────────────────

export async function addComparable(body: any): Promise<any> {
  const r = await apiFetch('properties', `/appraisal-comparables`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    throw new Error(err?.error ?? `HTTP ${r.status}`)
  }
  return (await r.json()) as any
}

export async function deleteComparable(id: string): Promise<any> {
  const r = await apiFetch('properties', `/appraisal-comparables/${id}`, {
    method: 'DELETE',
  })
  return (await r.json()) as any
}
