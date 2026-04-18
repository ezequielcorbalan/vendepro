import { describe, it, expect } from 'vitest'
import { BLOCK_SCHEMAS, BlockSchema, validateBlock } from '../../src/domain/value-objects/block-schemas'

describe('block-schemas', () => {
  it('valida un hero válido', () => {
    const b = { id: 'x', type: 'hero', visible: true, data: { title: 'Hola', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 } }
    expect(validateBlock(b).success).toBe(true)
  })

  it('rechaza hero sin title', () => {
    const b = { id: 'x', type: 'hero', visible: true, data: { background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 } }
    expect(validateBlock(b).success).toBe(false)
  })

  it('rechaza overlay_opacity fuera de [0,1]', () => {
    const b = { id: 'x', type: 'hero', visible: true, data: { title: 't', background_image_url: 'https://x/y.jpg', overlay_opacity: 2 } }
    expect(validateBlock(b).success).toBe(false)
  })

  it('valida lead-form con fields name y phone', () => {
    const b = { id: 'f', type: 'lead-form', visible: true, data: {
      title: 'Contacto',
      fields: [
        { key: 'name', label: 'Nombre', required: true },
        { key: 'phone', label: 'Tel', required: true },
      ],
      submit_label: 'Enviar',
      success_message: 'Gracias',
    }}
    expect(validateBlock(b).success).toBe(true)
  })

  it('rechaza lead-form sin phone', () => {
    const b = { id: 'f', type: 'lead-form', visible: true, data: {
      title: 'Contacto',
      fields: [{ key: 'name', label: 'Nombre', required: true }],
      submit_label: 'Enviar',
      success_message: 'Gracias',
    }}
    expect(validateBlock(b).success).toBe(false)
  })

  it('valida gallery con 1 imagen', () => {
    const b = { id: 'g', type: 'gallery', visible: true, data: { layout: 'grid', images: [{ url: 'https://x/1.jpg', source: 'external' }] } }
    expect(validateBlock(b).success).toBe(true)
  })

  it('rechaza gallery vacío', () => {
    const b = { id: 'g', type: 'gallery', visible: true, data: { layout: 'grid', images: [] } }
    expect(validateBlock(b).success).toBe(false)
  })

  it('rechaza block con type desconocido', () => {
    const b = { id: 'x', type: 'unknown', visible: true, data: {} }
    expect(validateBlock(b).success).toBe(false)
  })
})
