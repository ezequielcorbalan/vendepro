import { describe, it, expect } from 'vitest'
import { canSeeAll, canManageOrg, canManageAgents, canSetObjectives, isAdmin } from '../../src/domain/rules/role-rules'

describe('Role rules', () => {
  describe('canSeeAll', () => {
    it('admin can see all', () => expect(canSeeAll('admin')).toBe(true))
    it('owner can see all', () => expect(canSeeAll('owner')).toBe(true))
    it('supervisor can see all', () => expect(canSeeAll('supervisor')).toBe(true))
    it('agent cannot see all', () => expect(canSeeAll('agent')).toBe(false))
  })

  describe('canManageOrg', () => {
    it('admin can manage org', () => expect(canManageOrg('admin')).toBe(true))
    it('owner can manage org', () => expect(canManageOrg('owner')).toBe(true))
    it('supervisor cannot manage org', () => expect(canManageOrg('supervisor')).toBe(false))
    it('agent cannot manage org', () => expect(canManageOrg('agent')).toBe(false))
  })

  describe('canManageAgents', () => {
    it('admin can manage agents', () => expect(canManageAgents('admin')).toBe(true))
    it('supervisor cannot manage agents', () => expect(canManageAgents('supervisor')).toBe(false))
  })

  describe('canSetObjectives', () => {
    it('supervisor can set objectives', () => expect(canSetObjectives('supervisor')).toBe(true))
    it('agent cannot set objectives for others', () => expect(canSetObjectives('agent')).toBe(false))
  })

  describe('isAdmin', () => {
    it('admin is admin', () => expect(isAdmin('admin')).toBe(true))
    it('owner is admin', () => expect(isAdmin('owner')).toBe(true))
    it('agent is not admin', () => expect(isAdmin('agent')).toBe(false))
  })
})
