import { describe, it, expect } from 'vitest'
import {
  ORG_MODULES,
  MODULE_DEFINITIONS,
  parseModules,
  parsePlan,
  isModuleEnabled,
  enabledModules,
  getModuleDefinition,
} from '../../src/domain/value-objects/org-modules'
import { Organization, DEFAULT_SURFACE_WEIGHTS } from '../../src/domain/entities/organization'

const ALL = [...ORG_MODULES]

describe('isModuleEnabled', () => {
  // Las dos condiciones son independientes: el plan habilita, la activación
  // manual prende. Ninguna de las dos alcanza sola.
  it('exige plan PRO', () => {
    expect(isModuleEnabled('basic', ALL, 'emails')).toBe(false)
    expect(isModuleEnabled('pro', ALL, 'emails')).toBe(true)
  })

  it('exige que el módulo esté activado', () => {
    expect(isModuleEnabled('pro', [], 'emails')).toBe(false)
    expect(isModuleEnabled('pro', ['emails'], 'emails')).toBe(true)
  })

  it('activa de a uno sin arrastrar el resto', () => {
    expect(isModuleEnabled('pro', ['emails'], 'landings')).toBe(false)
    expect(enabledModules('pro', ['emails'])).toEqual(['emails'])
  })

  it('una clave desconocida nunca está habilitada', () => {
    expect(isModuleEnabled('pro', ALL, 'inventado')).toBe(false)
  })

  it('los cuatro módulos de Marketing son PRO', () => {
    expect(MODULE_DEFINITIONS.map(m => m.key).sort()).toEqual([...ALL].sort())
    expect(MODULE_DEFINITIONS.every(m => m.plan === 'pro')).toBe(true)
  })

  it('cada módulo tiene texto para la pantalla de upsell', () => {
    for (const m of MODULE_DEFINITIONS) {
      expect(m.label.length).toBeGreaterThan(0)
      expect(m.description.length).toBeGreaterThan(20)
    }
  })
})

describe('parseModules', () => {
  it('lee el array JSON de la columna', () => {
    expect(parseModules('["emails","landings"]')).toEqual(['emails', 'landings'])
  })

  // Una fila mal formada no puede tumbar el menú de nadie: se descarta.
  it('tolera null, vacío, JSON roto y tipos que no van', () => {
    expect(parseModules(null)).toEqual([])
    expect(parseModules('')).toEqual([])
    expect(parseModules('no soy json')).toEqual([])
    expect(parseModules('{"emails":true}')).toEqual([])
    expect(parseModules(42)).toEqual([])
  })

  it('descarta claves que no existen en el catálogo', () => {
    expect(parseModules('["emails","modulo-viejo"]')).toEqual(['emails'])
  })

  it('acepta un array ya parseado', () => {
    expect(parseModules(['landings'])).toEqual(['landings'])
  })
})

describe('parsePlan', () => {
  it('cae a basic ante cualquier valor raro', () => {
    expect(parsePlan('pro')).toBe('pro')
    expect(parsePlan('basic')).toBe('basic')
    expect(parsePlan('enterprise')).toBe('basic')
    expect(parsePlan(null)).toBe('basic')
  })
})

describe('getModuleDefinition', () => {
  it('devuelve null para una clave desconocida', () => {
    expect(getModuleDefinition('inventado')).toBeNull()
    expect(getModuleDefinition('emails')?.label).toBe('Emails')
  })
})

describe('Organization', () => {
  const base = {
    id: 'org_1', name: 'MG', slug: 'mg', logo_url: null,
    brand_color: '#ff007c', brand_accent_color: null,
    canva_template_id: null, canva_report_template_id: null,
    surface_weights: DEFAULT_SURFACE_WEIGHTS, owner_id: null,
  }

  // Una org nueva no se lleva ningún módulo de regalo: se activan a mano.
  it('arranca en basic y sin módulos', () => {
    const org = Organization.create(base)
    expect(org.plan).toBe('basic')
    expect(org.modules).toEqual([])
    expect(org.enabled_modules).toEqual([])
    expect(org.hasModule('emails')).toBe(false)
  })

  it('expone los módulos habilitados', () => {
    const org = Organization.create({ ...base, plan: 'pro', modules: ['emails', 'automatizaciones'] })
    expect(org.enabled_modules).toEqual(['emails', 'automatizaciones'])
    expect(org.hasModule('emails')).toBe(true)
    expect(org.hasModule('landings')).toBe(false)
  })

  it('sin plan PRO no habilita nada, aunque estén activados', () => {
    const org = Organization.create({ ...base, plan: 'basic', modules: ALL })
    expect(org.enabled_modules).toEqual([])
  })
})
