import { describe, it, expect } from 'vitest'
import { debeRecibir } from '../../../src/domain/rules/realtime-access'

const admin = { userId: 'admin-1', veTodo: true }
const agente = { userId: 'agent-1', veTodo: false }

describe('debeRecibir', () => {
  const mensaje = (assigneeId: string | null, previoAssigneeId?: string | null) =>
    ({ tipo: 'conversacion' as const, conversationId: 'c1', assigneeId, previoAssigneeId })

  it('quien ve todo recibe cualquier conversación, incluso sin asignar', () => {
    expect(debeRecibir(admin, mensaje(null))).toBe(true)
    expect(debeRecibir(admin, mensaje('agent-2'))).toBe(true)
  })

  it('el agente recibe lo suyo', () => {
    expect(debeRecibir(agente, mensaje('agent-1'))).toBe(true)
  })

  // El aviso no lleva el contenido, pero igual un agente no tiene por qué
  // enterarse de la actividad de conversaciones ajenas.
  it('el agente NO recibe lo de otros ni la cola', () => {
    expect(debeRecibir(agente, mensaje('agent-2'))).toBe(false)
    expect(debeRecibir(agente, mensaje(null))).toBe(false)
  })

  it('si le sacan una conversación, se entera para que desaparezca de su lista', () => {
    expect(debeRecibir(agente, mensaje('agent-2', 'agent-1'))).toBe(true)
  })

  it('los avisos de campana van sólo a sus destinatarios, aunque sea admin', () => {
    const aviso = { tipo: 'aviso' as const, userIds: ['agent-1'] }
    expect(debeRecibir(agente, aviso)).toBe(true)
    expect(debeRecibir(admin, aviso)).toBe(false)
  })
})
