import { describe, it, expect } from 'vitest'
import {
  renderEmailHtml,
  renderEmailText,
  extractContentFragment,
  VENDEPRO_BRAND,
} from '../../src/domain/rules/email-template'

const brand = { name: 'Marcela Genta', logoUrl: null, color: '#123456', accentColor: '#abcdef' }

describe('renderEmailHtml', () => {
  it('devuelve un documento completo con el contenido adentro', () => {
    const html = renderEmailHtml({ brand, contentHtml: '<p>Hola Ana</p>' })

    expect(html).toMatch(/^<!DOCTYPE html>/)
    expect(html).toContain('<p>Hola Ana</p>')
    expect(html).toContain('</html>')
    // Un solo documento, no uno adentro del otro.
    expect(html.match(/<html/gi)).toHaveLength(1)
    expect(html.match(/<body/gi)).toHaveLength(1)
  })

  it('muestra el nombre de la marca y su color', () => {
    const html = renderEmailHtml({ brand, contentHtml: '<p>x</p>' })
    expect(html).toContain('Marcela Genta')
    expect(html).toContain('#123456')
    expect(html).toContain('#abcdef')
  })

  it('usa el logo cuando la org tiene uno', () => {
    const html = renderEmailHtml({
      brand: { ...brand, logoUrl: 'https://cdn.mg.com/logo.png' },
      contentHtml: '<p>x</p>',
    })
    expect(html).toContain('<img src="https://cdn.mg.com/logo.png"')
    expect(html).toContain('alt="Marcela Genta"')
  })

  it('siempre firma con VendéPro', () => {
    const html = renderEmailHtml({ brand, contentHtml: '<p>x</p>' })
    expect(html).toContain('Enviado con VendéPro')
  })

  it('agrega el link de baja al footer cuando se lo pasan', () => {
    const html = renderEmailHtml({
      brand,
      contentHtml: '<p>x</p>',
      unsubscribeUrl: 'https://vendepro.com.ar/u/tok123',
    })
    expect(html).toContain('https://vendepro.com.ar/u/tok123')
    expect(html).toContain('Cancelar suscripción')
  })

  it('no deja rastro del footer de baja si no hay link', () => {
    const html = renderEmailHtml({ brand, contentHtml: '<p>x</p>' })
    expect(html).not.toContain('Cancelar suscripción')
  })

  it('incluye el preheader oculto', () => {
    const html = renderEmailHtml({ brand, contentHtml: '<p>x</p>', preheader: 'Tu propiedad se publicó' })
    expect(html).toContain('Tu propiedad se publicó')
    expect(html).toContain('display:none')
  })

  // El branding lo carga un admin desde el panel: no puede inyectar CSS ni un
  // esquema `javascript:` en el atributo style / en el href.
  it('descarta un color que no sea hex', () => {
    const html = renderEmailHtml({
      brand: { ...brand, color: 'red;background:url(evil)' },
      contentHtml: '<p>x</p>',
    })
    expect(html).not.toContain('url(evil)')
    expect(html).toContain(VENDEPRO_BRAND.color!)
  })

  it('descarta un logo que no sea http(s)', () => {
    const html = renderEmailHtml({
      brand: { ...brand, logoUrl: 'javascript:alert(1)' },
      contentHtml: '<p>x</p>',
    })
    expect(html).not.toContain('javascript:')
    expect(html).toContain('Marcela Genta')
  })

  it('escapa el nombre de la marca', () => {
    const html = renderEmailHtml({ brand: { ...brand, name: '<script>x</script>' }, contentHtml: '<p>y</p>' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('cae a la marca de la plataforma si el nombre viene vacío', () => {
    const html = renderEmailHtml({ brand: { name: '  ' }, contentHtml: '<p>x</p>' })
    expect(html).toContain('VendéPro')
  })
})

describe('extractContentFragment', () => {
  it('deja pasar un fragmento tal cual', () => {
    expect(extractContentFragment('<p>Hola</p>')).toBe('<p>Hola</p>')
  })

  it('saca el cuerpo de un documento completo', () => {
    const doc = '<!DOCTYPE html><html><head><style>p{color:red}</style></head><body><p>Hola</p></body></html>'
    expect(extractContentFragment(doc)).toBe('<p>Hola</p>')
  })

  it('desarma un documento sin <body> explícito', () => {
    const doc = '<html><head><title>t</title></head><p>Hola</p></html>'
    const out = extractContentFragment(doc)
    expect(out).toContain('<p>Hola</p>')
    expect(out).not.toContain('<html')
    expect(out).not.toContain('<title>')
  })

  // Es el caso que motiva la función: una campaña vieja guardada como documento
  // completo tiene que quedar con UN marco, no con dos.
  it('re-enmarca un documento completo sin anidar html', () => {
    const doc = '<html><body><p>Campaña vieja</p></body></html>'
    const html = renderEmailHtml({ brand, contentHtml: doc })
    expect(html.match(/<html/gi)).toHaveLength(1)
    expect(html).toContain('<p>Campaña vieja</p>')
  })
})

describe('renderEmailText', () => {
  it('firma con la marca y con VendéPro', () => {
    const text = renderEmailText({ brand, contentText: 'Hola Ana' })
    expect(text).toContain('Hola Ana')
    expect(text).toContain('Marcela Genta')
    expect(text).toContain('Enviado con VendéPro')
  })

  it('agrega el link de baja cuando corresponde', () => {
    const text = renderEmailText({ brand, contentText: 'Hola', unsubscribeUrl: 'https://x.com/u/t' })
    expect(text).toContain('https://x.com/u/t')
  })

  it('no menciona la baja si no hay link', () => {
    const text = renderEmailText({ brand, contentText: 'Hola' })
    expect(text).not.toContain('dejar de recibir')
  })
})
