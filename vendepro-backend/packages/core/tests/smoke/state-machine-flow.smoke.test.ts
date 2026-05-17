import { describe, it, expect, beforeEach } from 'vitest'
import { Lead } from '../../src/domain/entities/lead'
import { AdvanceLeadStageUseCase } from '../../src/application/use-cases/leads/advance-lead-stage'
import { UpdatePropertyStageUseCase } from '../../src/application/use-cases/properties/update-property-stage'

// ── Helpers ────────────────────────────────────────────────────────────────

function makeLeadEntity(id: string, orgId: string, stage: string) {
  return Lead.create({
    id,
    org_id: orgId,
    full_name: 'Smoke Test Lead',
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

// ── Fakes ──────────────────────────────────────────────────────────────────

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

// ── Shared wiring factory ─────────────────────────────────────────────────

function makeWiredUseCases(leadRepo: any, propRepo: any, histRepo: any) {
  const leadUC = new AdvanceLeadStageUseCase(
    leadRepo,
    makeFakeCalendar(),
    histRepo,
    makeIdGen(),
    propRepo,
  )
  const propUC = new UpdatePropertyStageUseCase(propRepo, histRepo, leadRepo)
  return { leadUC, propUC }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('State Machine Smoke Test — full lifecycle', () => {

  it('happy path: lead nuevo → captado → property captada → vendida → lead finalizado', async () => {
    const leadRepo = makeFakeLeadRepo()
    const propRepo = makeFakePropertyRepo()
    const histRepo = makeFakeHistoryRepo()
    const { leadUC, propUC } = makeWiredUseCases(leadRepo, propRepo, histRepo)

    const ORG = 'O1'

    // Seed lead in 'nuevo'
    leadRepo._seed(makeLeadEntity('L1', ORG, 'nuevo'))

    // Advance: nuevo → asignado → contactado → calificado → en_tasacion
    await leadUC.execute({ leadId: 'L1', orgId: ORG, newStage: 'asignado',    changedBy: 'agent1' })
    await leadUC.execute({ leadId: 'L1', orgId: ORG, newStage: 'contactado',  changedBy: 'agent1' })
    await leadUC.execute({ leadId: 'L1', orgId: ORG, newStage: 'calificado',  changedBy: 'agent1' })
    await leadUC.execute({ leadId: 'L1', orgId: ORG, newStage: 'en_tasacion', changedBy: 'agent1' })

    // Property is created (externally) in 'propuesta' linked to lead
    propRepo._seed({ id: 'P1', org_id: ORG, commercial_stage: 'propuesta', lead_id: 'L1' })

    // Continue lead: en_tasacion → presentada → captado
    await leadUC.execute({ leadId: 'L1', orgId: ORG, newStage: 'presentada', changedBy: 'agent1' })
    const captadoOut = await leadUC.execute({ leadId: 'L1', orgId: ORG, newStage: 'captado', changedBy: 'agent1' })

    // Property synced: propuesta → captada
    expect(captadoOut.syncedPropertyId).toBe('P1')
    const propAfterCaptado = await propRepo.findById('P1', ORG)
    expect(propAfterCaptado.commercial_stage).toBe('captada')

    // Move property through the commercial funnel
    await propUC.execute({ propertyId: 'P1', orgId: ORG, newStage: 'publicada',  changedBy: 'agent1' })
    await propUC.execute({ propertyId: 'P1', orgId: ORG, newStage: 'reservada',  changedBy: 'agent1' })
    const vendidaOut = await propUC.execute({ propertyId: 'P1', orgId: ORG, newStage: 'vendida', changedBy: 'agent1' })

    // Lead synced: captado → finalizado
    expect(vendidaOut.syncedLeadId).toBe('L1')
    const leadFinal = await leadRepo.findById('L1', ORG)
    expect(leadFinal.stage).toBe('finalizado')

    // Final state assertions
    const propFinal = await propRepo.findById('P1', ORG)
    expect(propFinal.commercial_stage).toBe('vendida')
  })

  it('sad path: lead invalidated early → property auto-invalidates', async () => {
    const leadRepo = makeFakeLeadRepo()
    const propRepo = makeFakePropertyRepo()
    const histRepo = makeFakeHistoryRepo()
    const { leadUC } = makeWiredUseCases(leadRepo, propRepo, histRepo)

    const ORG = 'O1'

    // Lead in 'nuevo', property in 'propuesta' already linked
    leadRepo._seed(makeLeadEntity('L1', ORG, 'nuevo'))
    propRepo._seed({ id: 'P1', org_id: ORG, commercial_stage: 'propuesta', lead_id: 'L1' })

    // Advance: nuevo → contactado → invalido
    await leadUC.execute({ leadId: 'L1', orgId: ORG, newStage: 'contactado', changedBy: 'agent1' })
    const invalidoOut = await leadUC.execute({ leadId: 'L1', orgId: ORG, newStage: 'invalido', changedBy: 'agent1' })

    // Property synced: propuesta → invalida
    expect(invalidoOut.syncedPropertyId).toBe('P1')
    const prop = await propRepo.findById('P1', ORG)
    expect(prop.commercial_stage).toBe('invalida')

    // Lead is terminal
    const lead = await leadRepo.findById('L1', ORG)
    expect(lead.stage).toBe('invalido')

    // Sync history entry exists
    const syncEntry = histRepo._all().find(
      (e: any) => e.entity_type === 'property' && e.triggered_by === 'sync' && e.to_stage === 'invalida'
    )
    expect(syncEntry).toBeDefined()
  })

  it('sad path: property lost after captation → lead becomes perdido', async () => {
    const leadRepo = makeFakeLeadRepo()
    const propRepo = makeFakePropertyRepo()
    const histRepo = makeFakeHistoryRepo()
    const { propUC } = makeWiredUseCases(leadRepo, propRepo, histRepo)

    const ORG = 'O1'

    // Lead already in 'captado', property already in 'captada'
    leadRepo._seed(makeLeadEntity('L1', ORG, 'captado'))
    propRepo._seed({ id: 'P1', org_id: ORG, commercial_stage: 'captada', lead_id: 'L1' })

    // Property moves through funnel then goes lost
    await propUC.execute({ propertyId: 'P1', orgId: ORG, newStage: 'publicada', changedBy: 'agent1' })
    const perdidaOut = await propUC.execute({ propertyId: 'P1', orgId: ORG, newStage: 'perdida', changedBy: 'agent1' })

    // Lead synced: captado → perdido
    expect(perdidaOut.syncedLeadId).toBe('L1')
    const lead = await leadRepo.findById('L1', ORG)
    expect(lead.stage).toBe('perdido')

    // Property is terminal
    const prop = await propRepo.findById('P1', ORG)
    expect(prop.commercial_stage).toBe('perdida')

    // Sync history entry exists
    const syncEntry = histRepo._all().find(
      (e: any) => e.entity_type === 'lead' && e.triggered_by === 'sync' && e.to_stage === 'perdido'
    )
    expect(syncEntry).toBeDefined()
  })

  it('stage_history records both user and sync triggers in correct order', async () => {
    const leadRepo = makeFakeLeadRepo()
    const propRepo = makeFakePropertyRepo()
    const histRepo = makeFakeHistoryRepo()
    const { leadUC, propUC } = makeWiredUseCases(leadRepo, propRepo, histRepo)

    const ORG = 'O1'

    leadRepo._seed(makeLeadEntity('L1', ORG, 'nuevo'))

    // Lead: nuevo → asignado → contactado → calificado → en_tasacion
    await leadUC.execute({ leadId: 'L1', orgId: ORG, newStage: 'asignado',    changedBy: 'agent1' })
    await leadUC.execute({ leadId: 'L1', orgId: ORG, newStage: 'contactado',  changedBy: 'agent1' })
    await leadUC.execute({ leadId: 'L1', orgId: ORG, newStage: 'calificado',  changedBy: 'agent1' })
    await leadUC.execute({ leadId: 'L1', orgId: ORG, newStage: 'en_tasacion', changedBy: 'agent1' })

    // Property enters pipeline in propuesta
    propRepo._seed({ id: 'P1', org_id: ORG, commercial_stage: 'propuesta', lead_id: 'L1' })

    // Lead: en_tasacion → presentada → captado (triggers property sync propuesta→captada)
    await leadUC.execute({ leadId: 'L1', orgId: ORG, newStage: 'presentada', changedBy: 'agent1' })
    await leadUC.execute({ leadId: 'L1', orgId: ORG, newStage: 'captado',    changedBy: 'agent1' })

    // Property: captada → publicada → reservada → vendida (triggers lead sync captado→finalizado)
    await propUC.execute({ propertyId: 'P1', orgId: ORG, newStage: 'publicada', changedBy: 'agent1' })
    await propUC.execute({ propertyId: 'P1', orgId: ORG, newStage: 'reservada', changedBy: 'agent1' })
    await propUC.execute({ propertyId: 'P1', orgId: ORG, newStage: 'vendida',   changedBy: 'agent1' })

    const history = histRepo._all()

    // All lead user-driven transitions should have triggered_by: 'user'
    const leadUserEntries = history.filter(
      (e: any) => e.entity_type === 'lead' && e.triggered_by === 'user'
    )
    expect(leadUserEntries.length).toBe(6) // nuevo→asignado, asignado→contactado, contactado→calificado, calificado→en_tasacion, en_tasacion→presentada, presentada→captado

    // Lead stage sequence (user)
    const leadUserStages = leadUserEntries.map((e: any) => ({ from: e.from_stage, to: e.to_stage }))
    expect(leadUserStages).toEqual([
      { from: 'nuevo',       to: 'asignado'    },
      { from: 'asignado',    to: 'contactado'  },
      { from: 'contactado',  to: 'calificado'  },
      { from: 'calificado',  to: 'en_tasacion' },
      { from: 'en_tasacion', to: 'presentada'  },
      { from: 'presentada',  to: 'captado'     },
    ])

    // Property sync from lead captado: propuesta → captada
    const propSyncByCaptado = history.find(
      (e: any) =>
        e.entity_type === 'property' &&
        e.triggered_by === 'sync' &&
        e.from_stage === 'propuesta' &&
        e.to_stage === 'captada'
    )
    expect(propSyncByCaptado).toBeDefined()

    // All property user-driven transitions (captada→publicada, publicada→reservada, reservada→vendida)
    const propUserEntries = history.filter(
      (e: any) => e.entity_type === 'property' && e.triggered_by === 'user'
    )
    expect(propUserEntries.length).toBe(3)
    const propUserStages = propUserEntries.map((e: any) => ({ from: e.from_stage, to: e.to_stage }))
    expect(propUserStages).toEqual([
      { from: 'captada',   to: 'publicada' },
      { from: 'publicada', to: 'reservada' },
      { from: 'reservada', to: 'vendida'   },
    ])

    // Lead sync from property vendida: captado → finalizado
    const leadSyncByVendida = history.find(
      (e: any) =>
        e.entity_type === 'lead' &&
        e.triggered_by === 'sync' &&
        e.from_stage === 'captado' &&
        e.to_stage === 'finalizado'
    )
    expect(leadSyncByVendida).toBeDefined()

    // Verify relative ordering: property sync (propuesta→captada) comes before property user entries
    const propSyncIdx   = history.indexOf(propSyncByCaptado)
    const firstPropUser = history.indexOf(propUserEntries[0])
    expect(propSyncIdx).toBeLessThan(firstPropUser)

    // Verify relative ordering: lead sync (captado→finalizado) comes after all property user entries
    const leadSyncIdx    = history.indexOf(leadSyncByVendida)
    const lastPropUser   = history.indexOf(propUserEntries[propUserEntries.length - 1])
    expect(leadSyncIdx).toBeGreaterThan(lastPropUser)
  })
})
