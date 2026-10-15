import { describe, it, expect } from 'vitest'
import { authorizationExpiry, daysUntil } from '../../src/domain/rules/authorization-rules'

describe('authorizationExpiry', () => {
  it('suma el plazo al inicio', () => {
    expect(authorizationExpiry('2026-10-08', 90)).toBe('2027-01-06')
  })

  it('sin plazo usa 180 días, como la columna y el barrido', () => {
    expect(authorizationExpiry('2026-04-01', null)).toBe('2026-09-28')
  })

  it('acepta un ISO completo y se queda con la fecha', () => {
    expect(authorizationExpiry('2026-10-08T15:00:00.000Z', 30)).toBe('2026-11-07')
  })

  it('sin inicio o con basura no hay vencimiento', () => {
    expect(authorizationExpiry(null, 180)).toBeNull()
    expect(authorizationExpiry('', 180)).toBeNull()
    expect(authorizationExpiry('08/10/2026', 180)).toBeNull()
  })
})

describe('daysUntil', () => {
  it('cuenta días calendario', () => {
    expect(daysUntil('2026-10-22', '2026-10-15')).toBe(7)
    expect(daysUntil('2026-10-15', '2026-10-15')).toBe(0)
  })

  it('negativo si ya venció', () => {
    expect(daysUntil('2026-10-10', '2026-10-15')).toBe(-5)
  })

  it('null si falta alguna fecha', () => {
    expect(daysUntil(null, '2026-10-15')).toBeNull()
  })
})
