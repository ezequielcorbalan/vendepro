// Production smoke for the Integration API flow:
//   login (admin) → create API token (JWT) → import leads via POST /v1/leads
//   → verify lead landed unassigned/nuevo → revoke token → confirm 401.
//
// Reuses login()/req() from api-client for auth + crm (user JWT). The /v1/*
// ingestion endpoint is authenticated with the INTEGRATION token (a different
// bearer), so it uses a dedicated client here.
//
// Requires the feature deployed + migration 031 applied. Bases are overridable
// via env (SMOKE_BASE_PUBLIC/CRM/AUTH) so this can also run against `wrangler dev`.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { login, req, tag, SMOKE_RUN_ID } from './api-client'

const PUBLIC_BASE = process.env.SMOKE_BASE_PUBLIC || 'https://public.api.vendepro.com.ar'

// POST /v1/leads with an explicit integration bearer (or none, to test 401).
async function importLeads(bearer: string | null, body: unknown): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (bearer) headers.Authorization = `Bearer ${bearer}`
  const r = await fetch(`${PUBLIC_BASE}/v1/leads`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const text = await r.text()
  let data: any
  try { data = JSON.parse(text) } catch { data = text }
  return { status: r.status, data }
}

// Poll POST /v1/leads until it returns the expected status (absorbs D1 read-replica
// lag after revocation — the middleware reads the token record from a replica).
// Tracks any lead a still-active response creates, so nothing leaks during polling.
async function expectImportStatus(bearer: string | null, body: unknown, expected: number, timeoutMs = 8_000): Promise<number> {
  const deadline = Date.now() + timeoutMs
  let r = await importLeads(bearer, body)
  trackResults(r.data?.results)
  while (r.status !== expected && Date.now() < deadline) {
    await new Promise((res) => setTimeout(res, 400))
    r = await importLeads(bearer, body)
    trackResults(r.data?.results)
  }
  return r.status
}

// Shared state across the sequential flow.
const state: { tokenId: string | null; token: string | null } = { tokenId: null, token: null }
const createdLeads: string[] = []
const createdContacts: string[] = []
const createdTokens: string[] = []

function trackResults(results: any[]) {
  for (const r of results ?? []) {
    if (r?.id) createdLeads.push(r.id)
    if (r?.contact_id) createdContacts.push(r.contact_id)
  }
}

beforeAll(async () => {
  const u = await login()
  console.log(`[smoke:api-tokens] login ok — ${u.email} (${u.role}) org=${u.orgId} run=${SMOKE_RUN_ID}`)
  if (u.role !== 'admin' && u.role !== 'owner') {
    throw new Error(`SMOKE_EMAIL must be admin/owner to manage API tokens (got role=${u.role})`)
  }
}, 30_000)

afterAll(async () => {
  // Revoke any token left active, then delete leads → contacts (respect FKs).
  for (const id of createdTokens) {
    await req('DELETE', 'crm', `/api-tokens/${id}`).catch(() => {})
  }
  let leads = 0, contacts = 0
  for (const id of createdLeads) {
    const r = await req('DELETE', 'crm', `/leads?id=${id}`)
    if (r.status === 200) leads++
  }
  for (const id of createdContacts) {
    const r = await req('DELETE', 'crm', `/contacts?id=${id}`)
    if (r.status === 200) contacts++
  }
  console.log(`[smoke:api-tokens] cleanup — tokens=${createdTokens.length} leads=${leads} contacts=${contacts}`)
}, 120_000)

