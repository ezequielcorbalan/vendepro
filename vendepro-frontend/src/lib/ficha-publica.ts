// ============================================================
// Ficha de Tasación pública (/f/<slug>) — catálogo de preguntas
// ============================================================
// Fuente única de qué se pregunta, a quién y con qué etiquetas.
//
// La regla del formulario: cada pregunta declara a qué tipos de propiedad
// aplica. A un terreno no se le pregunta por la cocina; a una casa no se le
// pregunta por la baulera del edificio. Ninguna variante quedó más larga que
// el formulario único anterior — el terreno pasó de 22 preguntas a 10.
//
// El CRM importa los mismos mapas para mostrar la respuesta con el texto que
// eligió la persona, no con el código guardado.

export type PropertyType = 'departamento' | 'casa' | 'ph' | 'local' | 'oficina' | 'terreno'

export const ALL_TYPES: PropertyType[] = ['departamento', 'casa', 'ph', 'local', 'oficina', 'terreno']

/** Grupos que usan las preguntas para declarar aplicabilidad. */
const VIVIENDA: PropertyType[] = ['departamento', 'casa', 'ph']
/** Unidad dentro de un edificio: tiene piso, unidad y reglamento. */
const EN_EDIFICIO: PropertyType[] = ['departamento', 'ph', 'local', 'oficina']
/** Todo lo que tiene metros construidos. */
const CONSTRUIDO: PropertyType[] = ['departamento', 'casa', 'ph', 'local', 'oficina']
const COMERCIAL: PropertyType[] = ['local', 'oficina']
/** Lo que se apoya en un lote propio. */
const CON_LOTE: PropertyType[] = ['casa', 'ph', 'terreno']

export interface FichaOption {
  value: string
  label: string
}

/** Un valor fijo, o uno que depende del tipo de propiedad. */
type PerType<T> = T | ((t: PropertyType) => T)

function resolve<T>(v: PerType<T> | undefined, t: PropertyType): T | undefined {
  return typeof v === 'function' ? (v as (t: PropertyType) => T)(t) : v
}

export type QuestionKind = 'text' | 'number' | 'pills' | 'multipills' | 'textarea'

export interface Question {
  /** Nombre del campo en `fichas_tasacion`. */
  key: string
  kind: QuestionKind
  step: number
  appliesTo: PropertyType[]
  /** Obligatoria cuando está visible. Puede depender del tipo. */
  required?: PerType<boolean>
  label: PerType<string>
  hint?: PerType<string | undefined>
  placeholder?: PerType<string | undefined>
  options?: PerType<FichaOption[]>
  /** Mensaje cuando falta y es obligatoria. */
  missing?: string
  /**
   * Sólo se muestra si la respuesta previa lo amerita: la UF de la cochera
   * no tiene sentido si contestó que no tiene cochera.
   */
  showIf?: (answers: Record<string, unknown>) => boolean
  /**
   * Multivalor: opción que anula a las demás ("Ninguno", "Sin balcón").
   * Elegirla limpia el resto, y elegir cualquier otra la limpia a ella.
   */
  exclusive?: PerType<string>
}

// ── Catálogos de opciones ───────────────────────────────────

export const PROPERTY_TYPE_OPTIONS: FichaOption[] = [
  { value: 'departamento', label: 'Departamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'ph', label: 'PH' },
  { value: 'local', label: 'Local' },
  { value: 'oficina', label: 'Oficina' },
  { value: 'terreno', label: 'Terreno' },
]

export const OPERATION_OPTIONS: FichaOption[] = [
  { value: 'venta', label: 'Vender' },
  { value: 'alquiler', label: 'Alquilar' },
  { value: 'ambas', label: 'Ambas' },
]

export const ROOMS_OPTIONS: FichaOption[] = [
  { value: '1', label: 'Monoambiente' },
  { value: '2', label: '2 ambientes' },
  { value: '3', label: '3 ambientes' },
  { value: '4', label: '4 ambientes' },
  { value: '5', label: '5 o más' },
]

export const FLOORS_OPTIONS: FichaOption[] = [
  { value: '1', label: '1 planta' },
  { value: '2', label: '2 plantas' },
  { value: '3', label: '3 o más' },
]

export const BATHROOMS_OPTIONS: FichaOption[] = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3 o más' },
]

/** Cocina de vivienda. En local/oficina la pregunta es otra (ver abajo). */
export const KITCHEN_OPTIONS: FichaOption[] = [
  { value: 'independiente', label: 'Independiente' },
  { value: 'integrada', label: 'Integrada al living' },
]

