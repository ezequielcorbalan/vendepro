import { describe, it, expect } from 'vitest'
import { LEAD_TO_PROPERTY_SYNC, PROPERTY_TO_LEAD_SYNC, NON_FINAL_PROPERTY_STAGES } from '../../../src/domain/rules/sync-policies'

describe('sync-policies', () => {
  it('declares lead→property rule for captado→captada', () => {
    const rule = LEAD_TO_PROPERTY_SYNC.find(r => r.when === 'captado')
    expect(rule).toBeDefined()
    expect(rule!.thenIfTargetIn).toEqual(['propuesta'])
    expect(rule!.setTargetTo).toBe('captada')
  })

  it('declares lead→property rule for invalido→invalida', () => {
    const rule = LEAD_TO_PROPERTY_SYNC.find(r => r.when === 'invalido')
    expect(rule).toBeDefined()
    expect(rule!.setTargetTo).toBe('invalida')
    expect(rule!.thenIfTargetIn).toEqual(NON_FINAL_PROPERTY_STAGES)
  })

  it('declares property→lead rule for vendida→finalizado', () => {
    const rule = PROPERTY_TO_LEAD_SYNC.find(r => r.when === 'vendida')
    expect(rule).toBeDefined()
    expect(rule!.thenIfTargetIn).toEqual(['captado'])
    expect(rule!.setTargetTo).toBe('finalizado')
  })

  it('declares property→lead rule for perdida→perdido', () => {
    const rule = PROPERTY_TO_LEAD_SYNC.find(r => r.when === 'perdida')
    expect(rule).toBeDefined()
    expect(rule!.setTargetTo).toBe('perdido')
  })

  it('NON_FINAL_PROPERTY_STAGES excludes terminals', () => {
    expect(NON_FINAL_PROPERTY_STAGES).not.toContain('vendida')
    expect(NON_FINAL_PROPERTY_STAGES).not.toContain('perdida')
    expect(NON_FINAL_PROPERTY_STAGES).not.toContain('invalida')
    expect(NON_FINAL_PROPERTY_STAGES).not.toContain('archivada')
    expect(NON_FINAL_PROPERTY_STAGES).toContain('propuesta')
    expect(NON_FINAL_PROPERTY_STAGES).toContain('captada')
  })
})
