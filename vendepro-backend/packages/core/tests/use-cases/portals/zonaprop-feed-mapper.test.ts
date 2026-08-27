import { describe, it, expect } from 'vitest'
import {
  buildZonapropFeed,
  feedValidationErrors,
  deriveTitle,
  deriveDescription,
  escapeXml,
  sanitizeXmlText,
  type FeedProperty,
  type FeedAdvertiser,
} from '../../../src/application/use-cases/portals/zonaprop-feed-mapper'

const advertiser: FeedAdvertiser = {
  name: 'Marcela Genta Operaciones Inmobiliarias',
  email: 'info@marcelagenta.com',
  phone: '+5491122334455',
}

function makeProperty(overrides: Partial<FeedProperty> = {}): FeedProperty {
  return {
    id: 'prop_1',
    title: null,
    description: null,
    operation_type: 'venta',
    property_type: 'departamento',
    address: 'Av. Santa Fe 1234, Piso 5',
    neighborhood: 'Recoleta',
    city: 'Buenos Aires',
    province: 'CABA',
    postal_code: 'C1059',
    latitude: -34.5955,
    longitude: -58.3925,
    rooms: 3,
    bathrooms: 2,
    size_m2: 95,
    covered_m2: 88,
    parking_spaces: 1,
    antiquity_years: 20,
    expenses: 85000,
    expenses_currency: 'ARS',
    asking_price: 210000,
    currency: 'USD',
    photos: ['https://cdn.test/1.jpg', 'https://cdn.test/2.jpg'],
    updated_at: '2026-08-20 14:30:00',
    public_slug: 'depto-recoleta-abc',
    ...overrides,
  }
}

function build(props: FeedProperty[]) {
  return buildZonapropFeed({
    properties: props,
    advertiser,
    publicBaseUrl: 'https://www.marcelagenta.com/',
  })
}

describe('buildZonapropFeed', () => {
  it('emite un XML con un <ad> por propiedad válida', () => {
    const r = build([makeProperty(), makeProperty({ id: 'prop_2' })])

    expect(r.included).toBe(2)
    expect(r.skipped).toEqual([])
    expect(r.xml.startsWith('<?xml version="1.0" encoding="UTF-8"?><ads>')).toBe(true)
    expect(r.xml.endsWith('</ads>')).toBe(true)
    expect(r.xml.match(/<ad>/g)).toHaveLength(2)
  })

  it('mapea los campos numéricos y los códigos de operación / tipo', () => {
    const { xml } = build([makeProperty()])

    expect(xml).toContain('<external_id>prop_1</external_id>')
    expect(xml).toContain('<operation_type>Venta</operation_type>')
    expect(xml).toContain('<property_type>Departamento</property_type>')
    expect(xml).toContain('<price>210000</price>')
    expect(xml).toContain('<currency>USD</currency>')
    expect(xml).toContain('<rooms>3</rooms>')
    expect(xml).toContain('<bathrooms>2</bathrooms>')
    expect(xml).toContain('<total_area>95</total_area>')
    expect(xml).toContain('<covered_area>88</covered_area>')
  })

  it('numera las fotos en orden a partir de 1', () => {
    const { xml } = build([makeProperty()])

    expect(xml).toContain(
      '<pictures>' +
        '<picture><picture_url>https://cdn.test/1.jpg</picture_url><picture_order>1</picture_order></picture>' +
        '<picture><picture_url>https://cdn.test/2.jpg</picture_url><picture_order>2</picture_order></picture>' +
        '</pictures>',
    )
  })

  it('arma la URL pública sin duplicar la barra de la base', () => {
    const { xml } = build([makeProperty()])
    expect(xml).toContain('<url>https://www.marcelagenta.com/r/depto-recoleta-abc</url>')
  })

  it('omite los tags de los campos nulos en vez de emitirlos vacíos', () => {
    const { xml } = build([
      makeProperty({ latitude: null, longitude: null, postal_code: null, antiquity_years: null }),
    ])

    expect(xml).not.toContain('<latitude>')
    expect(xml).not.toContain('<longitude>')
    expect(xml).not.toContain('<postal_code>')
    expect(xml).not.toContain('<age>')
  })

  it('no declara moneda de expensas cuando no hay expensas', () => {
    const { xml } = build([makeProperty({ expenses: null })])

    expect(xml).not.toContain('<expenses>')
    expect(xml).not.toContain('<expenses_currency>')
  })

  it('descarta la propiedad inválida y deja pasar el resto del feed', () => {
    const r = build([
      makeProperty({ id: 'ok_1' }),
      makeProperty({ id: 'sin_fotos', photos: [] }),
      makeProperty({ id: 'ok_2' }),
    ])

    expect(r.included).toBe(2)
    expect(r.skipped).toHaveLength(1)
    expect(r.skipped[0].id).toBe('sin_fotos')
    expect(r.skipped[0].errors).toContain('Necesita al menos una foto')
    expect(r.xml).not.toContain('sin_fotos')
  })

  it('usa título y descripción derivados cuando la propiedad no los tiene', () => {
    const { xml } = build([makeProperty()])

    expect(xml).toContain('<title><![CDATA[Departamento 3 ambientes en Recoleta]]></title>')
    expect(xml).toContain('<description><![CDATA[')
  })

  it('respeta el título y la descripción cargados a mano', () => {
    const { xml } = build([
      makeProperty({ title: '  Joya en Recoleta  ', description: 'Impecable.' }),
    ])

    expect(xml).toContain('<title><![CDATA[Joya en Recoleta]]></title>')
    expect(xml).toContain('<description><![CDATA[Impecable.]]></description>')
  })
})