export const KITCHEN_COMERCIAL_OPTIONS: FichaOption[] = [
  { value: 'kitchenette', label: 'Tiene kitchenette' },
  { value: 'cocina', label: 'Tiene cocina' },
  { value: 'no_tiene', label: 'No tiene' },
]

export const FURNISHED_OPTIONS: FichaOption[] = [
  { value: 'si', label: 'Sí, amueblado' },
  { value: 'no', label: 'No' },
  { value: 'parcial', label: 'Parcialmente' },
]

export const FURNISHED_COMERCIAL_OPTIONS: FichaOption[] = [
  { value: 'si', label: 'Sí, instalado' },
  { value: 'no', label: 'Vacío' },
  { value: 'parcial', label: 'Parcialmente' },
]

export const LIGHT_OPTIONS: FichaOption[] = [
  { value: 'muy_luminoso', label: 'Muy luminoso' },
  { value: 'luminoso', label: 'Luminoso' },
  { value: 'poco_luminoso', label: 'Poco luminoso' },
]

/** Espacio exterior de una unidad en edificio. Se puede tener más de uno. */
export const BALCONY_NONE = 'sin_balcon'

export const BALCONY_OPTIONS: FichaOption[] = [
  { value: BALCONY_NONE, label: 'Sin balcón' },
  { value: 'balcon', label: 'Balcón' },
  { value: 'aterrazado', label: 'Balcón aterrazado' },
  { value: 'terraza_patio', label: 'Terraza / patio propio' },
]

/**
 * Espacio exterior de casa o PH: la pregunta útil es otra, y se puede marcar
 * más de una (jardín al frente y terraza arriba es un caso común).
 */
export const OUTDOOR_NONE = 'sin_exterior'

export const OUTDOOR_OPTIONS: FichaOption[] = [
  { value: OUTDOOR_NONE, label: 'Sin espacio exterior' },
  { value: 'patio', label: 'Patio' },
  { value: 'jardin', label: 'Jardín' },
  { value: 'terraza', label: 'Terraza' },
  { value: 'balcon', label: 'Balcón' },
]

export const PARKING_OPTIONS: FichaOption[] = [
  { value: 'no_tiene', label: 'No tiene' },
  { value: 'fija_cubierta', label: 'Fija cubierta' },
  { value: 'fija_descubierta', label: 'Fija descubierta' },
  { value: 'alquila_aparte', label: 'Se alquila aparte' },
]

export const PARKING_CASA_OPTIONS: FichaOption[] = [
  { value: 'no_tiene', label: 'No tiene' },
  { value: 'fija_cubierta', label: 'Garage cubierto' },
  { value: 'fija_descubierta', label: 'Cochera descubierta' },
]

/** Baulera: se guarda en `storage_rooms` como cantidad (1 / 0). */
export const STORAGE_OPTIONS: FichaOption[] = [
  { value: '1', label: 'Sí' },
  { value: '0', label: 'No' },
]

export const PETS_OPTIONS: FichaOption[] = [
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
  { value: 'a_convenir', label: 'A convenir' },
]

export const PROFESSIONAL_OPTIONS: FichaOption[] = [
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
  { value: 'consultar', label: 'Hay que consultar el reglamento' },
]

/**
 * Una propiedad puede combinar sistemas (losa radiante abajo, splits arriba),
 * así que la pregunta admite varias. "No tiene" es excluyente.
 */
export const HEATING_NONE = 'no_tiene'

export const HEATING_OPTIONS: FichaOption[] = [
  { value: 'central', label: 'Central' },
  { value: 'losa_radiante', label: 'Losa radiante' },
  { value: 'radiadores', label: 'Radiadores' },
  { value: 'split', label: 'Split' },
  { value: 'estufas', label: 'Estufas' },
  { value: 'individual_gas', label: 'Individual (gas)' },
  { value: HEATING_NONE, label: 'No tiene' },
]

export const WAREHOUSE_OPTIONS: FichaOption[] = [
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
]

/** Estado del lote. Se guarda en la columna `property_condition`, que ya existía. */
export const LAND_CONDITION_OPTIONS: FichaOption[] = [
  { value: 'baldio', label: 'Baldío' },
  { value: 'con_construccion', label: 'Con construcción usable' },
  { value: 'a_demoler', label: 'Con construcción a demoler' },
]

