import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BuildAutomationContextUseCase } from '../../../src/application/use-cases/automations/build-automation-context'

const leads = { findById: vi.fn() }
const contacts = { findById: vi.fn() }
const properties = { findById: vi.fn() }
const users = { findById: vi.fn() }
const orgs = { findById: vi.fn() }
const appraisals = { findById: vi.fn() }

const LEAD = {
  id: 'lead-1',
  full_name: 'Ana Pérez',
  email: 'ana@mail.com',
  phone: '11 5555-5555',
  stage: 'en_tasacion',
  pipeline: 'vendedor',
  source: 'zonaprop',
  assigned_to: 'agent-lead',
  contact_id: null,
  created_at: '2026-09-01 10:00:00',
}

const APPRAISAL = {
  id: 'app-1',
  property_address: 'Av. Cabildo 1234',
  neighborhood: 'Belgrano',
  status: 'draft',
  suggested_price: 180000,
  public_slug: 'abc123',
  agent_id: 'agent-appraisal',
  lead_id: 'lead-1',
}

function useCase(withAppraisals = true) {
  return new BuildAutomationContextUseCase(
    leads as any, contacts as any, properties as any, users as any, orgs as any,
    withAppraisals ? (appraisals as any) : undefined,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  leads.findById.mockResolvedValue(null)
  contacts.findById.mockResolvedValue(null)
  properties.findById.mockResolvedValue(null)
  users.findById.mockResolvedValue(null)
  orgs.findById.mockResolvedValue(null)
  appraisals.findById.mockResolvedValue(null)
})

describe('BuildAutomationContextUseCase — eventos de tasación', () => {
  it('arma el scope appraisal con el link público y cuelga el lead', async () => {
    appraisals.findById.mockResolvedValue(APPRAISAL)
    leads.findById.mockResolvedValue(LEAD)
    users.findById.mockResolvedValue({ id: 'agent-appraisal', full_name: 'Marcela', email: 'm@mg.com', phone: null, role: 'admin' })

    const ctx = await useCase().execute({
      orgId: 'org_mg',
      entityType: 'appraisal',
      entityId: 'app-1',
      publicBaseUrl: 'https://www.marcelagenta.com/',
    })

    expect(ctx.appraisal).toMatchObject({
      id: 'app-1',
      address: 'Av. Cabildo 1234',
      public_url: 'https://www.marcelagenta.com/t/abc123',
    })
    expect((ctx.lead as any).full_name).toBe('Ana Pérez')
    // El agente del evento es el de la tasación, no el asignado del lead.
    expect(users.findById).toHaveBeenCalledWith('agent-appraisal', 'org_mg')
    expect((ctx.agent as any).full_name).toBe('Marcela')
  })

  it('sin slug público, public_url queda null', async () => {
    appraisals.findById.mockResolvedValue({ ...APPRAISAL, public_slug: null, lead_id: null })

    const ctx = await useCase().execute({
      orgId: 'org_mg',
      entityType: 'appraisal',
      entityId: 'app-1',
      publicBaseUrl: 'https://x.com',
    })

    expect((ctx.appraisal as any).public_url).toBeNull()
    expect(ctx.lead).toBeUndefined()
  })

  it('sin repositorio de tasaciones, el scope queda en blanco sin romper', async () => {
    const ctx = await useCase(false).execute({
      orgId: 'org_mg',
      entityType: 'appraisal',
      entityId: 'app-1',
    })

    expect(ctx.appraisal).toBeUndefined()
    expect(ctx.org).toBeDefined() // el resto del contexto se arma igual
  })

  it('un evento de lead sigue resolviendo el agente desde el lead', async () => {
    leads.findById.mockResolvedValue(LEAD)
    users.findById.mockResolvedValue({ id: 'agent-lead', full_name: 'Agente Lead', email: null, phone: null, role: 'agent' })

    const ctx = await useCase().execute({
      orgId: 'org_mg',
      entityType: 'lead',
      entityId: 'lead-1',
    })

    expect(users.findById).toHaveBeenCalledWith('agent-lead', 'org_mg')
    expect((ctx.lead as any).stage).toBe('en_tasacion')
  })
})
