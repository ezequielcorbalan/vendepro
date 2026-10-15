import { describe, it, expect } from 'vitest'
import { puedeVerConversacion, puedeAsignarConversacion, bandejaDe } from '../../../src/domain/rules/conversation-access'

const admin = { role: 'admin', userId: 'admin-1' }
const supervisor = { role: 'supervisor', userId: 'sup-1' }
const agente = { role: 'agent', userId: 'agent-1' }

describe('puedeVerConversacion', () => {
  it('admin y supervisor ven cualquiera', () => {
    expect(puedeVerConversacion(admin, 'agent-2')).toBe(true)
    expect(puedeVerConversacion(supervisor, null)).toBe(true)
  })
  it('el agente ve las suyas', () => {
    expect(puedeVerConversacion(agente, 'agent-1')).toBe(true)
  })
  // El hueco que tapa: antes cualquier agente leía cualquier hilo por id.
  it('el agente NO ve las de otro', () => {
    expect(puedeVerConversacion(agente, 'agent-2')).toBe(false)
  })
  it('el agente NO ve la cola', () => {
    expect(puedeVerConversacion(agente, null)).toBe(false)
  })
})

describe('puedeAsignarConversacion', () => {
  it('admin delega a quien quiera', () => {
    expect(puedeAsignarConversacion(admin, null, 'agent-1')).toBe(true)
  })
  it('el agente puede devolver la suya a la cola', () => {
    expect(puedeAsignarConversacion(agente, 'agent-1', null)).toBe(true)
  })
  it('el agente no puede pasársela a otro', () => {
    expect(puedeAsignarConversacion(agente, 'agent-1', 'agent-2')).toBe(false)
  })
  it('el agente no puede agarrar una ajena', () => {
    expect(puedeAsignarConversacion(agente, 'agent-2', 'agent-1')).toBe(false)
  })
})

describe('bandejaDe', () => {
  it('todas para quien ve todo, las propias para el agente', () => {
    expect(bandejaDe(admin)).toBeUndefined()
    expect(bandejaDe(agente)).toBe('agent-1')
  })
})
