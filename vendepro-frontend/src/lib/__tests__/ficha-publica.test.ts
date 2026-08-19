import { describe, it, expect } from 'vitest'
import {
  ALL_TYPES,
  QUESTIONS,
  questionsFor,
  stepsFor,
  stepTitle,
  attr,
  labelOf,
  KITCHEN_OPTIONS,
  KITCHEN_COMERCIAL_OPTIONS,
  BALCONY_OPTIONS,
  BALCONY_NONE,
  OUTDOOR_OPTIONS,
  OUTDOOR_NONE,
  HEATING_NONE,
  OPERATION_OPTIONS,
  type PropertyType,
} from '../ficha-publica'

/** Todas las preguntas visibles para un tipo, en todos sus pasos. */
function allFor(type: PropertyType) {
  return stepsFor(type).flatMap(s => questionsFor(type, s))
}

describe('catálogo de preguntas de la ficha pública', () => {
  it('cada pregunta aplica a algún tipo y usa un tipo conocido', () => {
    for (const q of QUESTIONS) {
      expect(q.appliesTo.length, `${q.key} no aplica a ningún tipo`).toBeGreaterThan(0)
      for (const t of q.appliesTo) {
        expect(ALL_TYPES, `${q.key} referencia el tipo desconocido "${t}"`).toContain(t)
      }
    }
  })

  it('no hay claves duplicadas', () => {
    const keys = QUESTIONS.map(q => q.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('toda pregunta obligatoria explica qué falta', () => {
    for (const q of QUESTIONS.filter(q => q.required)) {
      expect(q.missing, `${q.key} es obligatoria y no tiene mensaje`).toBeTruthy()
    }
  })

  it('toda pregunta de pills ofrece opciones para cada tipo al que aplica', () => {
    for (const q of QUESTIONS.filter(q => q.kind === 'pills' || q.kind === 'multipills')) {
      for (const t of q.appliesTo) {
        const options = attr(q.options, t)
        expect(options?.length, `${q.key} sin opciones para ${t}`).toBeGreaterThan(0)
      }
    }
  })

  // ── La regla del producto: preguntar sólo lo que corresponde ──

  it('a un terreno no se le pregunta por cocina, baños ni amenities', () => {
    const keys = allFor('terreno').map(q => q.key)
    expect(keys).not.toContain('kitchen_type')
    expect(keys).not.toContain('bathrooms')
    expect(keys).not.toContain('amenities')
    expect(keys).not.toContain('rooms')
    expect(keys).not.toContain('expenses')
  })

  it('a un terreno se le pregunta lo suyo: lote, medidas, zonificación y servicios', () => {
    const keys = allFor('terreno').map(q => q.key)
    expect(keys).toContain('land_area')
    expect(keys).toContain('frontage_m')
    expect(keys).toContain('depth_m')
    expect(keys).toContain('zoning')
    expect(keys).toContain('utilities')
    expect(keys).toContain('property_condition')
  })

  it('la baulera es del edificio: sólo se pregunta en departamento', () => {
    expect(allFor('departamento').map(q => q.key)).toContain('storage_rooms')
    expect(allFor('ph').map(q => q.key)).not.toContain('storage_rooms')
  })

  it('el terreno es obligatorio en casa pero opcional en PH', () => {
    const q = QUESTIONS.find(q => q.key === 'land_area')!
    expect(attr(q.required, 'casa')).toBe(true)
    expect(attr(q.required, 'terreno')).toBe(true)
    expect(attr(q.required, 'ph')).toBe(false)
  })

  it('a una casa no se le pregunta piso, unidad, baulera ni apto mascota', () => {
    const keys = allFor('casa').map(q => q.key)
    expect(keys).not.toContain('floor_number')
    expect(keys).not.toContain('unit')
    expect(keys).not.toContain('storage_rooms')
    expect(keys).not.toContain('pets_allowed')
    expect(keys).not.toContain('is_professional')
  })

  it('a una casa sí se le pregunta terreno y plantas', () => {
    const keys = allFor('casa').map(q => q.key)
    expect(keys).toContain('land_area')
    expect(keys).toContain('floors_count')
  })

  it('a un local se le pregunta habilitación y depósito, no ambientes', () => {
    const keys = allFor('local').map(q => q.key)
    expect(keys).toContain('commercial_use')
    expect(keys).toContain('has_warehouse')
    expect(keys).toContain('frontage_m')
    expect(keys).not.toContain('rooms')
    expect(keys).not.toContain('pets_allowed')
  })

  it('el depósito es de local, no de oficina', () => {
    expect(allFor('oficina').map(q => q.key)).not.toContain('has_warehouse')
  })

  it('un local a la calle no tiene balcón ni amenities de edificio', () => {
    const keys = allFor('local').map(q => q.key)
    expect(keys).not.toContain('balcony_type')
    expect(keys).not.toContain('amenities')
    // Una oficina en torre sí tiene las dos.
    const oficina = allFor('oficina').map(q => q.key)
    expect(oficina).toContain('balcony_type')
    expect(oficina).toContain('amenities')
  })

  it('el espacio exterior admite más de una opción', () => {
    const q = QUESTIONS.find(q => q.key === 'balcony_type')!
    expect(q.kind).toBe('multipills')
    // Una casa puede tener jardín Y terraza.
    const casa = attr(q.options, 'casa')!.map(o => o.value)
    expect(casa).toContain('jardin')
    expect(casa).toContain('terraza')
    expect(attr(q.exclusive, 'casa')).toBe(OUTDOOR_NONE)
    expect(attr(q.exclusive, 'departamento')).toBe(BALCONY_NONE)
  })

  it('la calefacción admite varios sistemas y trae el catálogo completo', () => {
    const q = QUESTIONS.find(q => q.key === 'heating_type')!
    expect(q.kind).toBe('multipills')
    const vals = attr(q.options, 'casa')!.map(o => o.value)
    for (const v of ['central', 'losa_radiante', 'radiadores', 'split', 'estufas']) {
      expect(vals, `falta ${v}`).toContain(v)
    }
    expect(attr(q.exclusive, 'casa')).toBe(HEATING_NONE)
  })

  it('todo grupo multivalor declara su opción excluyente', () => {
    for (const q of QUESTIONS.filter(q => q.kind === 'multipills')) {
      for (const t of q.appliesTo) {
        const none = attr(q.exclusive, t)
        expect(none, `${q.key} sin excluyente para ${t}`).toBeTruthy()
        const values = attr(q.options, t)!.map(o => o.value)
        expect(values, `${q.key}: "${none}" no está entre sus opciones`).toContain(none)
      }
    }
  })

  it('la operación dice "Ambas", no "Las dos"', () => {
    expect(OPERATION_OPTIONS.find(o => o.value === 'ambas')?.label).toBe('Ambas')
  })

  it('las expensas se llaman igual en todos los tipos', () => {
    const q = QUESTIONS.find(q => q.key === 'expenses')!
    for (const t of q.appliesTo) {
      expect(attr(q.label, t), t).toBe('Expensas')
    }
  })

  it('apto mascota sólo se pregunta si la propiedad se alquila', () => {
    const q = QUESTIONS.find(q => q.key === 'pets_allowed')!
    expect(q.showIf!({ operation: 'venta' })).toBe(false)
    expect(q.showIf!({})).toBe(false)
    expect(q.showIf!({ operation: 'alquiler' })).toBe(true)
    expect(q.showIf!({ operation: 'ambas' })).toBe(true)
  })

  it('el paso de superficies no habla de ambientes en lo comercial', () => {
    expect(stepTitle(2, 'local')).toBe('Superficies')
    expect(stepTitle(2, 'oficina')).toBe('Superficies')
    expect(stepTitle(2, 'casa')).toBe('Superficies y ambientes')
  })

  it('las tres superficies se piden en todo lo construido', () => {
    for (const t of ['departamento', 'casa', 'ph', 'local', 'oficina'] as PropertyType[]) {
      const keys = allFor(t).map(q => q.key)
      expect(keys, t).toContain('covered_area')
      expect(keys, t).toContain('semi_area')
      expect(keys, t).toContain('uncovered_area')
    }
  })

  it('la operación se pregunta siempre', () => {
    for (const t of ALL_TYPES) {
      expect(allFor(t).map(q => q.key), t).toContain('operation')
    }
  })

  // ── Etiquetas y opciones que cambian según el tipo ──

  it('la cocina cambia de opciones entre vivienda y local', () => {
    const cocina = QUESTIONS.find(q => q.key === 'kitchen_type')!
    expect(attr(cocina.options, 'departamento')).toBe(KITCHEN_OPTIONS)
    expect(attr(cocina.options, 'local')).toBe(KITCHEN_COMERCIAL_OPTIONS)
  })

  it('el espacio exterior es balcón en depto y patio/jardín en casa', () => {
    const q = QUESTIONS.find(q => q.key === 'balcony_type')!
    expect(attr(q.options, 'departamento')).toBe(BALCONY_OPTIONS)
    expect(attr(q.label, 'departamento')).toBe('Balcón')
    expect(attr(q.options, 'casa')).toBe(OUTDOOR_OPTIONS)
    expect(attr(q.label, 'casa')).toBe('Espacio exterior')
  })

  // ── Preguntas condicionales ──

  it('la UF de la cochera sólo aparece si declaró tener una', () => {
    const q = QUESTIONS.find(q => q.key === 'parking_unit')!
    expect(q.showIf!({ parking_type: 'no_tiene' })).toBe(false)
    expect(q.showIf!({ parking_type: 'alquila_aparte' })).toBe(false)
    expect(q.showIf!({})).toBe(false)
    expect(q.showIf!({ parking_type: 'fija_cubierta' })).toBe(true)
  })

  it('el número de baulera sólo aparece si dijo que tiene', () => {
    const q = QUESTIONS.find(q => q.key === 'storage_unit')!
    expect(q.showIf!({ storage_rooms: '0' })).toBe(false)
    expect(q.showIf!({})).toBe(false)
    expect(q.showIf!({ storage_rooms: '1' })).toBe(true)
  })

  // ── Pasos ──

  it('el terreno saltea el paso de gastos y extras', () => {
    expect(questionsFor('terreno', 4)).toHaveLength(0)
    expect(stepsFor('terreno')).not.toContain(4)
  })

  it('todos los tipos terminan en el paso de datos del propietario', () => {
    for (const t of ALL_TYPES) {
      const steps = stepsFor(t)
      expect(steps[steps.length - 1], t).toBe(5)
    }
  })

  it('ningún tipo quedó más largo que el formulario único anterior', () => {
    // El formulario previo hacía 22 preguntas iguales para todos. Después se
    // sumaron 3 que se piden siempre (operación y las superficies semi y
    // descubierta), así que el techo honesto es 25. Ningún tipo lo alcanza.
    for (const t of ALL_TYPES) {
      const siempre = allFor(t).filter(q => !q.showIf)
      expect(siempre.length, `${t} se alargó`).toBeLessThanOrEqual(25)
    }
  })

  it('a ningún tipo se le preguntan todas las preguntas del catálogo', () => {
    for (const t of ALL_TYPES) {
      expect(allFor(t).length, `${t} no filtra nada`).toBeLessThan(QUESTIONS.length)
    }
  })

  it('el terreno es menos de la mitad de largo que un departamento', () => {
    expect(allFor('terreno').length * 2).toBeLessThan(allFor('departamento').length)
  })

  it('las preguntas condicionales no cuentan hasta que corresponden', () => {
    // Arrancan ocultas: nadie ve "UF de la cochera" antes de decir que tiene una.
    for (const t of ALL_TYPES) {
      const abiertas = allFor(t).filter(q => q.showIf && q.showIf({}))
      expect(abiertas, `${t} muestra condicionales de entrada`).toHaveLength(0)
    }
  })

  it('el título del paso 2 se adapta al terreno', () => {
    expect(stepTitle(2, 'terreno')).toBe('El terreno')
    expect(stepTitle(2, 'departamento')).toBe('Superficies y ambientes')
  })

  it('labelOf devuelve la etiqueta y tolera valores desconocidos', () => {
    expect(labelOf(KITCHEN_OPTIONS, 'independiente')).toBe('Independiente')
    expect(labelOf(KITCHEN_OPTIONS, 'raro')).toBe('raro')
    expect(labelOf(KITCHEN_OPTIONS, null)).toBeNull()
    expect(labelOf(KITCHEN_OPTIONS, '')).toBeNull()
  })
})
