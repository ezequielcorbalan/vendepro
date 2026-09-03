import { describe, it, expect } from 'vitest'
import { AgentSlug, slugifyName } from '../../src/domain/value-objects/agent-slug'

describe('AgentSlug', () => {
  it('acepta un slug válido', () => {
    expect(AgentSlug.create('andres-giunta').value).toBe('andres-giunta')
  })

  it('rechaza mayúsculas, espacios y caracteres raros', () => {
    expect(() => AgentSlug.create('Andres Giunta')).toThrow(/slug/i)
    expect(() => AgentSlug.create('andres_giunta')).toThrow(/slug/i)
    expect(() => AgentSlug.create('andrés-giunta')).toThrow(/slug/i)
  })

  it('rechaza por longitud', () => {
    expect(() => AgentSlug.create('ab')).toThrow(/slug/i)
    expect(() => AgentSlug.create('a'.repeat(61))).toThrow(/slug/i)
  })

  it('rechaza guiones al borde o duplicados', () => {
    expect(() => AgentSlug.create('-andres')).toThrow(/slug/i)
    expect(() => AgentSlug.create('andres-')).toThrow(/slug/i)
    expect(() => AgentSlug.create('andres--giunta')).toThrow(/slug/i)
  })

  it('slugifyName normaliza acentos y espacios', () => {
    expect(slugifyName('Andrés Giunta')).toBe('andres-giunta')
    expect(slugifyName('  María  José  Pérez ')).toBe('maria-jose-perez')
  })
})
