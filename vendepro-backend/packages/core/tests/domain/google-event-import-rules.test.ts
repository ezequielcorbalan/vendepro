import { describe, it, expect } from 'vitest'
import {
  classifyGoogleEventType,
  matchNameInTitle,
  candidateNameTerms,
  normalizeForMatch,
} from '../../src/domain/rules/google-event-import-rules'

/**
 * Estas reglas leen títulos escritos a mano por el agente en su calendario.
 * Los casos de acá son títulos reales del rubro, no ejemplos de laboratorio.
 */

describe('normalizeForMatch', () => {
  it('ignora tildes y mayúsculas', () => {
    expect(normalizeForMatch('Tasación RECOLETA')).toBe('tasacion recoleta')
    expect(normalizeForMatch('Reunión')).toBe(normalizeForMatch('reunion'))
  })
})

describe('classifyGoogleEventType', () => {
  it('reconoce los tipos por palabra clave, con o sin tilde', () => {
    expect(classifyGoogleEventType('Llamada a Gustavo')).toBe('llamada')
    expect(classifyGoogleEventType('Llamar al propietario')).toBe('llamada')
    expect(classifyGoogleEventType('Reunión de equipo')).toBe('reunion')
    expect(classifyGoogleEventType('Reunion con inversor')).toBe('reunion')
    expect(classifyGoogleEventType('Tasación Lavalle 2060')).toBe('tasacion')
    expect(classifyGoogleEventType('Seguimiento Monzón')).toBe('seguimiento')
    expect(classifyGoogleEventType('Firma boleto Rivadavia')).toBe('firma')
  })

  it('separa la visita de captación de la de comprador', () => {
    expect(classifyGoogleEventType('Visita Lavalle 2060')).toBe('visita_captacion')
    expect(classifyGoogleEventType('Visita de comprador en Cabildo')).toBe('visita_comprador')
    expect(classifyGoogleEventType('Mostrar propiedad a los Pérez')).toBe('visita_comprador')
  })

  it('cae en "otro" cuando el título no dice nada del negocio', () => {
    expect(classifyGoogleEventType('Dentista')).toBe('otro')
    expect(classifyGoogleEventType('')).toBe('otro')
    expect(classifyGoogleEventType(null)).toBe('otro')
  })

  it('no clasifica como comercial un almuerzo con la palabra visita adentro de otra', () => {
    // "revisita" no es "visita": si el keyword matcheara como substring de
    // cualquier palabra, medio calendario se volvería visita de captación.
    expect(classifyGoogleEventType('Revisar contratos')).toBe('otro')
  })
})

describe('matchNameInTitle', () => {
  const cartera = [
    { id: 'l1', full_name: 'Gustavo Gabriel Monzón' },
    { id: 'l2', full_name: 'Micaela Catania' },
    { id: 'l3', full_name: 'Juan' },
  ]

  it('vincula cuando el nombre completo está en el título', () => {
    expect(matchNameInTitle('Visita con Micaela Catania', cartera)?.id).toBe('l2')
  })

  it('ignora tildes al comparar', () => {
    expect(matchNameInTitle('Tasacion Gustavo Gabriel Monzon', cartera)?.id).toBe('l1')
  })

  it('no vincula por nombre de pila solo', () => {
    // Con cientos de contactos, "Reunión con Juan" haría match con el Juan
    // equivocado. Un vínculo errado es peor que ninguno.
    expect(matchNameInTitle('Reunión con Juan', cartera)).toBeNull()
  })

  it('no vincula si no aparece ningún nombre conocido', () => {
    expect(matchNameInTitle('Visita Lavalle 2060', cartera)).toBeNull()
  })

  it('ante dos coincidencias gana la más específica', () => {
    const conAmbos = [
      { id: 'corto', full_name: 'Gabriel Monzón' },
      { id: 'largo', full_name: 'Gustavo Gabriel Monzón' },
    ]
    expect(matchNameInTitle('Visita Gustavo Gabriel Monzón', conAmbos)?.id).toBe('largo')
  })
})

describe('candidateNameTerms', () => {
  it('deja fuera las palabras de agenda y las muy cortas', () => {
    const terms = candidateNameTerms('Visita con Gustavo Monzón')
    expect(terms).toContain('gustavo')
    expect(terms).toContain('monzon')
    expect(terms).not.toContain('visita')
    expect(terms).not.toContain('con')
  })

  it('devuelve vacío para un título sin nombres plausibles', () => {
    expect(candidateNameTerms('Visita')).toEqual([])
  })
})
