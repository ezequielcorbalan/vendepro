import { describe, it, expect } from 'vitest'
import { canTransitionReservationStage } from '../../src/domain/rules/reservation-rules'

describe('Reservation rules — canTransitionReservationStage', () => {
  it('reservada -> boleto allowed', () => {
    expect(canTransitionReservationStage('reservada', 'boleto')).toBe(true)
  })

  it('reservada -> cancelada allowed', () => {
    expect(canTransitionReservationStage('reservada', 'cancelada')).toBe(true)
  })

  it('reservada -> rechazada allowed', () => {
    expect(canTransitionReservationStage('reservada', 'rechazada')).toBe(true)
  })

  it('reservada -> escritura not allowed (must go through boleto)', () => {
    expect(canTransitionReservationStage('reservada', 'escritura')).toBe(false)
  })

  it('boleto -> escritura allowed', () => {
    expect(canTransitionReservationStage('boleto', 'escritura')).toBe(true)
  })

  it('boleto -> cancelada allowed', () => {
    expect(canTransitionReservationStage('boleto', 'cancelada')).toBe(true)
  })

  it('boleto -> rechazada not allowed', () => {
    expect(canTransitionReservationStage('boleto', 'rechazada')).toBe(false)
  })

  it('escritura -> entregada allowed', () => {
    expect(canTransitionReservationStage('escritura', 'entregada')).toBe(true)
  })

  it('escritura -> cancelada allowed', () => {
    expect(canTransitionReservationStage('escritura', 'cancelada')).toBe(true)
  })

  it('entregada is terminal', () => {
    expect(canTransitionReservationStage('entregada', 'escritura')).toBe(false)
    expect(canTransitionReservationStage('entregada', 'cancelada')).toBe(false)
  })

  it('cancelada is terminal', () => {
    expect(canTransitionReservationStage('cancelada', 'reservada')).toBe(false)
    expect(canTransitionReservationStage('cancelada', 'boleto')).toBe(false)
  })

  it('rechazada is terminal', () => {
    expect(canTransitionReservationStage('rechazada', 'reservada')).toBe(false)
    expect(canTransitionReservationStage('rechazada', 'boleto')).toBe(false)
  })

  it('returns false for unknown source stage', () => {
    expect(canTransitionReservationStage('bogus' as never, 'boleto')).toBe(false)
  })
})
