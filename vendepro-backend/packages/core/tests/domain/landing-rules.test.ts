import { describe, it, expect } from 'vitest'
import { canEditLanding, canPublish, canRequestPublish, canArchive, canRollback } from '../../src/domain/rules/landing-rules'

describe('landing-rules', () => {
  describe('canEditLanding', () => {
    it('owner puede editar su landing en draft', () => {
      expect(canEditLanding({ role: 'agent', userId: 'u1' }, { agent_id: 'u1', status: 'draft' })).toBe(true)
    })
    it('owner puede editar en pending_review', () => {
      expect(canEditLanding({ role: 'agent', userId: 'u1' }, { agent_id: 'u1', status: 'pending_review' })).toBe(true)
    })
    it('agente no puede editar ajena', () => {
      expect(canEditLanding({ role: 'agent', userId: 'u2' }, { agent_id: 'u1', status: 'draft' })).toBe(false)
    })
    it('admin puede editar cualquier landing', () => {
      expect(canEditLanding({ role: 'admin', userId: 'adm' }, { agent_id: 'u1', status: 'draft' })).toBe(true)
    })
    it('nadie edita publicada sin pasarla a draft primero', () => {
      expect(canEditLanding({ role: 'agent', userId: 'u1' }, { agent_id: 'u1', status: 'published' })).toBe(false)
    })
  })

  describe('canPublish', () => {
    it('solo admin', () => {
      expect(canPublish({ role: 'admin', userId: 'adm' })).toBe(true)
      expect(canPublish({ role: 'agent', userId: 'u1' })).toBe(false)
    })
  })

  describe('canRequestPublish', () => {
    it('owner de landing en draft', () => {
      expect(canRequestPublish({ role: 'agent', userId: 'u1' }, { agent_id: 'u1', status: 'draft' })).toBe(true)
    })
    it('no desde pending_review', () => {
      expect(canRequestPublish({ role: 'agent', userId: 'u1' }, { agent_id: 'u1', status: 'pending_review' })).toBe(false)
    })
    it('admin también puede pedir publicación (edge case: flow unificado)', () => {
      expect(canRequestPublish({ role: 'admin', userId: 'a' }, { agent_id: 'u1', status: 'draft' })).toBe(true)
    })
  })

  describe('canArchive', () => {
    it('owner y admin', () => {
      expect(canArchive({ role: 'agent', userId: 'u1' }, { agent_id: 'u1' })).toBe(true)
      expect(canArchive({ role: 'agent', userId: 'u2' }, { agent_id: 'u1' })).toBe(false)
      expect(canArchive({ role: 'admin', userId: 'adm' }, { agent_id: 'u1' })).toBe(true)
    })
  })

  describe('canRollback', () => {
    it('owner en draft', () => {
      expect(canRollback({ role: 'agent', userId: 'u1' }, { agent_id: 'u1', status: 'draft' })).toBe(true)
    })
    it('agente en published: no', () => {
      expect(canRollback({ role: 'agent', userId: 'u1' }, { agent_id: 'u1', status: 'published' })).toBe(false)
    })
    it('admin siempre', () => {
      expect(canRollback({ role: 'admin', userId: 'adm' }, { agent_id: 'u1', status: 'published' })).toBe(true)
    })
  })
})
