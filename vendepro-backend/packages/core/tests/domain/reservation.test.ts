import { describe, it, expect } from 'vitest'
import { Reservation } from '../../src/domain/entities/reservation'
import { ValidationError } from '../../src/domain/errors/validation-error'

const baseProps = {
  id: 'res-1',
  org_id: 'org_mg',
  property_address: 'Av. Corrientes 1234',
  buyer_name: 'Juan Pérez',
  seller_name: 'María García',
  agent_id: 'agent-1',
  offer_amount: 120000,
  offer_currency: 'USD',
  reservation_date: '2026-04-15',
  stage: 'reservada' as const,
  notes: null,
}

describe('Reservation entity', () => {
  it('creates a valid reservation', () => {
    const res = Reservation.create(baseProps)
    expect(res.stage).toBe('reservada')
    expect(res.buyer_name).toBe('Juan Pérez')
    expect(res.created_at).toBeDefined()
  })

  it('throws for invalid stage', () => {
    expect(() => Reservation.create({ ...baseProps, stage: 'invalid' as any })).toThrow(ValidationError)
  })

  it('advances stage via valid transition', () => {
    const res = Reservation.create(baseProps)
    res.advanceStage('boleto')
    expect(res.stage).toBe('boleto')
  })

  it('throws for invalid stage transition', () => {
    const res = Reservation.create(baseProps)
    expect(() => res.advanceStage('entregada')).toThrow(ValidationError)
  })

  it('entregada is a final stage', () => {
    const res = Reservation.create({ ...baseProps, stage: 'entregada' })
    expect(() => res.advanceStage('boleto')).toThrow(ValidationError)
  })

  it('cancelada is a final stage', () => {
    const res = Reservation.create({ ...baseProps, stage: 'cancelada' })
    expect(() => res.advanceStage('boleto')).toThrow(ValidationError)
  })

  it('updates notes via update()', () => {
    const res = Reservation.create(baseProps)
    res.update({ notes: 'Escritura el 20/05' })
    expect(res.notes).toBe('Escritura el 20/05')
  })
})
