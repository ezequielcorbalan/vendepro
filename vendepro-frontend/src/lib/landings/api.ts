import { apiFetch } from '@/lib/api'
import type { Block, Landing, LandingTemplate, LandingVersion, AnalyticsSummary, LandingKind, LandingStatus, LeadRules } from './types'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status}: ${text || res.statusText}`)
  }
  return (await res.json()) as T
}

export const landingsApi = {
  async list(params: { scope?: 'mine' | 'org' | 'pending_review'; kind?: LandingKind; status?: LandingStatus }) {
    const q = new URLSearchParams()
    if (params.scope) q.set('scope', params.scope)
    if (params.kind) q.set('kind', params.kind)
    if (params.status) q.set('status', params.status)
    const res = await apiFetch('crm', `/landings?${q.toString()}`)
    return json<{ landings: Landing[] }>(res)
  },

  async get(id: string) {
    const res = await apiFetch('crm', `/landings/${id}`)
    return json<{ landing: Landing }>(res)
  },

  async create(body: { templateId: string; slugBase: string; brandVoice?: string; leadRules?: LeadRules; seoTitle?: string; seoDescription?: string; ogImageUrl?: string }) {
    const res = await apiFetch('crm', `/landings`, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
    return json<{ landingId: string; fullSlug: string }>(res)
  },

  async updateMetadata(id: string, patch: Partial<Pick<Landing, 'brand_voice' | 'lead_rules' | 'seo_title' | 'seo_description' | 'og_image_url' | 'slug_base'>>) {
    const res = await apiFetch('crm', `/landings/${id}`, { method: 'PATCH', body: JSON.stringify({ patch }), headers: { 'Content-Type': 'application/json' } })
    return json<{ ok: true }>(res)
  },

  async updateBlocks(id: string, blocks: Block[], label: 'manual-save' | 'auto-save' = 'manual-save') {
    const res = await apiFetch('crm', `/landings/${id}/blocks`, { method: 'PATCH', body: JSON.stringify({ blocks, label }), headers: { 'Content-Type': 'application/json' } })
    return json<{ versionId: string; versionNumber: number }>(res)
  },

  async addBlock(id: string, block: Omit<Block, 'id'>, insertAtIndex?: number) {
    const res = await apiFetch('crm', `/landings/${id}/blocks`, { method: 'POST', body: JSON.stringify({ block, insertAtIndex }), headers: { 'Content-Type': 'application/json' } })
    return json<{ blockId: string }>(res)
  },

  async removeBlock(id: string, blockId: string) {
    const res = await apiFetch('crm', `/landings/${id}/blocks/${blockId}`, { method: 'DELETE' })
    return json<{ ok: true }>(res)
  },

  async reorderBlocks(id: string, orderedBlockIds: string[]) {
    const res = await apiFetch('crm', `/landings/${id}/blocks/reorder`, { method: 'POST', body: JSON.stringify({ orderedBlockIds }), headers: { 'Content-Type': 'application/json' } })
    return json<{ ok: true }>(res)
  },

  async toggleVisibility(id: string, blockId: string, visible: boolean) {
    const res = await apiFetch('crm', `/landings/${id}/blocks/${blockId}/visibility`, { method: 'PATCH', body: JSON.stringify({ visible }), headers: { 'Content-Type': 'application/json' } })
    return json<{ ok: true }>(res)
  },

  async listVersions(id: string) {
    const res = await apiFetch('crm', `/landings/${id}/versions`)
    return json<{ versions: LandingVersion[] }>(res)
  },

  async rollback(id: string, versionId: string) {
    const res = await apiFetch('crm', `/landings/${id}/rollback/${versionId}`, { method: 'POST' })
    return json<{ versionNumber: number }>(res)
  },

  async requestPublish(id: string) {
    const res = await apiFetch('crm', `/landings/${id}/request-publish`, { method: 'POST' })
    return json<{ ok: true }>(res)
  },

  async publish(id: string) {
    const res = await apiFetch('crm', `/landings/${id}/publish`, { method: 'POST' })
    return json<{ versionId: string }>(res)
  },

  async rejectPublish(id: string, note?: string) {
    const res = await apiFetch('crm', `/landings/${id}/reject-publish`, { method: 'POST', body: JSON.stringify({ note }), headers: { 'Content-Type': 'application/json' } })
    return json<{ ok: true }>(res)
  },

  async archive(id: string) { return json(await apiFetch('crm', `/landings/${id}/archive`, { method: 'POST' })) },
  async unarchive(id: string) { return json(await apiFetch('crm', `/landings/${id}/unarchive`, { method: 'POST' })) },

  async analytics(id: string, rangeDays: 7 | 14 | 30) {
    const res = await apiFetch('crm', `/landings/${id}/analytics?rangeDays=${rangeDays}`)
    return json<{ summary: AnalyticsSummary }>(res)
  },
}

export const templatesApi = {
  async list(kind?: LandingKind) {
    const q = kind ? `?kind=${kind}` : ''
    const res = await apiFetch('crm', `/landing-templates${q}`)
    return json<{ templates: LandingTemplate[] }>(res)
  },
}

export const aiApi = {
  async editBlock(landingId: string, body: { prompt: string; scope: 'block' | 'global'; blockId?: string }) {
    const res = await apiFetch('ai', `/landings/${landingId}/edit-block`, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
    return json<
      | { status: 'ok'; proposal: { kind: 'block'; blockId: string; blockType: string; data: any } | { kind: 'global'; blocks: Block[] } }
      | { status: 'error'; reason: string; detail?: string }
    >(res)
  },
}
