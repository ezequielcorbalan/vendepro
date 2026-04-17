import { describe, it, expect } from 'vitest'
import { PasswordResetToken } from '../../src/domain/entities/password-reset-token'
import { ValidationError } from '../../src/domain/errors/validation-error'

const longToken = 'a'.repeat(32)

const base = {
  token: longToken,
  user_id: 'user-1',
  org_id: 'org_mg',
  expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // +1h
  used: false,
}

describe('PasswordResetToken entity', () => {
  it('creates a valid token', () => {
    const t = PasswordResetToken.create(base)
    expect(t.token).toBe(longToken)
    expect(t.user_id).toBe('user-1')
    expect(t.used).toBe(false)
    expect(t.created_at).toBeDefined()
  })

  it('rejects token shorter than 32 chars', () => {
    expect(() => PasswordResetToken.create({ ...base, token: 'short' })).toThrow(ValidationError)
    expect(() => PasswordResetToken.create({ ...base, token: 'a'.repeat(31) })).toThrow(ValidationError)
  })

  it('isExpired() returns false when now < expires_at', () => {
    const t = PasswordResetToken.create(base)
    expect(t.isExpired()).toBe(false)
  })

  it('isExpired() returns true when now > expires_at', () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const t = PasswordResetToken.create({ ...base, expires_at: past })
    expect(t.isExpired()).toBe(true)
  })

  it('canBeUsed() false when already used', () => {
    const t = PasswordResetToken.create({ ...base, used: true })
    expect(t.canBeUsed()).toBe(false)
  })

  it('canBeUsed() false when expired even if not used', () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const t = PasswordResetToken.create({ ...base, expires_at: past, used: false })
    expect(t.canBeUsed()).toBe(false)
  })

  it('canBeUsed() true when fresh and not used', () => {
    const t = PasswordResetToken.create(base)
    expect(t.canBeUsed()).toBe(true)
  })

  it('markUsed() returns a new instance with used=true and original unchanged', () => {
    const original = PasswordResetToken.create(base)
    const updated = original.markUsed()
    expect(updated).not.toBe(original)
    expect(updated.used).toBe(true)
    expect(original.used).toBe(false)
  })

  it('toObject round-trips', () => {
    const t = PasswordResetToken.create(base)
    const obj = t.toObject()
    expect(obj.token).toBe(base.token)
    expect(obj.user_id).toBe(base.user_id)
    expect(obj.org_id).toBe(base.org_id)
    expect(obj.expires_at).toBe(base.expires_at)
    expect(obj.used).toBe(false)
    expect(obj.created_at).toBeDefined()
  })
})
