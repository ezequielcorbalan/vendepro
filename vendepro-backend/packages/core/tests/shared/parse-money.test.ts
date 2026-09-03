import { describe, it, expect } from 'vitest'
import { parseMoneyOrNull } from '../../src/shared/utils'

/**
 * El caso que motivó la función está primero: la IA extrae el presupuesto de una
 * imagen y casi siempre devuelve una frase, no un número. `parseFloat` sobre esa
 * frase da NaN, el guard `input.x ? ... : null` no lo atrapa (un string con
 * texto es truthy) y el NaN termina bindeado a D1.
 */
describe('parseMoneyOrNull', () => {
  it('devuelve null ante una frase, en vez de NaN', () => {
    expect(parseMoneyOrNull('hasta $650.000 por mes')).toBeNull()
    expect(parseMoneyOrNull('alrededor de USD 200.000')).toBeNull()
    expect(parseMoneyOrNull('a convenir')).toBeNull()
    expect(parseMoneyOrNull('180000 o similar')).toBeNull()
  })

  it('NUNCA devuelve NaN, sea cual sea la entrada', () => {
    const entradas: unknown[] = [
      'hasta $650.000 por mes', 'abc', '', '   ', '$', 'USD', null, undefined,
      {}, [], NaN, Infinity, -Infinity, '1.2.3', '12,34,56',
    ]
    for (const e of entradas) {
      const out = parseMoneyOrNull(e)
      expect(Number.isNaN(out as number), `${JSON.stringify(e)} produjo NaN`).toBe(false)
      expect(out === null || Number.isFinite(out)).toBe(true)
    }
  })

  it('acepta números limpios', () => {
    expect(parseMoneyOrNull(180000)).toBe(180000)
    expect(parseMoneyOrNull('180000')).toBe(180000)
    expect(parseMoneyOrNull('180000.50')).toBe(180000.5)
  })

  it('acepta los formatos con los que un agente escribe plata', () => {
    expect(parseMoneyOrNull('$180.000')).toBe(180000)
    expect(parseMoneyOrNull('USD 245.000')).toBe(245000)
    expect(parseMoneyOrNull('u$s 1.250.000')).toBe(1250000)
    expect(parseMoneyOrNull('245000 USD')).toBe(245000)
    expect(parseMoneyOrNull('1.250,50')).toBe(1250.5)
  })

  it('rechaza los no-números sin inventar un valor', () => {
    expect(parseMoneyOrNull(null)).toBeNull()
    expect(parseMoneyOrNull(undefined)).toBeNull()
    expect(parseMoneyOrNull('')).toBeNull()
    expect(parseMoneyOrNull({ monto: 100 })).toBeNull()
    expect(parseMoneyOrNull(['100'])).toBeNull()
    expect(parseMoneyOrNull(NaN)).toBeNull()
    expect(parseMoneyOrNull(Infinity)).toBeNull()
  })
})
