import { describe, it, expect } from 'vitest'
import { LandingStatus, LANDING_STATUSES } from '../../src/domain/value-objects/landing-status'

describe('LandingStatus', () => {
  it('acepta los 4 estados válidos', () => {
    for (const s of LANDING_STATUSES) {
      expect(LandingStatus.create(s).value).toBe(s)
    }
  })

  it('rechaza estado inválido', () => {
    expect(() => LandingStatus.create('foobar')).toThrow()
  })

  it('draft → pending_review | archived permitido', () => {
    const s = LandingStatus.create('draft')
    expect(s.canTransitionTo('pending_review')).toBe(true)
    expect(s.canTransitionTo('archived')).toBe(true)
    expect(s.canTransitionTo('published')).toBe(false)
  })

  it('pending_review → published | draft permitido', () => {
    const s = LandingStatus.create('pending_review')
    expect(s.canTransitionTo('published')).toBe(true)
    expect(s.canTransitionTo('draft')).toBe(true)
    expect(s.canTransitionTo('archived')).toBe(false)
  })

  it('published → archived | draft permitido', () => {
    const s = LandingStatus.create('published')
    expect(s.canTransitionTo('archived')).toBe(true)
    expect(s.canTransitionTo('draft')).toBe(true)
  })

  it('archived → draft permitido (unarchive)', () => {
    const s = LandingStatus.create('archived')
    expect(s.canTransitionTo('draft')).toBe(true)
    expect(s.canTransitionTo('published')).toBe(false)
  })

  it('transitionTo devuelve nuevo VO con estado final', () => {
    const s = LandingStatus.create('draft').transitionTo('pending_review')
    expect(s.value).toBe('pending_review')
  })

  it('transitionTo lanza si transición inválida', () => {
    expect(() => LandingStatus.create('draft').transitionTo('published')).toThrow()
  })
})
