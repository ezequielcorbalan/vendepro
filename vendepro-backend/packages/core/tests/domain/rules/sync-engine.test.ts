import { describe, it, expect } from 'vitest'
import { SyncEngine } from '../../../src/domain/rules/sync-engine'

describe('SyncEngine', () => {
  describe('applyLeadToProperty', () => {
    it('returns captada when lead→captado and property in propuesta', () => {
      const result = SyncEngine.applyLeadToProperty('captado', 'propuesta')
      expect(result).toBe('captada')
    })

    it('returns null when lead→captado but property already in publicada', () => {
      const result = SyncEngine.applyLeadToProperty('captado', 'publicada')
      expect(result).toBeNull()
    })

    it('returns invalida when lead→invalido and property is non-final', () => {
      expect(SyncEngine.applyLeadToProperty('invalido', 'propuesta')).toBe('invalida')
      expect(SyncEngine.applyLeadToProperty('invalido', 'captada')).toBe('invalida')
      expect(SyncEngine.applyLeadToProperty('invalido', 'publicada')).toBe('invalida')
    })

    it('returns null when lead→invalido but property already final', () => {
      expect(SyncEngine.applyLeadToProperty('invalido', 'vendida')).toBeNull()
      expect(SyncEngine.applyLeadToProperty('invalido', 'archivada')).toBeNull()
    })

    it('returns null for lead stages that have no rule (e.g. presentada)', () => {
      expect(SyncEngine.applyLeadToProperty('presentada', 'propuesta')).toBeNull()
    })

    it('returns null when property is null (lead has no associated property)', () => {
      expect(SyncEngine.applyLeadToProperty('captado', null)).toBeNull()
    })
  })

  describe('applyPropertyToLead', () => {
    it('returns finalizado when property→vendida and lead is captado', () => {
      expect(SyncEngine.applyPropertyToLead('vendida', 'captado')).toBe('finalizado')
    })

    it('returns perdido when property→perdida and lead is captado', () => {
      expect(SyncEngine.applyPropertyToLead('perdida', 'captado')).toBe('perdido')
    })

    it('returns null when property→vendida but lead is not captado', () => {
      expect(SyncEngine.applyPropertyToLead('vendida', 'presentada')).toBeNull()
    })

    it('returns null when property→publicada (no rule)', () => {
      expect(SyncEngine.applyPropertyToLead('publicada', 'captado')).toBeNull()
    })

    it('returns null when lead is null', () => {
      expect(SyncEngine.applyPropertyToLead('vendida', null)).toBeNull()
    })
  })
})
