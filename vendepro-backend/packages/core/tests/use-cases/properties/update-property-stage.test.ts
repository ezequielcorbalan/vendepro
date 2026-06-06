import { describe, it, expect } from 'vitest'
import { UpdatePropertyStageUseCase } from '../../../src/application/use-cases/properties/update-property-stage'
import { Lead } from '../../../src/domain/entities/lead'
import { Property } from '../../../src/domain/entities/property'

function makeLeadEntity(stage: string) {
  return Lead.create({
    id: 'L1',
    org_id: 'O1',
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

function makeFakePropRepo() {
  const props = new Map<string, any>()
  return {
    _seed: (p: any) => props.set(p.id, p),
    findById: async (id: string, _o: string) => props.get(id) ?? null,
    updateStage: async (id: string, _o: string, s: string) => {
      const p = props.get(id)
      if (p) p.commercial_stage = s
    },
  } as any
}

function makeFakeLeadRepo() {
  const leads = new Map<string, Lead>()
  return {
    _seed: (l: Lead) => leads.set(l.id, l),
    findById: async (id: string, _o: string) => leads.get(id) ?? null,
    save: async (l: Lead) => leads.set(l.id, l),
  } as any
}

function makeFakeHistory() {
  const events: any[] = []
  return {
    log: async (e: any) => events.push(e),
    findByEntity: async () => events,
    _all: () => events,
  } as any
}

describe('UpdatePropertyStageUseCase with lead sync', () => {
  it('marks lead as finalizado when property goes to vendida', async () => {
    const propRepo = makeFakePropRepo()
    const leadRepo = makeFakeLeadRepo()
    const histRepo = makeFakeHistory()

    // reservada → vendida is a valid property transition; captado → finalizado via sync
    propRepo._seed({ id: 'P1', org_id: 'O1', commercial_stage: 'reservada', lead_id: 'L1' })
    leadRepo._seed(makeLeadEntity('captado'))

    const uc = new UpdatePropertyStageUseCase(propRepo, histRepo, leadRepo)
    const out = await uc.execute({ propertyId: 'P1', orgId: 'O1', newStage: 'vendida', changedBy: 'agent1' })

    expect(out.syncedLeadId).toBe('L1')
    const lead = await leadRepo.findById('L1', 'O1')
    expect(lead.stage).toBe('finalizado')
    expect(histRepo._all().find((e: any) => e.entity_type === 'lead' && e.triggered_by === 'sync')).toBeDefined()
  })

  it('marks lead as perdido when property goes to perdida', async () => {
    const propRepo = makeFakePropRepo()
    const leadRepo = makeFakeLeadRepo()
    const histRepo = makeFakeHistory()

    // publicada → perdida is a valid property transition; captado → perdido via sync
    propRepo._seed({ id: 'P1', org_id: 'O1', commercial_stage: 'publicada', lead_id: 'L1' })
    leadRepo._seed(makeLeadEntity('captado'))

    const uc = new UpdatePropertyStageUseCase(propRepo, histRepo, leadRepo)
    const out = await uc.execute({ propertyId: 'P1', orgId: 'O1', newStage: 'perdida', changedBy: 'agent1' })

    expect(out.syncedLeadId).toBe('L1')
    const lead = await leadRepo.findById('L1', 'O1')
    expect(lead.stage).toBe('perdido')
  })

  it('does not touch lead if lead is not in captado', async () => {
    const propRepo = makeFakePropRepo()
    const leadRepo = makeFakeLeadRepo()
    const histRepo = makeFakeHistory()

    // publicada → perdida is valid; but lead in seguimiento doesn't match sync policy
    propRepo._seed({ id: 'P1', org_id: 'O1', commercial_stage: 'publicada', lead_id: 'L1' })
    leadRepo._seed(makeLeadEntity('seguimiento'))

    const uc = new UpdatePropertyStageUseCase(propRepo, histRepo, leadRepo)
    const out = await uc.execute({ propertyId: 'P1', orgId: 'O1', newStage: 'perdida', changedBy: 'agent1' })

    expect(out.syncedLeadId).toBeNull()
    const lead = await leadRepo.findById('L1', 'O1')
    expect(lead.stage).toBe('seguimiento')
  })

  it('works without leadRepo (backwards compat)', async () => {
    const propRepo = makeFakePropRepo()
    const histRepo = makeFakeHistory()

    // reservada → vendida is a valid transition; no lead_id on property
    propRepo._seed({ id: 'P1', org_id: 'O1', commercial_stage: 'reservada' })

    const uc = new UpdatePropertyStageUseCase(propRepo, histRepo)
    const out = await uc.execute({ propertyId: 'P1', orgId: 'O1', newStage: 'vendida', changedBy: 'agent1' })

    expect(out.syncedLeadId).toBeNull()
  })

  // Regression: previously the use case read `(property as any).lead_id`, which
  // works on plain seed objects but returns undefined for real Property entities
  // (lead_id lives in private props with no getter). The production smoke caught
  // this, see packages/smoke-prod/tests/state-machine.smoke.test.ts D1/D2.
  it('reads lead_id from a real Property entity (regression)', async () => {
    const leadRepo = makeFakeLeadRepo()
    const histRepo = makeFakeHistory()

    const realProperty = Property.create({
      id: 'P1',
      org_id: 'O1',
      agent_id: 'A1',
      address: 'X',
      neighborhood: 'X',
      city: 'X',
      property_type: 'departamento' as any,
      rooms: null,
      size_m2: null,
      asking_price: null,
      currency: 'USD' as any,
      owner_name: 'X',
      owner_phone: '1',
      owner_email: null,
      contact_id: null,
      lead_id: 'L1',
      public_slug: 'x',
      cover_photo: null,
      status: 'active' as any,
      commercial_stage: 'reservada',
      operation_type: 'venta',
      operation_type_id: 1,
      commercial_stage_id: null,
      status_id: 1,
    })

    const propRepo = {
      findById: async (id: string, _o: string) => (id === 'P1' ? realProperty : null),
      updateStage: async () => {},
    } as any

    leadRepo._seed(makeLeadEntity('captado'))

    const uc = new UpdatePropertyStageUseCase(propRepo, histRepo, leadRepo)
    const out = await uc.execute({ propertyId: 'P1', orgId: 'O1', newStage: 'vendida', changedBy: 'agent1' })

    expect(out.syncedLeadId).toBe('L1')
  })
})
