import { describe, it, expect } from 'vitest'
import {
  monthOverlapDays,
  aggregateSpendForRange,
  computePortalCosts,
  summarizePortalCosts,
  type PortalSpendRow,
  type PortalLeadCount,
} from '../../src/domain/rules/portal-cost-rules'
import { PortalSpend } from '../../src/domain/entities/portal-spend'

// 1.450.000 ARS a 1450 = 1000 USD de gasto mensual.
const ZP: PortalSpendRow = { provider: 'zonaprop', period_month: '2026-09', amount: 1_450_000, currency: 'ARS', usd_rate: 1450 }
const ML: PortalSpendRow = { provider: 'mercadolibre', period_month: '2026-09', amount: 500, currency: 'USD', usd_rate: 1 }

const LEADS: PortalLeadCount[] = [
  { provider: 'zonaprop', leads: 40, visitas: 8, ganados: 1 },
  { provider: 'mercadolibre', leads: 20, visitas: 5, ganados: 0 },
]

// Septiembre entero: 1 al 30 (el `to` es exclusivo).
const FULL = { from: '2026-09-01', to: '2026-10-01' }

function row(rows: ReturnType<typeof computePortalCosts>, provider: string) {
  const r = rows.find(x => x.provider === provider)
  if (!r) throw new Error(`falta la fila de ${provider}`)
  return r
}

function costs(spend: PortalSpendRow[], leads: PortalLeadCount[], range = FULL) {
  return computePortalCosts(aggregateSpendForRange(spend, range.from, range.to), leads)
}

describe('monthOverlapDays', () => {
  it('mes entero dentro del rango', () => {
    expect(monthOverlapDays('2026-09', '2026-09-01', '2026-10-01')).toBe(30)
    expect(monthOverlapDays('2026-02', '2026-01-01', '2027-01-01')).toBe(28)
    expect(monthOverlapDays('2024-02', '2024-01-01', '2024-04-01')).toBe(29) // bisiesto
  })

  it('mes parcial cuenta sólo los días que caen adentro', () => {
    // 1 al 7 de septiembre = 7 días
    expect(monthOverlapDays('2026-09', '2026-09-01', '2026-09-08')).toBe(7)
  })

  it('un mes fuera del rango no cuenta', () => {
    expect(monthOverlapDays('2026-08', '2026-09-01', '2026-10-01')).toBe(0)
    expect(monthOverlapDays('2026-10', '2026-09-01', '2026-10-01')).toBe(0)
  })
})

describe('aggregateSpendForRange — el prorrateo', () => {
  /**
   * El bug que evita: la factura de septiembre es de 30 días, pero el panel
   * muestra "mes a hoy". El día 7, comparar los 1000 USD del mes entero contra
   * los leads de una semana daría un costo por lead 4 veces más alto del real.
   */
  it('prorratea el mes en curso por días transcurridos', () => {
    const [agg] = aggregateSpendForRange([ZP], '2026-09-01', '2026-09-08')
    expect(agg!.spend_usd).toBe(233.33)   // 1000 × 7/30
    expect(agg!.prorated).toBe(true)
  })

  it('el mes completo no se prorratea', () => {
    const [agg] = aggregateSpendForRange([ZP], FULL.from, FULL.to)
    expect(agg!.spend_usd).toBe(1000)
    expect(agg!.prorated).toBe(false)
  })

  it('suma varios meses del mismo portal y prorratea sólo el parcial', () => {
    const rows: PortalSpendRow[] = [
      { ...ZP, period_month: '2026-07' },
      { ...ZP, period_month: '2026-08' },
      { ...ZP, period_month: '2026-09' },
    ]
    // Trimestre a hoy: julio y agosto enteros + 7 días de septiembre
    const [agg] = aggregateSpendForRange(rows, '2026-07-01', '2026-09-08')
    expect(agg!.spend_usd).toBe(2233.33)
    expect(agg!.months).toBe(3)
    expect(agg!.prorated).toBe(true)
  })

  it('ignora los meses que no tocan el rango', () => {
    const rows: PortalSpendRow[] = [{ ...ZP, period_month: '2026-05' }, ZP]
    const [agg] = aggregateSpendForRange(rows, FULL.from, FULL.to)
    expect(agg!.months).toBe(1)
    expect(agg!.spend_usd).toBe(1000)
  })

  it('un mes sin cotización no suma pero se cuenta', () => {
    const rows: PortalSpendRow[] = [
      { ...ZP, period_month: '2026-08' },
      { ...ZP, period_month: '2026-09', usd_rate: null },
    ]
    const [agg] = aggregateSpendForRange(rows, '2026-08-01', '2026-10-01')
    expect(agg!.spend_usd).toBe(1000)          // sólo agosto
    expect(agg!.months).toBe(2)
    expect(agg!.months_without_rate).toBe(1)
  })
})