describe('escapado y saneado de XML', () => {
  it('escapa los 5 caracteres reservados de XML', () => {
    expect(escapeXml(`a & b < c > d " e ' f`)).toBe(
      'a &amp; b &lt; c &gt; d &quot; e &apos; f',
    )
  })

  it('elimina los caracteres de control que romperían el parser', () => {
    expect(sanitizeXmlText('Depto\x0Bluminoso\x00')).toBe('Deptoluminoso')
    // Tab, LF y CR son válidos en XML 1.0 y deben sobrevivir.
    expect(sanitizeXmlText('a\tb\nc\rd')).toBe('a\tb\nc\rd')
  })

  it('escapa el ampersand de una dirección dentro de un tag simple', () => {
    const { xml } = build([makeProperty({ neighborhood: 'Villa Ortúzar & Chacarita' })])
    expect(xml).toContain('<neighborhood>Villa Ortúzar &amp; Chacarita</neighborhood>')
  })

  it('no deja que un "]]>" en la descripción cierre el CDATA antes de tiempo', () => {
    const { xml } = build([makeProperty({ description: 'Cierre ]]> inesperado' })])

    // El CDATA se parte en dos para neutralizar la secuencia.
    expect(xml).toContain('<description><![CDATA[Cierre ]]]]><![CDATA[> inesperado]]></description>')
    // Y sigue habiendo exactamente un tag de descripción bien cerrado.
    expect(xml.match(/<\/description>/g)).toHaveLength(1)
  })

  it('sanea los caracteres de control que vengan en el título', () => {
    const { xml } = build([makeProperty({ title: 'Depto\x0Cluminoso' })])
    expect(xml).toContain('<title><![CDATA[Deptoluminoso]]></title>')
  })
})

describe('feedValidationErrors', () => {
  it('acepta una propiedad completa', () => {
    expect(feedValidationErrors(makeProperty())).toEqual([])
  })

  it('rechaza precio ausente, cero o negativo', () => {
    expect(feedValidationErrors(makeProperty({ asking_price: null }))).toContain('Falta el precio')
    expect(feedValidationErrors(makeProperty({ asking_price: 0 }))).toContain('Falta el precio')
    expect(feedValidationErrors(makeProperty({ asking_price: -1 }))).toContain('Falta el precio')
  })

  it('rechaza dirección y barrio en blanco', () => {
    const errors = feedValidationErrors(makeProperty({ address: '   ', neighborhood: '' }))
    expect(errors).toContain('Falta la dirección')
    expect(errors).toContain('Falta el barrio')
  })

  it('rechaza un tipo de operación fuera del mapa de Navent', () => {
    const errors = feedValidationErrors(makeProperty({ operation_type: 'permuta' }))
    expect(errors).toContain('Tipo de operación no mapeado: "permuta"')
  })

  it('acumula todos los errores en vez de cortar en el primero', () => {
    const errors = feedValidationErrors(
      makeProperty({ asking_price: null, photos: [], address: '' }),
    )
    expect(errors).toHaveLength(3)
  })
})

describe('textos derivados', () => {
  it('singulariza "ambiente" en el monoambiente', () => {
    expect(deriveTitle(makeProperty({ rooms: 1 }))).toBe('Departamento 1 ambiente en Recoleta')
  })

  it('omite los ambientes cuando no están cargados', () => {
    expect(deriveTitle(makeProperty({ rooms: null }))).toBe('Departamento en Recoleta')
  })

  it('arma una descripción con los datos que existen', () => {
    const d = deriveDescription(makeProperty({ covered_m2: null, parking_spaces: null }))
    expect(d).toContain('95 m² totales')
    expect(d).not.toContain('m² cubiertos')
    expect(d).not.toContain('cochera')
    expect(d).toContain('Av. Santa Fe 1234')
  })
})
