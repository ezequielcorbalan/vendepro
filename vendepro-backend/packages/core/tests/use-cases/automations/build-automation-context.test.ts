import { describe, it, expect, vi } from 'vitest'
import { BuildAutomationContextUseCase } from '../../../src/application/use-cases/automations/build-automation-context'

function builder(property: Record<string, unknown> | null) {
  const none = { findById: vi.fn().mockResolvedValue(null) }
  return new BuildAutomationContextUseCase(
    none as any,
    none as any,
    { findById: vi.fn().mockResolvedValue(property) } as any,
    none as any,
    none as any,
  )
}

const baseProperty = {
  id: 'prop-1',
  address: 'La Rioja 1082',
  property_type: 'departamento',
  rooms: 3,
  neighborhood: 'Balvanera',
  agent_id: null,
  owner_email: null,
}

describe('BuildAutomationContextUseCase — autorización', () => {
  it('expone vencimiento y días que faltan (día de Argentina)', async () => {
    const ctx = await builder({ ...baseProperty, auth_start_date: '2026-07-01', auth_duration_days: 120 })
      // 02:00 UTC del 23-oct = 23:00 del 22-oct en Argentina.
      .execute({ orgId: 'org', entityType: 'property', entityId: 'prop-1', now: new Date('2026-10-23T02:00:00Z') })

    expect((ctx.property as any).auth_expires_at).toBe('29/10/2026')
    expect((ctx.property as any).auth_days_left).toBe(7)
  })

  it('sin fecha de inicio quedan vacías', async () => {
    const ctx = await builder({ ...baseProperty, auth_start_date: null, auth_duration_days: 180 })
      .execute({ orgId: 'org', entityType: 'property', entityId: 'prop-1' })

    expect((ctx.property as any).auth_expires_at).toBeNull()
    expect((ctx.property as any).auth_days_left).toBeNull()
  })
})
