import { describe, it, expect } from 'vitest'
import { buildLeadProperty, propertyFromIncoming } from '../../../src/application/use-cases/webhooks/lead-webhook-payload'

describe('buildLeadProperty', () => {
  it('arma el objeto con los 6 campos cuando hay external_id', () => {
    expect(buildLeadProperty({
      external_id: '541048', address: 'Terrada 1887', neighborhood: 'Villa Santa Rita',
      operation: 'venta', portal: 'zonaprop', listing_url: 'https://x.com/aviso',
    })).toEqual({
      external_id: '541048', address: 'Terrada 1887', neighborhood: 'Villa Santa Rita',
      operation: 'venta', portal: 'zonaprop', listing_url: 'https://x.com/aviso',
    })
  })

  it('vale con solo address (sin external_id)', () => {
    const p = buildLeadProperty({ address: 'Terrada 1887', portal: 'argenprop' })
    expect(p).not.toBeNull()
    expect(p!.address).toBe('Terrada 1887')
    expect(p!.external_id).toBeNull()
    expect(p!.neighborhood).toBeNull()
  })

  it('null si no hay identificador (external_id ni address), aunque venga operation/portal', () => {
    // Caso tasación web: trae operación pero no es consulta de un aviso.
    expect(buildLeadProperty({ operation: 'venta', portal: null })).toBeNull()
    expect(buildLeadProperty({})).toBeNull()
  })

  it('normaliza strings vacíos y espacios a null', () => {
    const p = buildLeadProperty({ external_id: '  ', address: '  Terrada 1887  ', neighborhood: '' })
    expect(p!.external_id).toBeNull()      // '  ' → null
    expect(p!.address).toBe('Terrada 1887') // trim
    expect(p!.neighborhood).toBeNull()
  })

  it('convierte external_id numérico a string', () => {
    const p = buildLeadProperty({ external_id: 541048 as any })
    expect(p!.external_id).toBe('541048')
  })
})

describe('propertyFromIncoming', () => {
  it('lee el objeto property explícito del payload', () => {
    const p = propertyFromIncoming({
      full_name: 'Ana', property: { external_id: '999', address: 'Av. Corrientes 1', portal: 'mercadolibre' },
    })
    expect(p).toMatchObject({ external_id: '999', address: 'Av. Corrientes 1', portal: 'mercadolibre' })
  })

  it('null si NO hay objeto property (no infiere desde property_address plano)', () => {
    // Una tasación web con dirección plana NO debe generar property.
    expect(propertyFromIncoming({ property_address: 'Terrada 1887', operation: 'venta' })).toBeNull()
    expect(propertyFromIncoming({ full_name: 'Ana' })).toBeNull()
    expect(propertyFromIncoming(null)).toBeNull()
  })

  it('null si el property explícito no tiene identificador', () => {
    expect(propertyFromIncoming({ property: { operation: 'alquiler', portal: 'zonaprop' } })).toBeNull()
  })
})