describe('computePortalCosts', () => {
  it('saca el costo por lead y por visita', () => {
    const rows = costs([ZP, ML], LEADS)
    expect(row(rows, 'zonaprop').spend_usd).toBe(1000)
    expect(row(rows, 'zonaprop').cost_per_lead_usd).toBe(25)
    expect(row(rows, 'zonaprop').cost_per_visit_usd).toBe(125)
    expect(row(rows, 'mercadolibre').cost_per_lead_usd).toBe(25)
  })

  it('ordena por gasto y deja los sin gasto al final, por volumen de leads', () => {
    const rows = costs([ZP, ML], [
      ...LEADS,
      { provider: 'argenprop', leads: 30, visitas: 2, ganados: 0 },
      { provider: 'otro', leads: 3, visitas: 0, ganados: 0 },
    ])
    expect(rows.map(r => r.provider)).toEqual(['zonaprop', 'mercadolibre', 'argenprop', 'otro'])
  })

  describe('las dos mitades sueltas siguen apareciendo', () => {
    it('un portal con leads y sin gasto cargado aparece con el motivo', () => {
      const rows = costs([ZP], LEADS)
      const ml = row(rows, 'mercadolibre')
      expect(ml.leads).toBe(20)
      expect(ml.spend_usd).toBeNull()
      expect(ml.cost_per_lead_usd).toBeNull()
      expect(ml.missing).toBe('sin_gasto')
    })

    it('un gasto cargado que no trajo un solo lead también aparece', () => {
      const rows = costs([ZP, { ...ML, provider: 'properati', provider_label: 'Properati' }], LEADS)
      const p = row(rows, 'properati')
      expect(p.spend_usd).toBe(500)
      expect(p.label).toBe('Properati')
      expect(p.leads).toBe(0)
      expect(p.cost_per_lead_usd).toBeNull()
      expect(p.missing).toBe('sin_leads')
    })
  })

  it('sin cotización no calcula costo y marca el motivo', () => {
    const rows = costs([{ ...ZP, usd_rate: null }], LEADS)
    const zp = row(rows, 'zonaprop')
    expect(zp.spend_usd).toBeNull()
    expect(zp.cost_per_lead_usd).toBeNull()
    expect(zp.missing).toBe('sin_cotizacion')
    expect(zp.months_without_rate).toBe(1)
  })

  it('una cotización en cero no divide por cero', () => {
    const rows = costs([{ ...ZP, usd_rate: 0 }], LEADS)
    expect(row(rows, 'zonaprop').spend_usd).toBeNull()
    expect(row(rows, 'zonaprop').missing).toBe('sin_cotizacion')
  })

  it('sin nada cargado devuelve una tabla vacía, no una fila fantasma', () => {
    expect(costs([], [])).toEqual([])
  })
})

describe('summarizePortalCosts', () => {
  it('suma el gasto convertido y saca el costo por lead del total', () => {
    const s = summarizePortalCosts(costs([ZP, ML], LEADS))
    expect(s.spend_usd).toBe(1500)
    expect(s.leads).toBe(60)
    expect(s.visitas).toBe(13)
    expect(s.cost_per_lead_usd).toBe(25)
    expect(s.pending_rate).toBe(0)
  })

  // Sumar un gasto sin cotizar daría un total más chico que la realidad y
  // nadie se enteraría: se deja afuera y se cuenta cuántos portales faltan.
  it('el gasto sin cotización queda afuera del total y se avisa', () => {
    const s = summarizePortalCosts(costs([{ ...ZP, usd_rate: null }, ML], LEADS))
    expect(s.spend_usd).toBe(500)
    expect(s.pending_rate).toBe(1)
  })

  it('avisa cuando el total es prorrateado', () => {
    const s = summarizePortalCosts(costs([ZP], LEADS, { from: '2026-09-01', to: '2026-09-08' }))
    expect(s.prorated).toBe(true)
  })

  it('sin gasto cargado el total es null, no cero', () => {
    const s = summarizePortalCosts(costs([], LEADS))
    expect(s.spend_usd).toBeNull()
    expect(s.cost_per_lead_usd).toBeNull()
    expect(s.leads).toBe(60)
  })
})

describe('PortalSpend', () => {
  const base = { id: 'ps1', org_id: 'org_mg', provider: 'ZonaProp', period_month: '2026-09', amount: 1_450_000, currency: 'ARS' }

  it('normaliza el portal a minúsculas para que matchee con leads.source', () => {
    expect(PortalSpend.create(base).provider).toBe('zonaprop')
  })

  it('en USD la cotización es la identidad y no hace falta buscarla', () => {
    const s = PortalSpend.create({ ...base, currency: 'USD', amount: 500 })
    expect(s.usd_rate).toBe(1)
    expect(s.amount_usd).toBe(500)
  })

  it('sin cotización el importe en USD es null', () => {
    expect(PortalSpend.create(base).amount_usd).toBeNull()
  })

  it('con cotización convierte', () => {
    expect(PortalSpend.create({ ...base, usd_rate: 1450 }).amount_usd).toBe(1000)
  })

  it('rechaza períodos que no sean YYYY-MM', () => {
    expect(() => PortalSpend.create({ ...base, period_month: '2026-9' })).toThrow(/YYYY-MM/)
    expect(() => PortalSpend.create({ ...base, period_month: '2026-13' })).toThrow(/YYYY-MM/)
    expect(() => PortalSpend.create({ ...base, period_month: '2026-09-01' })).toThrow(/YYYY-MM/)
  })

  it('rechaza importes negativos y monedas que no maneja', () => {
    expect(() => PortalSpend.create({ ...base, amount: -1 })).toThrow(/importe/i)
    expect(() => PortalSpend.create({ ...base, currency: 'EUR' })).toThrow(/Moneda/i)
  })

  it('rechaza una cotización en cero o negativa', () => {
    expect(() => PortalSpend.create({ ...base, usd_rate: 0 })).toThrow(/cotización/i)
    expect(() => PortalSpend.create({ ...base, usd_rate: -5 })).toThrow(/cotización/i)
  })

  it('exige el portal', () => {
    expect(() => PortalSpend.create({ ...base, provider: '  ' })).toThrow(/portal/i)
  })
})