describe('Integration API — API tokens + lead import', () => {
  it('T1 creates an API token (POST /api-tokens) and returns the JWT once', async () => {
    const r = await req<any>('POST', 'crm', '/api-tokens', { name: tag('token') })
    expect(r.status, JSON.stringify(r.data)).toBe(201)
    expect(r.data?.id).toBeTruthy()
    expect(typeof r.data?.token).toBe('string')
    expect(r.data.token.startsWith('eyJ')).toBe(true) // JWT
    expect(r.data.scopes).toContain('leads:write')
    expect(r.data.prefix).toBeTruthy()
    state.tokenId = r.data.id
    state.token = r.data.token
    createdTokens.push(r.data.id)
  })

  it('T2 lists tokens (GET /api-tokens) — the new one is active, without the raw token', async () => {
    const r = await req<any>('GET', 'crm', '/api-tokens')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data)).toBe(true)
    const found = r.data.find((t: any) => t.id === state.tokenId)
    expect(found, 'created token in list').toBeTruthy()
    expect(found.is_active).toBe(true)
    expect(found.token, 'raw token must never be listed').toBeUndefined()
  })

  it('T3 imports a single lead (POST /v1/leads) with the integration token', async () => {
    const full_name = tag('IMPORT-single')
    const r = await importLeads(state.token, {
      full_name,
      phone: '+5491100000010',
      email: `smoke-import-${SMOKE_RUN_ID}@test.local`,
      operation: 'venta',
      source_detail: 'smoke',
    })
    expect(r.status, JSON.stringify(r.data)).toBe(201)
    expect(r.data.created).toBe(1)
    expect(r.data.failed).toBe(0)
    expect(r.data.results?.[0]?.ok).toBe(true)
    expect(r.data.results?.[0]?.id).toBeTruthy()
    trackResults(r.data.results)
  })

  it('T4 imported lead lands unassigned and in stage "nuevo"', async () => {
    const full_name = tag('IMPORT-verify')
    const r = await importLeads(state.token, { full_name })
    expect(r.status).toBe(201)
    trackResults(r.data.results)

    // Find it via CRM (poll for D1 read-replica consistency).
    const deadline = Date.now() + 8_000
    let lead: any = null
    while (!lead && Date.now() < deadline) {
      const list = await req<any>('GET', 'crm', `/leads?search=${encodeURIComponent(full_name)}`)
      if (Array.isArray(list.data)) lead = list.data.find((l: any) => l.full_name === full_name)
      if (!lead) await new Promise((r) => setTimeout(r, 400))
    }
    expect(lead, 'imported lead visible in CRM').toBeTruthy()
    expect(lead.stage).toBe('nuevo')
    expect(lead.assigned_to == null).toBe(true) // sin asignar
    expect(lead.source).toBe('api')
  })

  it('T5 imports a batch ({ leads: [...] }) and reports per-item results', async () => {
    const a = tag('IMPORT-batch-a')
    const b = tag('IMPORT-batch-b')
    const r = await importLeads(state.token, { leads: [{ full_name: a }, { full_name: b }] })
    expect(r.status, JSON.stringify(r.data)).toBe(201)
    expect(r.data.created).toBe(2)
    expect(r.data.results).toHaveLength(2)
    trackResults(r.data.results)
  })

  it('T6 a batch with an invalid item fails only that item', async () => {
    const ok = tag('IMPORT-mixed-ok')
    const r = await importLeads(state.token, { leads: [{ full_name: ok }, { full_name: '' }] })
    expect(r.status).toBe(201)
    expect(r.data.created).toBe(1)
    expect(r.data.failed).toBe(1)
    expect(r.data.results[1].ok).toBe(false)
    expect(r.data.results[1].error).toBeTruthy()
    trackResults(r.data.results)
  })

  it('T7 request without a token is rejected (401)', async () => {
    const r = await importLeads(null, { full_name: tag('IMPORT-noauth') })
    expect(r.status).toBe(401)
  })

  it('T8 request with a malformed token is rejected (401)', async () => {
    const r = await importLeads('not-a-real-jwt', { full_name: tag('IMPORT-badtoken') })
    expect(r.status).toBe(401)
  })

  it('T9 revokes the token (DELETE /api-tokens/:id)', async () => {
    const r = await req<any>('DELETE', 'crm', `/api-tokens/${state.tokenId}`)
    expect(r.status).toBe(200)
  })

  it('T10 the revoked token can no longer import (401)', async () => {
    const status = await expectImportStatus(state.token, { full_name: tag('IMPORT-revoked') }, 401)
    expect(status).toBe(401)
  })
})
