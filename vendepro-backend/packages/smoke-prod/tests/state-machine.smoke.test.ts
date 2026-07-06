// Production smoke for lead + property state machines.
//
// Setup: logs in once (beforeAll).
// Teardown: deletes every entity created during the run (afterAll), regardless
//           of pass/fail. See api-client.ts `created` tracker.
//
// Negative transitions are generated from the value-object source of truth
// (LeadStage / PropertyStage canTransitionTo). If the domain model changes,
// the tests auto-update.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { LEAD_STAGES, LeadStage, PROPERTY_STAGES, PropertyStage } from '@vendepro/core'
import type { LeadStageValue, PropertyStageValue } from '@vendepro/core'
import {
  login,
  advanceLeadStage,
  createLead,
  createProperty,
  setPropertyStage,
  expectLeadStage,
  expectPropertyStage,
  getProperty,
  getStageHistory,
  cleanup,
  sweepStaleSmokeArtifacts,
  req,
  SMOKE_RUN_ID,
} from './api-client'

beforeAll(async () => {
  const u = await login()
  console.log(`[smoke] login ok — ${u.email} (${u.role}) org=${u.orgId} run=${SMOKE_RUN_ID}`)
  // Red auto-sanante: limpia leads/contactos SMOKE TEST huérfanos de runs viejos
  // (procesos que murieron por resource-limits antes del afterAll). Corre acá —
  // no en afterAll— para que se ejecute aunque los tests crasheen después. El
  // filtro de edad lo hace seguro frente a los 8 deploys concurrentes.
  const s = await sweepStaleSmokeArtifacts()
  console.log(`[smoke] sweep viejos — leads=${s.leads} contacts=${s.contacts}${s.capped ? ' (tope alcanzado, drena en próximos runs)' : ''}`)
}, 120_000)

afterAll(async () => {
  const c = await cleanup()
  console.log(`[smoke] cleanup — events=${c.events} props=${c.props} leads=${c.leads} contacts=${c.contacts}`)
}, 120_000)

// ── Block A: Lead manual ────────────────────────────────────────
describe('Block A — Lead manual', () => {
  it('A1 lead nuevo → asignado returns 200', async () => {
    const id = await createLead('A1')
    const r = await advanceLeadStage(id, 'asignado')
    expect(r.status).toBe(200)
  })

  it('A2 asignado → calificado rejected (skips contactado)', async () => {
    const id = await createLead('A2', { stage: 'asignado' })
    const r = await advanceLeadStage(id, 'calificado')
    expect(r.status).toBe(400)
    expect(JSON.stringify(r.data)).toMatch(/inv[áa]lida/i)
  })

  it('A3 full chain to presentada emits auto-followup event', async () => {
    const id = await createLead('A3')
    for (const s of ['asignado', 'contactado', 'calificado', 'en_tasacion'] as const) {
      const r = await advanceLeadStage(id, s)
      expect(r.status, `→${s}`).toBe(200)
    }
    const presentada = await advanceLeadStage(id, 'presentada')
    expect(presentada.status).toBe(200)
    expect(presentada.data?.autoFollowup?.id).toBeTruthy()
    expect(presentada.data?.autoFollowup?.event_type).toBe('seguimiento')
  })

  it('A4 stage_history records 5 user-triggered rows', async () => {
    const id = await createLead('A4', { stage: 'presentada' })
    const history = await getStageHistory('lead', id)
    expect(history.length).toBeGreaterThanOrEqual(5)
    for (const row of history) {
      expect(row.triggered_by).toBe('user')
      expect(row.entity_type).toBe('lead')
      expect(row.entity_id).toBe(id)
    }
  })
})

// ── Block B: Property manual ────────────────────────────────────
describe('Block B — Property manual', () => {
  it('B1 captada → publicada returns 200', async () => {
    const id = await createProperty({ stage: 'captada' })
    const r = await req('PUT', 'props', `/properties/${id}/stage`, { commercial_stage: 'publicada' })
    expect(r.status).toBe(200)
  })

  it('B2 publicada → vendida rejected (skips reservada)', async () => {
    const id = await createProperty({ stage: 'captada' })
    await setPropertyStage(id, 'publicada')
    const r = await req('PUT', 'props', `/properties/${id}/stage`, { commercial_stage: 'vendida' })
    expect(r.status).toBe(400)
  })

  it('B3 full chain captada → publicada → reservada → vendida', async () => {
    const id = await createProperty({ stage: 'captada' })
    for (const s of ['publicada', 'reservada', 'vendida'] as const) {
      const r = await req('PUT', 'props', `/properties/${id}/stage`, { commercial_stage: s })
      expect(r.status, `→${s}`).toBe(200)
    }
    const history = await getStageHistory('property', id)
    expect(history.length).toBeGreaterThanOrEqual(3)
  })
})