/** `Ninguno` es excluyente: elegirlo deselecciona el resto. */
export const AMENITIES_NONE = 'Ninguno'

export const AMENITIES_OPTIONS: FichaOption[] = [
  { value: 'Pileta', label: 'Pileta' },
  { value: 'SUM', label: 'SUM' },
  { value: 'Parrilla', label: 'Parrilla' },
  { value: 'Gimnasio', label: 'Gimnasio' },
  { value: 'Laundry', label: 'Laundry' },
  { value: 'Solárium', label: 'Solárium' },
  { value: 'Seguridad 24 hs', label: 'Seguridad 24 hs' },
  { value: AMENITIES_NONE, label: 'Ninguno' },
]

/** En casa/PH los extras son propios, no del edificio. */
export const AMENITIES_CASA_OPTIONS: FichaOption[] = [
  { value: 'Pileta', label: 'Pileta' },
  { value: 'Quincho', label: 'Quincho' },
  { value: 'Parrilla', label: 'Parrilla' },
  { value: 'Barrio cerrado', label: 'Barrio cerrado' },
  { value: 'Seguridad 24 hs', label: 'Seguridad 24 hs' },
  { value: AMENITIES_NONE, label: 'Ninguno' },
]

export const UTILITIES_NONE = 'Ninguno'

export const UTILITIES_OPTIONS: FichaOption[] = [
  { value: 'Agua', label: 'Agua' },
  { value: 'Luz', label: 'Luz' },
  { value: 'Gas', label: 'Gas' },
  { value: 'Cloacas', label: 'Cloacas' },
  { value: 'Pavimento', label: 'Pavimento' },
  { value: UTILITIES_NONE, label: 'Ninguno' },
]

// ── Las preguntas ───────────────────────────────────────────

