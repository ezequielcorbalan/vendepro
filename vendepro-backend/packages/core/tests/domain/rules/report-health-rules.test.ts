import { describe, it, expect } from 'vitest'
import {
  REPORT_HEALTH_BENCHMARKS,
  computeHealthStatus,
  computeDeltaHealthStatus,
  daysBetweenISO,
} from '../../../src/domain/rules/report-health-rules'

describe('computeHealthStatus', () => {
  it.each([
    [0, 'red'],
    [9, 'red'],
    [10, 'orange'],
    [13, 'orange'],
    [14, 'yellow'],
    [22, 'yellow'],
    [23, 'light_green'],
    [27, 'light_green'],
    [28, 'green'],
    [100, 'green'],
  ])('viewsPerDay=%d → %s', (views, expected) => {
    expect(computeHealthStatus(views)).toBe(expected)
  })

  it('treats non-finite values as red', () => {
    expect(computeHealthStatus(NaN)).toBe('red')
    expect(computeHealthStatus(Infinity)).toBe('red')
  })
})

describe('daysBetweenISO', () => {
  it('returns 1 when end < start', () => {
    expect(daysBetweenISO('2026-04-10', '2026-04-01')).toBe(1)
  })

  it('returns day count inclusive-exclusive', () => {
    expect(daysBetweenISO('2026-04-01', '2026-04-30')).toBe(29)
  })

  it('returns 1 for same day', () => {
    expect(daysBetweenISO('2026-04-10', '2026-04-10')).toBe(1)
  })
})

describe('REPORT_HEALTH_BENCHMARKS', () => {
  it('documents CABA and GBA minimums', () => {
    expect(REPORT_HEALTH_BENCHMARKS.caba.min_views_per_day).toBe(14)
    expect(REPORT_HEALTH_BENCHMARKS.gba.min_views_per_day).toBe(8)
  })
})

describe('computeDeltaHealthStatus', () => {
  it.each([
    [null, 'light_green'],
    [0, 'green'],
    [-10, 'green'],
    [-11, 'yellow'],
    [-30, 'yellow'],
    [-31, 'red'],
    [10, 'green'],
  ])('delta=%s → %s', (delta, expected) => {
    expect(computeDeltaHealthStatus(delta as number | null)).toBe(expected)
  })
})
