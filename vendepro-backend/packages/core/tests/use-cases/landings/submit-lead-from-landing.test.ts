import { describe, it, expect, vi } from 'vitest'
import { SubmitLeadFromLandingUseCase } from '../../../src/application/use-cases/landings/submit-lead-from-landing'
import { Landing } from '../../../src/domain/entities/landing'
import type { Block } from '../../../src/domain/value-objects/block-schemas'
import { Lead } from '../../../src/domain/entities/lead'

const blocks: Block[] = [
  { id: 'b_h', type: 'hero', visible: true, data: { title: 't', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 } },
  { id: 'b_f', type: 'lead-form', visible: true, data: { title: 'c', fields: [{ key: 'name', label: 'N', required: true }, { key: 'phone', label: 'T', required: true }], submit_label: 'E', success_message: '¡Listo!' } },
]

function setup(options?: { ruleAgent?: string }) {
  const base = Landing.create({ id: 'l1', org_id: 'o1', agent_id: 'u1', template_id: 't1', kind: 'property', slug_base: 'pal', slug_suffix: 'abc23', blocks, lead_rules: options?.ruleAgent ? { assigned_agent_id: options.ruleAgent } : null })
  const published = base.transitionStatus('pending_review').markPublished({ version_id: 'v0', published_by: 'adm' })
  const landings = { findByFullSlug: vi.fn(async () => published), findById: vi.fn(), findByOrg: vi.fn(), save: vi.fn(), existsFullSlug: vi.fn() }
  const events = { save: vi.fn(), countByIpInWindow: vi.fn(), summary: vi.fn(), recentByType: vi.fn() }
  const savedLeads: Lead[] = []
  const leads = { save: vi.fn(async (l: Lead) => { savedLeads.push(l) }), findById: vi.fn(), findByOrg: vi.fn(), delete: vi.fn(), searchByName: vi.fn(), findPendingFollowups: vi.fn(), exportAllWithAssignedName: vi.fn() }
  let n = 0
  const idGen = { generate: vi.fn(() => `id_${++n}`) }
  return { landings, events, leads, idGen, savedLeads }
}

describe('SubmitLeadFromLandingUseCase', () => {
  it('crea lead y event, retorna success message', async () => {
    const d = setup()
    const uc = new SubmitLeadFromLandingUseCase(d.landings as any, d.events as any, d.leads as any, d.idGen as any)
    const r = await uc.execute({ fullSlug: 'pal-abc23', fields: { name: 'Juan', phone: '1122334455' } })
    expect(r.successMessage).toBe('¡Listo!')
    expect(d.leads.save).toHaveBeenCalled()
    expect(d.events.save).toHaveBeenCalled()
    expect(d.savedLeads[0].toObject().source).toBe('landing:pal-abc23')
    expect(d.savedLeads[0].toObject().assigned_to).toBe('u1')
  })

  it('respeta lead_rules.assigned_agent_id', async () => {
    const d = setup({ ruleAgent: 'u_assigned' })
    const uc = new SubmitLeadFromLandingUseCase(d.landings as any, d.events as any, d.leads as any, d.idGen as any)
    await uc.execute({ fullSlug: 'pal-abc23', fields: { name: 'Ana', phone: '123' } })
    expect(d.savedLeads[0].toObject().assigned_to).toBe('u_assigned')
  })

  it('rechaza si landing no publicada', async () => {
    const d = setup()
    d.landings.findByFullSlug = vi.fn(async () => null)
    const uc = new SubmitLeadFromLandingUseCase(d.landings as any, d.events as any, d.leads as any, d.idGen as any)
    await expect(uc.execute({ fullSlug: 'xxx', fields: { name: 'x', phone: 'y' } })).rejects.toThrow()
  })

  it('requiere name y phone', async () => {
    const d = setup()
    const uc = new SubmitLeadFromLandingUseCase(d.landings as any, d.events as any, d.leads as any, d.idGen as any)
    await expect(uc.execute({ fullSlug: 'pal-abc23', fields: { name: '', phone: '1' } })).rejects.toThrow(/Nombre/)
    await expect(uc.execute({ fullSlug: 'pal-abc23', fields: { name: 'a', phone: '' } })).rejects.toThrow(/Tel/)
  })
})