export const QUESTIONS: Question[] = [
  // ── Paso 1: qué es y dónde está ──
  {
    key: 'property_type', kind: 'pills', step: 1, appliesTo: ALL_TYPES, required: true,
    label: '¿Qué querés tasar?', options: PROPERTY_TYPE_OPTIONS,
    missing: 'Elegí qué tipo de propiedad es.',
  },
  {
    key: 'operation', kind: 'pills', step: 1, appliesTo: ALL_TYPES, required: true,
    label: '¿Qué querés hacer?', options: OPERATION_OPTIONS,
    missing: 'Contanos si querés vender, alquilar o las dos.',
  },
  {
    key: 'address', kind: 'text', step: 1, appliesTo: ALL_TYPES, required: true,
    label: 'Dirección', hint: 'Calle y número', placeholder: 'Av. Libertador 2340',
    missing: 'Necesitamos la dirección de la propiedad.',
  },
  {
    key: 'neighborhood', kind: 'text', step: 1, appliesTo: ALL_TYPES, required: true,
    label: 'Zona', hint: 'Barrio o localidad', placeholder: 'Martínez',
    missing: 'Contanos en qué barrio o localidad está.',
  },
  {
    key: 'floor_number', kind: 'text', step: 1, appliesTo: EN_EDIFICIO, required: true,
    label: 'Piso', hint: 'Podés poner "PB"', placeholder: '5',
    missing: 'Indicá el piso (poné "PB" si es planta baja).',
  },
  {
    key: 'unit', kind: 'text', step: 1, appliesTo: EN_EDIFICIO,
    label: 'Letra / unidad', placeholder: 'B',
  },

  // ── Paso 2: superficies y distribución ──
  // Las tres superficies van juntas y el formulario muestra el total en vivo.
  // Se declaran aproximadas a propósito: la medición certificada viene después.
  {
    key: 'covered_area', kind: 'number', step: 2, appliesTo: CONSTRUIDO, required: true,
    label: 'Superficie cubierta', hint: 'En m². Aproximado está bien.', placeholder: '78',
    missing: 'Necesitamos al menos los metros cubiertos.',
  },
  {
    key: 'semi_area', kind: 'number', step: 2, appliesTo: CONSTRUIDO,
    label: 'Semicubierta', hint: 'Balcones, galerías, cocheras techadas', placeholder: '8',
  },
  {
    key: 'uncovered_area', kind: 'number', step: 2, appliesTo: CONSTRUIDO,
    label: 'Descubierta', hint: 'Patio, terraza, jardín', placeholder: '20',
  },
  {
    key: 'land_area', kind: 'number', step: 2, appliesTo: CON_LOTE,
    required: (t) => t !== 'ph',
    label: 'Superficie del terreno', hint: 'En m²', placeholder: '300',
    missing: 'Necesitamos la superficie del terreno.',
  },
  {
    key: 'frontage_m', kind: 'number', step: 2, appliesTo: ['terreno', 'local'],
    label: (t) => (t === 'local' ? 'Frente / vidriera' : 'Frente'),
    hint: 'En metros', placeholder: '10',
  },
  {
    key: 'depth_m', kind: 'number', step: 2, appliesTo: ['terreno'],
    label: 'Fondo', hint: 'En metros', placeholder: '30',
  },
  {
    key: 'property_condition', kind: 'pills', step: 2, appliesTo: ['terreno'], required: true,
    label: '¿Cómo está el lote?', options: LAND_CONDITION_OPTIONS,
    missing: 'Contanos cómo está el lote.',
  },
  {
    key: 'rooms', kind: 'pills', step: 2, appliesTo: VIVIENDA, required: true,
    label: 'Ambientes', options: ROOMS_OPTIONS,
    missing: 'Elegí cuántos ambientes tiene.',
  },
  {
    key: 'floors_count', kind: 'pills', step: 2, appliesTo: ['casa', 'ph'],
    label: 'Plantas', options: FLOORS_OPTIONS,
  },
  {
    key: 'bathrooms', kind: 'pills', step: 2, appliesTo: CONSTRUIDO,
    label: 'Baños', options: BATHROOMS_OPTIONS,
  },
  {
    key: 'kitchen_type', kind: 'pills', step: 2, appliesTo: CONSTRUIDO, required: true,
    label: 'Cocina',
    options: (t) => (COMERCIAL.includes(t) ? KITCHEN_COMERCIAL_OPTIONS : KITCHEN_OPTIONS),
    missing: 'Elegí la opción de cocina.',
  },
  {
    key: 'furnished', kind: 'pills', step: 2, appliesTo: CONSTRUIDO, required: true,
    label: (t) => (COMERCIAL.includes(t) ? '¿Está instalado?' : 'Amueblado'),
    options: (t) => (COMERCIAL.includes(t) ? FURNISHED_COMERCIAL_OPTIONS : FURNISHED_OPTIONS),
    missing: 'Contanos si está amueblado.',
  },
  {
    key: 'age', kind: 'number', step: 2, appliesTo: CONSTRUIDO,
    label: 'Antigüedad', hint: 'En años', placeholder: '18',
  },

  // ── Paso 3: detalles que mueven el precio ──
  {
    key: 'light_level', kind: 'pills', step: 3, appliesTo: CONSTRUIDO,
    label: 'Luminosidad', options: LIGHT_OPTIONS,
  },
  {
    // Un local a la calle no tiene balcón; una oficina en torre sí.
    key: 'balcony_type', kind: 'multipills', step: 3,
    appliesTo: ['departamento', 'casa', 'ph', 'oficina'], required: true,
    label: (t) => (['casa', 'ph'].includes(t) ? 'Espacio exterior' : 'Balcón'),
    hint: 'Podés marcar más de uno',
    options: (t) => (['casa', 'ph'].includes(t) ? OUTDOOR_OPTIONS : BALCONY_OPTIONS),
    exclusive: (t) => (['casa', 'ph'].includes(t) ? OUTDOOR_NONE : BALCONY_NONE),
    missing: 'Elegí la opción de espacio exterior.',
  },
  {
    key: 'parking_type', kind: 'pills', step: 3, appliesTo: CONSTRUIDO, required: true,
    label: 'Cochera',
    options: (t) => (['casa'].includes(t) ? PARKING_CASA_OPTIONS : PARKING_OPTIONS),
    missing: 'Elegí la opción de cochera.',
  },
  {
    key: 'parking_unit', kind: 'text', step: 3, appliesTo: CONSTRUIDO,
    showIf: (a) => !!a.parking_type && a.parking_type !== 'no_tiene' && a.parking_type !== 'alquila_aparte',
    label: 'Unidad funcional de la cochera',
    hint: 'Número o UF, si lo tenés a mano', placeholder: 'UF 42 — cochera 17',
  },
  {
    key: 'storage_rooms', kind: 'pills', step: 3, appliesTo: ['departamento'],
    label: 'Baulera', options: STORAGE_OPTIONS,
  },
  {
    key: 'storage_unit', kind: 'text', step: 3, appliesTo: ['departamento'],
    showIf: (a) => a.storage_rooms === '1',
    label: 'Número de baulera',
    hint: 'Si lo tenés a mano', placeholder: 'Baulera 8'
  },
  {
    // Al comprador no le condiciona el reglamento igual que al inquilino:
    // la pregunta sólo aparece si la propiedad se ofrece en alquiler.
    key: 'pets_allowed', kind: 'pills', step: 3, appliesTo: ['departamento', 'ph'], required: true,
    showIf: (a) => a.operation === 'alquiler' || a.operation === 'ambas',
    label: 'Apto mascota', options: PETS_OPTIONS,
    missing: 'Contanos si es apto mascota.',
  },
  {
    key: 'is_professional', kind: 'pills', step: 3, appliesTo: ['departamento', 'ph'], required: true,
    label: 'Apto profesional', options: PROFESSIONAL_OPTIONS,
    missing: 'Contanos si es apto profesional.',
  },
  {
    key: 'commercial_use', kind: 'text', step: 3, appliesTo: COMERCIAL,
    label: '¿Está habilitado?', hint: 'Para qué rubro, si lo sabés',
    placeholder: 'Gastronomía',
  },
  {
    key: 'has_warehouse', kind: 'pills', step: 3, appliesTo: ['local'],
    label: '¿Tiene depósito?', options: WAREHOUSE_OPTIONS,
  },
  {
    key: 'zoning', kind: 'text', step: 3, appliesTo: ['terreno'],
    label: 'Zonificación', hint: 'Si la sabés', placeholder: 'R2b1',
  },
  {
    key: 'utilities', kind: 'multipills', step: 3, appliesTo: ['terreno'],
    label: 'Servicios en la puerta', options: UTILITIES_OPTIONS, exclusive: UTILITIES_NONE,
  },

  // ── Paso 4: gastos y extras ──
  {
    // Pileta y gimnasio no son preguntas para un local a la calle.
    key: 'amenities', kind: 'multipills', step: 4,
    appliesTo: ['departamento', 'casa', 'ph', 'oficina'], exclusive: AMENITIES_NONE,
    label: (t) => (['casa', 'ph'].includes(t) ? 'Extras' : 'Amenities'),
    options: (t) => (['casa', 'ph'].includes(t) ? AMENITIES_CASA_OPTIONS : AMENITIES_OPTIONS),
  },
  {
    key: 'heating_type', kind: 'multipills', step: 4, appliesTo: CONSTRUIDO,
    label: 'Calefacción', hint: 'Podés marcar más de una',
    options: HEATING_OPTIONS, exclusive: HEATING_NONE,
  },
  {
    key: 'expenses', kind: 'number', step: 4, appliesTo: CONSTRUIDO,
    label: 'Expensas',
    hint: 'Monto mensual aproximado en pesos', placeholder: '180000',
  },
]