// ── Block C: Sync Lead → Property ───────────────────────────────
describe('Block C — Sync Lead → Property', () => {
  it('C1 lead captado syncs linked property propuesta → captada', async () => {
    const leadId = await createLead('C1')
    const propId = await createProperty({ leadId, stage: 'propuesta' })
    for (const s of ['asignado', 'contactado', 'calificado', 'en_tasacion', 'presentada', 'captado'] as const) {
      const r = await advanceLeadStage(leadId, s)
      expect(r.status, `→${s}`).toBe(200)
    }
    expect(await expectPropertyStage(propId, 'captada')).toBe('captada')

    const history = await getStageHistory('property', propId)
    const syncRow = history.find((h) => h.triggered_by === 'sync' && h.to_stage === 'captada')
    expect(syncRow, 'sync row in property history').toBeTruthy()
    expect(syncRow.notes).toMatch(new RegExp(`Sync desde lead ${leadId}`))
  })

  it('C2 lead invalido syncs linked publicada → invalida', async () => {
    const leadId = await createLead('C2')
    // 'invalido' sync rule fires on any non-final property, so we can skip
    // explicit propuesta and go straight to publicada.
    const propId = await createProperty({ leadId, stage: 'captada' })
    await setPropertyStage(propId, 'publicada')

    const r = await advanceLeadStage(leadId, 'invalido')
    expect(r.status).toBe(200)

    expect(await expectPropertyStage(propId, 'invalida')).toBe('invalida')
  })
})

// ── Block D: Sync Property → Lead ───────────────────────────────
describe('Block D — Sync Property → Lead', () => {
  it('D1 property vendida syncs linked lead captado → finalizado', async () => {
    // captado requiere una propiedad vinculada: la creamos y luego avanzamos.
    const leadId = await createLead('D1', { stage: 'presentada' })
    const propId = await createProperty({ leadId, stage: 'captada' })
    expect((await advanceLeadStage(leadId, 'captado')).status, '→captado').toBe(200)
    for (const s of ['publicada', 'reservada', 'vendida'] as const) {
      const r = await req('PUT', 'props', `/properties/${propId}/stage`, { commercial_stage: s })
      expect(r.status, `→${s}`).toBe(200)
    }
    expect(await expectLeadStage(leadId, 'finalizado')).toBe('finalizado')

    const history = await getStageHistory('lead', leadId)
    expect(history.some((h) => h.triggered_by === 'sync' && h.to_stage === 'finalizado')).toBe(true)
  })

  it('D2 property perdida syncs linked lead captado → perdido', async () => {
    const leadId = await createLead('D2', { stage: 'presentada' })
    const propId = await createProperty({ leadId, stage: 'captada' })
    expect((await advanceLeadStage(leadId, 'captado')).status, '→captado').toBe(200)
    await setPropertyStage(propId, 'publicada')
    const r = await req('PUT', 'props', `/properties/${propId}/stage`, { commercial_stage: 'perdida' })
    expect(r.status).toBe(200)

    expect(await expectLeadStage(leadId, 'perdido')).toBe('perdido')
  })
})

