import { describe, it, expect } from 'vitest'
import { alcanceDe, puedeVerRegistro, duenoAlCrear } from '../../../src/domain/rules/data-access'

const owner = { role: 'owner', userId: 'owner-1' }
const admin = { role: 'admin', userId: 'admin-1' }
const supervisor = { role: 'supervisor', userId: 'sup-1' }
const agente = { role: 'agent', userId: 'agent-1' }

describe('alcanceDe', () => {
  it('quien ve todo recibe toda la org, o el agente que pidió', () => {
    expect(alcanceDe(admin)).toBeUndefined()
    expect(alcanceDe(owner, '')).toBeUndefined()
    expect(alcanceDe(supervisor, 'agent-2')).toBe('agent-2')
  })
  // El hueco: sacar o cambiar ?agent_id devolvía los datos de toda la inmobiliaria.
  it('el agente siempre recibe lo suyo, pida lo que pida', () => {
    expect(alcanceDe(agente)).toBe('agent-1')
    expect(alcanceDe(agente, 'agent-2')).toBe('agent-1')
  })
})

describe('puedeVerRegistro', () => {
  it('owner, admin y supervisor ven cualquiera', () => {
    for (const a of [owner, admin, supervisor]) expect(puedeVerRegistro(a, 'agent-2')).toBe(true)
  })
  it('el agente ve lo suyo y nada más', () => {
    expect(puedeVerRegistro(agente, 'agent-1')).toBe(true)
    expect(puedeVerRegistro(agente, 'agent-2')).toBe(false)
    expect(puedeVerRegistro(agente, null)).toBe(false)
  })
})

describe('duenoAlCrear', () => {
  it('quien reparte puede crear a nombre de otro', () => {
    expect(duenoAlCrear(admin, 'agent-2')).toBe('agent-2')
    expect(duenoAlCrear(admin)).toBe('admin-1')
  })
  it('el agente crea para sí', () => {
    expect(duenoAlCrear(agente, 'agent-2')).toBe('agent-1')
  })
})
