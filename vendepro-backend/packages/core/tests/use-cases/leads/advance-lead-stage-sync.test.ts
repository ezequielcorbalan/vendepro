import { describe, it, expect } from 'vitest'
import { AdvanceLeadStageUseCase } from '../../../src/application/use-cases/leads/advance-lead-stage'
import { Lead } from '../../../src/domain/entities/lead'

function makeLeadEntity(id: string, orgId: string, stage: string) {
  return Lead.create({
    id,
    org_id: orgId,
    full_name: 'Test Lead',
    phone: '1134567890',
    email: null,
    source: 'manual',
    source_detail: null,
    property_address: null,
    neighborhood: null,
    property_type: null,
    operation: 'venta',
    stage: stage as any,
    assigned_to: 'agent-1',
    notes: null,
    estimated_value: null,
    budget: null,
    timing: null,
    personas_trabajo: null,
    mascotas: null,
    next_step: null,
    next_step_date: null,
    lost_reason: null,
    first_contact_at: null,
  })
}

function makeFakeLeadRepo() {
  const leads = new Map<string, Lead>()
  return {
    _seed: (l: Lead) => leads.set(l.id, l),
    findById: async (id: string, _org: string) => leads.get(id) ?? null,
    save: async (l: Lead) => { leads.set(l.id, l) },
    findAll: async () => Array.from(leads.values()),
  } as any
}

function makeFakePropertyRepo() {
  const props = new Map<string, any>()
  return {
    _seed: (p: any) => props.set(p.id, p),
    findById: async (id: string, _org: string) => props.get(id) ?? null,
    findByLeadId: async (leadId: string, _org: string) => {
      for (const p of props.values()) if (p.lead_id === leadId) return p
      return null
    },
    updateStage: async (id: string, _org: string, stage: string) => {
      const p = props.get(id)
      if (p) p.commercial_stage = stage
    },
  } as any
}

function makeFakeHistoryRepo() {
  const entries: any[] = []
  return {
    log: async (e: any) => { entries.push(e) },
    findByEntity: async () => entries,
    _all: () => entries,
  } as any
}

function makeFakeCalendar() {
  return { save: async () => {} } as any
}

function makeIdGen() {
  let i = 0
  return { generate: () => `gen-${++i}` }
}

describe('AdvanceLeadStageUseCase with property sync', () => {
  it('promotes property from propuesta to captada when lead reaches captado', async () => {
    const leadRepo = makeFakeLeadRepo()
    const propRepo = makeFakePropertyRepo()
    const histRepo = makeFakeHistoryRepo()

    // presentada → captado is a valid manual transition
    leadRepo._seed(makeLeadEntity('L1', 'O1', 'presentada'))
    propRepo._seed({ id: 'P1', org_id: 'O1', commercial_stage: 'propuesta', lead_id: 'L1' })

    const uc = new AdvanceLeadStageUseCase(leadRepo, makeFakeCalendar(), histRepo, makeIdGen(), propRepo)
    const out = await uc.execute({ leadId: 'L1', orgId: 'O1', newStage: 'captado', changedBy: 'agent1' })

    expect(out.syncedPropertyId).toBe('P1')
    const prop = await propRepo.findById('P1', 'O1')
    expect(prop.commercial_stage).toBe('captada')

    const events = histRepo._all()
    expect(events.find((e: any) => e.entity_type === 'lead' && e.triggered_by === 'user')).toBeDefined()
    expect(events.find((e: any) => e.entity_type === 'property' && e.triggered_by === 'sync')).toBeDefined()
  })

  it('does not touch property if it already advanced past propuesta', async () => {
    const leadRepo = makeFakeLeadRepo()
    const propRepo = makeFakePropertyRepo()
    const histRepo = makeFakeHistoryRepo()

    leadRepo._seed(makeLeadEntity('L1', 'O1', 'presentada'))
    propRepo._seed({ id: 'P1', org_id: 'O1', commercial_stage: 'publicada', lead_id: 'L1' })

    const uc = new AdvanceLeadStageUseCase(leadRepo, makeFakeCalendar(), histRepo, makeIdGen(), propRepo)
    const out = await uc.execute({ leadId: 'L1', orgId: 'O1', newStage: 'captado', changedBy: 'agent1' })

    expect(out.syncedPropertyId).toBeNull()
    const prop = await propRepo.findById('P1', 'O1')
    expect(prop.commercial_stage).toBe('publicada')
  })

  it('syncs property to invalida when lead transitions to invalido', async () => {
    const leadRepo = makeFakeLeadRepo()
    const propRepo = makeFakePropertyRepo()
    const histRepo = makeFakeHistoryRepo()

    // contactado → invalido is a valid manual transition
    leadRepo._seed(makeLeadEntity('L1', 'O1', 'contactado'))
    propRepo._seed({ id: 'P1', org_id: 'O1', commercial_stage: 'propuesta', lead_id: 'L1' })

    const uc = new AdvanceLeadStageUseCase(leadRepo, makeFakeCalendar(), histRepo, makeIdGen(), propRepo)
    const out = await uc.execute({ leadId: 'L1', orgId: 'O1', newStage: 'invalido', changedBy: 'agent1' })

    expect(out.syncedPropertyId).toBe('P1')
    const prop = await propRepo.findById('P1', 'O1')
    expect(prop.commercial_stage).toBe('invalida')
  })

  it('works without propertyRepo (backwards compat)', async () => {
    const leadRepo = makeFakeLeadRepo()
    const histRepo = makeFakeHistoryRepo()

    // nuevo → contactado is a valid manual transition
    leadRepo._seed(makeLeadEntity('L1', 'O1', 'nuevo'))

    const uc = new AdvanceLeadStageUseCase(leadRepo, makeFakeCalendar(), histRepo, makeIdGen())
    const out = await uc.execute({ leadId: 'L1', orgId: 'O1', newStage: 'contactado', changedBy: 'agent1' })

    expect(out.syncedPropertyId).toBeNull()
  })
})
