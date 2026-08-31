import { describe, it, expect } from 'vitest'
import {
  readPath,
  parseConditions,
  evaluateCondition,
  evaluateConditions,
  firstFailingCondition,
} from '../../src/domain/rules/automation-conditions'
import { ValidationError } from '../../src/domain/errors/validation-error'

const ctx = {
  lead: {
    full_name: 'Ana Pérez',
    email: 'ana@mail.com',
    phone: null,
    source: 'zonaprop',
    estimated_value: 180000,
    tags: ['premium', 'urgente'],
  },
  agent: { full_name: 'Marcela Genta' },
}

describe('readPath', () => {
  it('lee paths anidados', () => {
    expect(readPath(ctx, 'lead.full_name')).toBe('Ana Pérez')
    expect(readPath(ctx, 'agent.full_name')).toBe('Marcela Genta')
  })

  it('devuelve undefined si el path no existe, sin lanzar', () => {
    expect(readPath(ctx, 'property.address')).toBeUndefined()
    expect(readPath(ctx, 'lead.email.nope')).toBeUndefined()
    expect(readPath(ctx, '')).toBeUndefined()
  })
})

describe('evaluateCondition', () => {
  it('eq compara sin distinguir mayúsculas ni espacios', () => {
    expect(evaluateCondition({ field: 'lead.source', op: 'eq', value: 'ZonaProp' }, ctx)).toBe(true)
    expect(evaluateCondition({ field: 'lead.source', op: 'eq', value: ' zonaprop ' }, ctx)).toBe(true)
    expect(evaluateCondition({ field: 'lead.source', op: 'eq', value: 'argenprop' }, ctx)).toBe(false)
  })

  it('eq iguala número con el string que manda el editor', () => {
    expect(evaluateCondition({ field: 'lead.estimated_value', op: 'eq', value: '180000' }, ctx)).toBe(true)
  })

  it('is_empty distingue null de string vacío de valor presente', () => {
    expect(evaluateCondition({ field: 'lead.phone', op: 'is_empty' }, ctx)).toBe(true)
    expect(evaluateCondition({ field: 'lead.email', op: 'is_empty' }, ctx)).toBe(false)
    expect(evaluateCondition({ field: 'lead.email', op: 'is_not_empty' }, ctx)).toBe(true)
    // Un campo que no existe cuenta como vacío.
    expect(evaluateCondition({ field: 'property.address', op: 'is_empty' }, ctx)).toBe(true)
  })

  it('contains busca en el texto', () => {
    expect(evaluateCondition({ field: 'lead.email', op: 'contains', value: '@mail' }, ctx)).toBe(true)
    expect(evaluateCondition({ field: 'lead.email', op: 'not_contains', value: 'gmail' }, ctx)).toBe(true)
  })

  it('compara números aunque el valor venga como string', () => {
    expect(evaluateCondition({ field: 'lead.estimated_value', op: 'gt', value: '100000' }, ctx)).toBe(true)
    expect(evaluateCondition({ field: 'lead.estimated_value', op: 'lte', value: 180000 }, ctx)).toBe(true)
    expect(evaluateCondition({ field: 'lead.estimated_value', op: 'gte', value: 200000 }, ctx)).toBe(false)
  })

  it('una comparación numérica sobre un dato faltante da false, no rompe', () => {
    expect(evaluateCondition({ field: 'property.price', op: 'gt', value: 1 }, ctx)).toBe(false)
    expect(evaluateCondition({ field: 'lead.full_name', op: 'gt', value: 1 }, ctx)).toBe(false)
  })

  it('in acepta array, CSV y JSON string', () => {
    const cond = (value: unknown) => evaluateCondition({ field: 'lead.source', op: 'in', value }, ctx)
    expect(cond(['zonaprop', 'argenprop'])).toBe(true)
    expect(cond('zonaprop,argenprop')).toBe(true)
    expect(cond('["zonaprop","argenprop"]')).toBe(true)
    expect(cond(['meta', 'web'])).toBe(false)
    expect(evaluateCondition({ field: 'lead.source', op: 'not_in', value: ['meta'] }, ctx)).toBe(true)
  })
})

describe('evaluateConditions', () => {
  it('sin condiciones siempre pasa', () => {
    expect(evaluateConditions([], ctx)).toBe(true)
  })

  it('combina con AND: alcanza que una falle', () => {
    const conds = [
      { field: 'lead.source', op: 'eq' as const, value: 'zonaprop' },
      { field: 'lead.estimated_value', op: 'gt' as const, value: 500000 },
    ]
    expect(evaluateConditions(conds, ctx)).toBe(false)
    expect(firstFailingCondition(conds, ctx)?.field).toBe('lead.estimated_value')
  })

  it('pasa cuando todas se cumplen', () => {
    expect(
      evaluateConditions(
        [
          { field: 'lead.source', op: 'eq', value: 'zonaprop' },
          { field: 'lead.email', op: 'is_not_empty' },
        ],
        ctx,
      ),
    ).toBe(true)
  })
})

describe('parseConditions', () => {
  it('acepta array, JSON string y vacío', () => {
    expect(parseConditions(null)).toEqual([])
    expect(parseConditions('')).toEqual([])
    expect(parseConditions('[]')).toEqual([])
    expect(parseConditions('[{"field":"lead.source","op":"eq","value":"web"}]')).toEqual([
      { field: 'lead.source', op: 'eq', value: 'web' },
    ])
  })

  it('descarta el value en los operadores unarios', () => {
    expect(parseConditions([{ field: 'lead.phone', op: 'is_empty', value: 'ignorado' }])).toEqual([
      { field: 'lead.phone', op: 'is_empty' },
    ])
  })

  it('rechaza operador desconocido, campo faltante y valor faltante', () => {
    expect(() => parseConditions([{ field: 'lead.source', op: 'matches', value: 'x' }])).toThrow(ValidationError)
    expect(() => parseConditions([{ op: 'eq', value: 'x' }])).toThrow(ValidationError)
    expect(() => parseConditions([{ field: 'lead.source', op: 'eq' }])).toThrow(ValidationError)
  })

  it('rechaza JSON inválido', () => {
    expect(() => parseConditions('{no es json}')).toThrow(ValidationError)
  })
})