// ── Helpers ─────────────────────────────────────────────────

/** Preguntas visibles para un tipo, en el orden del catálogo. */
export function questionsFor(type: PropertyType, step: number): Question[] {
  return QUESTIONS.filter(q => q.step === step && q.appliesTo.includes(type))
}

/**
 * Pasos que tienen al menos una pregunta para este tipo. Un terreno no tiene
 * nada que contestar en "gastos y extras", así que ese paso no se muestra.
 * El paso final (datos del propietario) se agrega siempre.
 */
export function stepsFor(type: PropertyType): number[] {
  const withQuestions = [1, 2, 3, 4].filter(s => questionsFor(type, s).length > 0)
  return [...withQuestions, 5]
}

export const STEP_TITLES: Record<number, PerType<string>> = {
  1: 'La propiedad',
  // Un local no tiene "ambientes" y un terreno no tiene superficie cubierta.
  2: (t) =>
    t === 'terreno' ? 'El terreno' : COMERCIAL.includes(t) ? 'Superficies' : 'Superficies y ambientes',
  3: 'Detalles',
  4: 'Gastos y extras',
  5: 'Tus datos',
}

export function stepTitle(step: number, type: PropertyType): string {
  return resolve(STEP_TITLES[step], type) ?? ''
}

export function labelOf(options: FichaOption[], value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null
  const v = String(value)
  return options.find(o => o.value === v)?.label ?? v
}

/** Resuelve un atributo de la pregunta para un tipo concreto. */
export function attr<T>(v: PerType<T> | undefined, t: PropertyType): T | undefined {
  return resolve(v, t)
}
