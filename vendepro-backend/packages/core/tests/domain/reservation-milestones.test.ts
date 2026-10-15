import { describe, it, expect, vi } from 'vitest'
import {
  computeReservationMilestones,
  nextReservationMilestone,
  isReservationClosed,
} from '../../src/domain/rules/reservation-milestones'
import { GetPublicDocPortalUseCase } from '../../src/application/use-cases/doc-portal/public-doc-portal'

const dates = {
  acceptance_deadline: '2026-10-20',
  boleto_date: '2026-11-05',
  escritura_date: '2026-12-15',
  delivery_date: '2026-12-15',
}

describe('computeReservationMilestones', () => {
  it('recién reservada: todo pendiente, cuenta regresiva hasta la aceptación', () => {
    const m = computeReservationMilestones({ stage: 'reservada', ...dates }, '2026-10-15')
    expect(m.map((x) => x.done)).toEqual([false, false, false, false])
    expect(m[0]).toMatchObject({ key: 'aceptacion', days_left: 5, overdue: false })
    expect(nextReservationMilestone(m)?.key).toBe('aceptacion')
  })

  it('aceptada: el próximo es el boleto', () => {
    const m = computeReservationMilestones({ stage: 'reservada', accepted_at: '2026-10-16', ...dates }, '2026-10-17')
    expect(m[0].done).toBe(true)
    expect(m[0].days_left).toBeNull()
    expect(nextReservationMilestone(m)).toMatchObject({ key: 'boleto', days_left: 19 })
  })

  it('con boleto firmado la aceptación cuenta como hecha aunque no se haya marcado', () => {
    const m = computeReservationMilestones({ stage: 'boleto', ...dates }, '2026-11-10')
    expect(m.slice(0, 2).every((x) => x.done)).toBe(true)
    expect(nextReservationMilestone(m)?.key).toBe('escritura')
  })

  it('un plazo pasado sin cumplirse queda vencido', () => {
    const m = computeReservationMilestones({ stage: 'reservada', ...dates }, '2026-10-22')
    expect(m[0]).toMatchObject({ overdue: true, days_left: -2 })
  })

  it('entregada: no queda nada pendiente', () => {
    const m = computeReservationMilestones({ stage: 'entregada', ...dates }, '2027-01-01')
    expect(nextReservationMilestone(m)).toBeNull()
  })

  it('un hito sin fecha cargada no tiene cuenta regresiva', () => {
    const m = computeReservationMilestones({ stage: 'reservada', acceptance_deadline: null }, '2026-10-15')
    expect(m[0]).toMatchObject({ date: null, days_left: null, overdue: false })
  })

  it('cancelada o rechazada = cerrada', () => {
    expect(isReservationClosed('cancelada')).toBe(true)
    expect(isReservationClosed('boleto')).toBe(false)
  })
})

describe('GetPublicDocPortalUseCase — portal ampliado', () => {
  function build(over: Record<string, any> = {}) {
    const link = {
      id: 'l', org_id: 'org', property_id: 'p', agent_id: 'a', token: 't', operation: 'venta',
      property_kind: 'depto', succession: 'no', married: null, revoked_at: null,
    }
    const property = {
      id: 'p', address: 'Inexistente 99999', owner_name: 'Ana', agent_id: 'a', status: 'active',
      auth_start_date: '2026-09-01', auth_duration_days: 90, ...(over.property ?? {}),
    }
    const reservation = over.reservation === undefined
      ? { stage: 'reservada', accepted_at: null, offer_amount: 150000, offer_currency: 'USD', reservation_date: '2026-10-10', buyer_name: 'Comprador X', ...dates }
      : over.reservation
    return new GetPublicDocPortalUseCase(
      { findByToken: vi.fn().mockResolvedValue(link) } as any,
      { listByProperty: vi.fn().mockResolvedValue([]) } as any,
      { findById: vi.fn().mockResolvedValue(property) } as any,
      { findById: vi.fn().mockResolvedValue({ name: 'Inmo', logo_url: null, brand_color: null }) } as any,
      { findById: vi.fn().mockResolvedValue(null) } as any,
      {
        reservations: { findActiveByProperty: vi.fn().mockResolvedValue(reservation) } as any,
        reports: {
          findByProperty: vi.fn().mockResolvedValue([
            { status: 'published', public_slug: 'oct-26', period_label: 'Octubre 2026', published_at: '2026-10-05' },
            { status: 'draft', public_slug: 'nov-26', period_label: 'Noviembre 2026', published_at: null },
          ]),
        } as any,
        today: () => '2026-10-15',
      },
    )
  }

  it('suma la reserva con sus hitos, sin datos del comprador', async () => {
    const view = await build().execute('t')
    expect(view.reservation?.next).toMatchObject({ key: 'aceptacion', days_left: 5 })
    expect(view.reservation?.offer_amount).toBe(150000)
    expect(JSON.stringify(view)).not.toContain('Comprador X')
  })

  it('la autorización muestra hasta cuándo rige', async () => {
    const view = await build().execute('t')
    expect(view.authorization).toEqual({ start_date: '2026-09-01', end_date: '2026-11-30', days_left: 46 })
  })

  it('sólo muestra los reportes publicados', async () => {
    const view = await build().execute('t')
    expect(view.reports).toEqual([{ period_label: 'Octubre 2026', url: '/r/oct-26', published_at: '2026-10-05' }])
  })

  it('sin reserva ni autorización, esas secciones no aparecen', async () => {
    const view = await build({ reservation: null, property: { auth_start_date: null } }).execute('t')
    expect(view.reservation).toBeNull()
    expect(view.authorization).toBeNull()
  })
})
