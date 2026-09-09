import { describe, it, expect } from 'vitest'
import {
  commissionUsd,
  aggregateIncome,
  computeRoi,
  computeRoas,
  suggestCommission,
  type PropertyIncomeRow,
} from '../../src/domain/rules/property-income-rules'

const row = (over: Partial<PropertyIncomeRow> = {}): PropertyIncomeRow => ({
  property_id: 'p1',
  attribution: 'zonaprop',
  commission_amount: 6000,
  commission_currency: 'USD',
  commission_usd_rate: 1,
  ...over,
})

describe('commissionUsd', () => {
  it('en dólares es el importe tal cual', () => {
    expect(commissionUsd(row())).toBe(6000)
  })

  it('en pesos convierte con la cotización congelada de la fila', () => {
    expect(commissionUsd(row({ commission_amount: 8_700_000, commission_currency: 'ARS', commission_usd_rate: 1450 }))).toBe(6000)
  })

  it('sin importe cargado es null, no cero', () => {
    expect(commissionUsd(row({ commission_amount: null }))).toBeNull()
  })

  it('en pesos sin cotización es null: no se inventa un tipo de cambio', () => {
    expect(commissionUsd(row({ commission_currency: 'ARS', commission_usd_rate: null }))).toBeNull()
    expect(commissionUsd(row({ commission_currency: 'ARS', commission_usd_rate: 0 }))).toBeNull()
  })
})

describe('aggregateIncome', () => {
  it('suma por fuente y cuenta las operaciones', () => {
    const r = aggregateIncome([
      row({ property_id: 'p1', attribution: 'zonaprop', commission_amount: 6000 }),
      row({ property_id: 'p2', attribution: 'zonaprop', commission_amount: 4000 }),
      row({ property_id: 'p3', attribution: 'mercadolibre', commission_amount: 5000 }),
    ])
    expect(r.byAttribution.get('zonaprop')).toEqual({ income_usd: 10000, operations: 2 })
    expect(r.byAttribution.get('mercadolibre')).toEqual({ income_usd: 5000, operations: 1 })
  })

  /**
   * Un cierre sin fuente atribuida no se reparte entre los canales — inflaría
   * el ROI de todos — ni se descarta, porque entonces la suma de la tabla no
   * daría el total real de lo que entró. Se cuenta aparte.
   */
  it('los cierres sin atribución van aparte, no se reparten', () => {
    const r = aggregateIncome([
      row({ attribution: 'zonaprop', commission_amount: 6000 }),
      row({ property_id: 'p2', attribution: null, commission_amount: 9000 }),
    ])
    expect(r.byAttribution.get('zonaprop')?.income_usd).toBe(6000)
    expect(r.unattributed).toEqual({ income_usd: 9000, operations: 1 })
    expect(r.byAttribution.has('')).toBe(false)
  })

  it('los honorarios sin cotización no suman y se cuentan', () => {
    const r = aggregateIncome([
      row({ commission_amount: 6000 }),
      row({ property_id: 'p2', commission_currency: 'ARS', commission_usd_rate: null }),
    ])
    expect(r.byAttribution.get('zonaprop')?.income_usd).toBe(6000)
    expect(r.pending_rate).toBe(1)
  })

  it('sin cierres devuelve todo vacío', () => {
    const r = aggregateIncome([])
    expect(r.byAttribution.size).toBe(0)
    expect(r.pending_rate).toBe(0)
    expect(r.unattributed).toEqual({ income_usd: 0, operations: 0 })
  })
})

describe('computeRoi / computeRoas', () => {
  it('mide el retorno sobre lo invertido', () => {
    // Gastó 1000, entraron 6000 → 500% de retorno, 6 dólares por dólar
    expect(computeRoi(6000, 1000)).toBe(500)
    expect(computeRoas(6000, 1000)).toBe(6)
  })

  it('un canal que no se pagó da ROI negativo', () => {
    expect(computeRoi(500, 1000)).toBe(-50)
    expect(computeRoas(500, 1000)).toBe(0.5)
  })

  /**
   * Sin gasto cargado el ROI no es cero: no existe. Mostrarlo como 0% haría
   * parecer malo un canal que simplemente no tiene el costo cargado todavía.
   */
  it('sin gasto el ROI es null, no cero', () => {
    expect(computeRoi(6000, null)).toBeNull()
    expect(computeRoi(6000, 0)).toBeNull()
    expect(computeRoas(6000, 0)).toBeNull()
  })

  it('sin ingreso tampoco calcula', () => {
    expect(computeRoi(null, 1000)).toBeNull()
    expect(computeRoas(null, 1000)).toBeNull()
  })
})

describe('suggestCommission', () => {
  it('aplica el porcentaje pactado en la tasación', () => {
    expect(suggestCommission(200_000, 3)).toBe(6000)
    expect(suggestCommission(185_500, 3.5)).toBe(6492.5)
  })

  it('sin precio o sin porcentaje no sugiere nada', () => {
    expect(suggestCommission(null, 3)).toBeNull()
    expect(suggestCommission(200_000, null)).toBeNull()
    expect(suggestCommission(0, 3)).toBeNull()
    expect(suggestCommission(200_000, 0)).toBeNull()
  })
})
