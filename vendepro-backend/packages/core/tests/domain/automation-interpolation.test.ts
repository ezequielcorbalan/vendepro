import { describe, it, expect } from 'vitest'
import {
  interpolate,
  extractTokens,
  unknownTokens,
  htmlToText,
} from '../../src/domain/rules/automation-interpolation'

const ctx = {
  lead: { full_name: 'Ana Pérez', email: 'ana@mail.com', phone: null },
  org: { name: 'Marcela Genta Operaciones' },
}

describe('interpolate', () => {
  it('reemplaza variables simples y tolera espacios en el token', () => {
    expect(interpolate('Hola {{lead.full_name}}', ctx)).toBe('Hola Ana Pérez')
    expect(interpolate('Hola {{ lead.full_name }}', ctx)).toBe('Hola Ana Pérez')
  })

  it('deriva first_name del nombre completo', () => {
    expect(interpolate('Hola {{lead.first_name}}', ctx)).toBe('Hola Ana')
  })

  it('nunca deja el token crudo: una variable sin valor renderiza vacío', () => {
    expect(interpolate('Tel: {{lead.phone}}', ctx)).toBe('Tel: ')
    expect(interpolate('Dir: {{property.address}}', ctx)).toBe('Dir: ')
    expect(interpolate('Hola {{lead.nope}}', ctx)).not.toContain('{{')
  })

  it('usa el fallback cuando el valor falta o está vacío', () => {
    expect(interpolate('Hola {{lead.phone|sin teléfono}}', ctx)).toBe('Hola sin teléfono')
    expect(interpolate('Hola {{lead.full_name|cliente}}', ctx)).toBe('Hola Ana Pérez')
  })

  it('escapa el valor en modo html — el nombre lo carga un tercero', () => {
    const hostile = { lead: { full_name: '<script>alert(1)</script>' } }
    const out = interpolate('<p>Hola {{lead.full_name}}</p>', hostile, { mode: 'html' })
    expect(out).toBe('<p>Hola &lt;script&gt;alert(1)&lt;/script&gt;</p>')
    expect(out).not.toContain('<script>')
  })

  it('no escapa en modo texto', () => {
    const raw = { lead: { full_name: 'Ana & Juan' } }
    expect(interpolate('{{lead.full_name}}', raw)).toBe('Ana & Juan')
  })

  it('devuelve string vacío ante template nulo', () => {
    expect(interpolate(null, ctx)).toBe('')
    expect(interpolate(undefined, ctx)).toBe('')
  })
})

describe('extractTokens / unknownTokens', () => {
  it('lista los tokens usados sin repetir', () => {
    expect(extractTokens('{{a.b}} y {{a.b}} y {{c.d}}')).toEqual(['a.b', 'c.d'])
  })

  it('marca las variables que no existen para el trigger', () => {
    const available = ['lead.full_name', 'org.name']
    expect(unknownTokens('Hola {{lead.full_name}} de {{org.name}}', available)).toEqual([])
    expect(unknownTokens('{{property.address}}', available)).toEqual(['property.address'])
  })

  it('no marca first_name si el full_name está disponible', () => {
    expect(unknownTokens('{{lead.first_name}}', ['lead.full_name'])).toEqual([])
  })
})

describe('htmlToText', () => {
  it('genera la versión plana que Resend necesita junto al html', () => {
    const html = '<p>Hola Ana</p><p>Gracias por contactarte.<br>Te escribimos pronto.</p>'
    expect(htmlToText(html)).toBe('Hola Ana\n\nGracias por contactarte.\nTe escribimos pronto.')
  })

  it('desarma listas y entidades', () => {
    expect(htmlToText('<ul><li>Uno</li><li>Dos &amp; medio</li></ul>')).toBe('• Uno\n• Dos & medio')
  })
})