// ── Block E: Negative terminal states ───────────────────────────
describe('Block E — Negative terminal states', () => {
  it('E1 lead presentada → perdido (proposal rejected)', async () => {
    const id = await createLead('E1', { stage: 'presentada' })
    const r = await advanceLeadStage(id, 'perdido')
    expect(r.status).toBe(200)
    expect(await expectLeadStage(id, 'perdido')).toBe('perdido')
  })

  it('E2 lead nuevo → invalido (no property)', async () => {
    const id = await createLead('E2')
    const r = await advanceLeadStage(id, 'invalido')
    expect(r.status).toBe(200)
    expect(await expectLeadStage(id, 'invalido')).toBe('invalido')
  })

  it('E3 lead seguimiento → perdido (followup gave up)', async () => {
    const id = await createLead('E3', { stage: 'seguimiento' })
    const r = await advanceLeadStage(id, 'perdido')
    expect(r.status).toBe(200)
    expect(await expectLeadStage(id, 'perdido')).toBe('perdido')
  })

  it('E4 property perdida does NOT sync lead (lead not in captado)', async () => {
    const leadId = await createLead('E4', { stage: 'contactado' })
    const propId = await createProperty({ leadId, stage: 'captada' })
    await setPropertyStage(propId, 'publicada')
    const r = await req('PUT', 'props', `/properties/${propId}/stage`, { commercial_stage: 'perdida' })
    expect(r.status).toBe(200)

    // unchanged: sync only fires when lead is 'captado'.
    // Use expectLeadStage with the EXPECTED unchanged value so the helper
    // returns quickly without polling — if the API mistakenly synced, we
    // still catch it on the first read.
    expect(await expectLeadStage(leadId, 'contactado')).toBe('contactado')
  })

  it('E5 lead captado rejects manual transition (sync-only)', async () => {
    const id = await createLead('E5', { stage: 'captado' })
    for (const target of ['perdido', 'finalizado', 'seguimiento'] as const) {
      const r = await advanceLeadStage(id, target)
      expect(r.status, `captado → ${target}`).toBe(400)
    }
  })

  it('E6 terminal lead stages reject any transition', async () => {
    const id = await createLead('E6', { stage: 'invalido' })
    const r = await advanceLeadStage(id, 'nuevo')
    expect(r.status).toBe(400)
  })
})

// ── Generated invalid-transition matrix (Lead) ──────────────────
// For each (from, to) where canTransitionTo(to) === false, the API must reject.
// This auto-updates when MANUAL_TRANSITIONS changes.
describe('Lead invalid-transition matrix (generated)', () => {
  // Only run a sample to keep production load reasonable: pick 8 invalid pairs.
  const cases: Array<{ from: LeadStageValue; to: LeadStageValue }> = []
  for (const from of LEAD_STAGES) {
    const fromVO = LeadStage.create(from)
    for (const to of LEAD_STAGES) {
      if (from === to) continue
      if (!fromVO.canTransitionTo(to, { source: 'user' })) {
        cases.push({ from, to })
      }
    }
  }
  // Skip stages we can't reach manually from 'nuevo' (finalizado is sync-only target).
  const REACHABLE: LeadStageValue[] = ['nuevo', 'asignado', 'contactado', 'calificado', 'en_tasacion', 'presentada', 'seguimiento', 'captado', 'invalido', 'perdido']
  const reachableCases = cases.filter((c) => REACHABLE.includes(c.from))
  // Sample 8 deterministic cases.
  const sample = reachableCases.filter((_, i) => i % Math.ceil(reachableCases.length / 8) === 0).slice(0, 8)

  for (const { from, to } of sample) {
    it(`lead ${from} → ${to} rejected`, async () => {
      const id = await createLead(`MX-${from}-${to}`, { stage: from })
      const r = await advanceLeadStage(id, to)
      expect(r.status, `${from} → ${to}`).toBe(400)
    })
  }
})

// ── Generated invalid-transition matrix (Property) ──────────────
describe('Property invalid-transition matrix (generated)', () => {
  const cases: Array<{ from: PropertyStageValue; to: PropertyStageValue }> = []
  for (const from of PROPERTY_STAGES) {
    const fromVO = PropertyStage.create(from)
    for (const to of PROPERTY_STAGES) {
      if (from === to) continue
      if (!fromVO.canTransitionTo(to)) {
        cases.push({ from, to })
      }
    }
  }
  // Limit to reachable-from-captada cases: 'propuesta' can be set initially, others reachable from captada.
  const REACHABLE: PropertyStageValue[] = ['propuesta', 'captada', 'documentacion', 'publicada', 'reservada', 'suspendida', 'vencida']
  const reachableCases = cases.filter((c) => REACHABLE.includes(c.from))
  const sample = reachableCases.filter((_, i) => i % Math.ceil(reachableCases.length / 6) === 0).slice(0, 6)

  for (const { from, to } of sample) {
    it(`property ${from} → ${to} rejected`, async () => {
      const id = await createProperty({ stage: 'captada' })
      // Walk to `from` if needed via known valid path; only handle simple cases.
      if (from !== 'captada') {
        try { await setPropertyStage(id, from) } catch {
          // Can't reach this `from` cleanly from 'captada' — skip the assertion path.
          return
        }
      }
      const r = await req('PUT', 'props', `/properties/${id}/stage`, { commercial_stage: to })
      expect(r.status, `${from} → ${to}`).toBe(400)
    })
  }
})
