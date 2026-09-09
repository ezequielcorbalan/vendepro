import { describe, it, expect } from 'vitest'
import {
  parseMarketingPeriod,
  marketingPeriodRanges,
  periodDelta,
} from '../../src/domain/value-objects/marketing-period'

// 3 de septiembre de 2026: día 3 del mes, día 65 del trimestre (jul-sep),
// día 246 del año. Sirve para los tres períodos a la vez.
const NOW = new Date('2026-09-03T15:40:00.000Z')

describe('parseMarketingPeriod', () => {
  it('cae a month ante cualquier cosa rara', () => {
    expect(parseMarketingPeriod(null)).toBe('month')
    expect(parseMarketingPeriod('week')).toBe('month')   // week ya no es un período del panel
    expect(parseMarketingPeriod('cal_month')).toBe('month')
  })

  it('respeta los tres válidos', () => {
    expect(parseMarketingPeriod('month')).toBe('month')
    expect(parseMarketingPeriod('quarter')).toBe('quarter')
    expect(parseMarketingPeriod('year')).toBe('year')
  })
})

describe('marketingPeriodRanges — los tres son de calendario hasta hoy', () => {
  it('mes en curso', () => {
    const r = marketingPeriodRanges('month', NOW)
    expect(r.current).toEqual({ from: '2026-09-01', to: '2026-09-04' })
    expect(r.elapsedDays).toBe(3)
  })

  it('trimestre en curso arranca en el primer mes del trimestre', () => {
    const r = marketingPeriodRanges('quarter', NOW)
    expect(r.current.from).toBe('2026-07-01')
    expect(r.current.to).toBe('2026-09-04')
    expect(r.elapsedDays).toBe(65)
  })

  it('año en curso', () => {
    const r = marketingPeriodRanges('year', NOW)
    expect(r.current.from).toBe('2026-01-01')
    expect(r.current.to).toBe('2026-09-04')
  })

  // El bug que arregla: antes mes era calendario, trimestre era ventana móvil
  // y año era calendario, así que "Mes" y "Trimestre" no se podían comparar.
  it('el fin del rango es el mismo para los tres', () => {
    const to = marketingPeriodRanges('month', NOW).current.to
    expect(marketingPeriodRanges('quarter', NOW).current.to).toBe(to)
    expect(marketingPeriodRanges('year', NOW).current.to).toBe(to)
  })
})

describe('marketingPeriodRanges — el período anterior es del mismo largo', () => {
  it('mes: 3 días de septiembre contra los 3 primeros de agosto', () => {
    const r = marketingPeriodRanges('month', NOW)
    expect(r.previous).toEqual({ from: '2026-08-01', to: '2026-08-04' })
  })

  it('trimestre: los mismos 65 días del trimestre anterior', () => {
    const r = marketingPeriodRanges('quarter', NOW)
    expect(r.previous.from).toBe('2026-04-01')
    expect(r.previous.to).toBe('2026-06-05')  // 1-abr + 65 días
  })

  it('año: los mismos 246 días del año anterior', () => {
    const r = marketingPeriodRanges('year', NOW)
    expect(r.previous.from).toBe('2025-01-01')
    expect(r.elapsedDays).toBe(246)
    expect(r.previous.to).toBe('2025-09-04')
  })

  it('el largo de los dos rangos coincide siempre', () => {
    for (const p of ['month', 'quarter', 'year'] as const) {
      const r = marketingPeriodRanges(p, NOW)
      const len = (a: { from: string; to: string }) =>
        (Date.parse(a.to) - Date.parse(a.from)) / 86_400_000
      expect(len(r.previous)).toBe(len(r.current))
    }
  })
})

describe('marketingPeriodRanges — bordes', () => {
  it('el primer día del mes da un rango de un solo día', () => {
    const r = marketingPeriodRanges('month', new Date('2026-09-01T00:05:00.000Z'))
    expect(r.current).toEqual({ from: '2026-09-01', to: '2026-09-02' })
    expect(r.previous).toEqual({ from: '2026-08-01', to: '2026-08-02' })
    expect(r.elapsedDays).toBe(1)
  })

  it('enero compara contra diciembre del año anterior', () => {
    const r = marketingPeriodRanges('month', new Date('2026-01-15T12:00:00.000Z'))
    expect(r.current.from).toBe('2026-01-01')
    expect(r.previous).toEqual({ from: '2025-12-01', to: '2025-12-16' })
  })

  it('el primer trimestre compara contra el último del año anterior', () => {
    const r = marketingPeriodRanges('quarter', new Date('2026-02-10T12:00:00.000Z'))
    expect(r.current.from).toBe('2026-01-01')
    expect(r.previous.from).toBe('2025-10-01')
  })

  // 29-feb existe en 2024 y no en 2023: el rango anterior no puede desbordar
  // a marzo por hacer aritmética de meses en vez de días.
  it('año bisiesto: el rango anterior sigue siendo de la misma cantidad de días', () => {
    const r = marketingPeriodRanges('year', new Date('2024-03-01T12:00:00.000Z'))
    expect(r.current).toEqual({ from: '2024-01-01', to: '2024-03-02' })
    expect(r.elapsedDays).toBe(61)
    expect(r.previous).toEqual({ from: '2023-01-01', to: '2023-03-03' })
  })
})

describe('periodDelta', () => {
  it('calcula la variación con un decimal', () => {
    expect(periodDelta(130, 100)).toBe(30)
    expect(periodDelta(70, 100)).toBe(-30)
    expect(periodDelta(1, 3)).toBe(-66.7)
  })

  // Sin base no hay porcentaje: la UI muestra "—" en vez de un +100% inventado.
  it('devuelve null cuando el período anterior fue cero', () => {
    expect(periodDelta(10, 0)).toBeNull()
    expect(periodDelta(0, 0)).toBeNull()
  })
})
