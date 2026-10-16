import { describe, it, expect, vi } from 'vitest'
import { MarkPropertyReservedUseCase } from '../../../src/application/use-cases/properties/mark-property-reserved'
import { applyDocumentToDocStatus } from '../../../src/domain/rules/document-checklist'

function build(stage: string | null, over: Record<string, any> = {}) {
  const property = { id: 'p', commercial_stage: stage, agent_id: 'agent-1', lead_id: null, ...(over.property ?? {}) }
  const properties = {
    findById: vi.fn().mockResolvedValue(over.missing ? null : property),
    updateStage: vi.fn().mockResolvedValue(undefined),
  }
  const history = { log: vi.fn().mockResolvedValue(undefined) }
  return { uc: new MarkPropertyReservedUseCase(properties as any, history as any), properties, history }
}

describe('MarkPropertyReservedUseCase', () => {
  it('una reserva pasa a "Reservada" aunque la propiedad no estuviera publicada', async () => {
    const { uc, properties, history } = build('captada')
    const out = await uc.execute({ orgId: 'org', propertyId: 'p', triggeredBy: 'system', reason: 'Leída una reserva en Drive: Reserva.pdf' })
    expect(out).toEqual({ moved: true, from: 'captada' })
    expect(properties.updateStage).toHaveBeenCalledWith('p', 'org', 'reservada')
    expect(history.log).toHaveBeenCalledWith(expect.objectContaining({
      from_stage: 'captada', to_stage: 'reservada', triggered_by: 'system',
      changed_by: 'agent-1', notes: 'Leída una reserva en Drive: Reserva.pdf',
    }))
  })

  it('a mano queda a nombre de quien la cargó', async () => {
    const { uc, history } = build('publicada')
    await uc.execute({ orgId: 'org', propertyId: 'p', changedBy: 'user-9', triggeredBy: 'user', reason: 'Se cargó la reserva' })
    expect(history.log).toHaveBeenCalledWith(expect.objectContaining({ changed_by: 'user-9', triggered_by: 'user' }))
  })

  it.each(['reservada', 'vendida', 'perdida', 'archivada', 'invalida'])('no toca una propiedad %s', async (stage) => {
    const { uc, properties } = build(stage)
    const out = await uc.execute({ orgId: 'org', propertyId: 'p', triggeredBy: 'system', reason: 'x' })
    expect(out.moved).toBe(false)
    expect(properties.updateStage).not.toHaveBeenCalled()
  })

  it('sin propiedad o sin a quién atribuirlo, no hace nada', async () => {
    expect((await build('publicada', { missing: true }).uc.execute({ orgId: 'o', propertyId: 'p', triggeredBy: 'system', reason: 'x' })).moved).toBe(false)
    expect((await build('publicada', { property: { agent_id: null } }).uc.execute({ orgId: 'o', propertyId: 'p', triggeredBy: 'system', reason: 'x' })).moved).toBe(false)
  })
})

describe('la reserva no es parte del checklist de documentación', () => {
  it('recibirla no suma un ítem al checklist manual', () => {
    expect(applyDocumentToDocStatus(null, { type: 'reserva' })).toBeNull()
  })
})
