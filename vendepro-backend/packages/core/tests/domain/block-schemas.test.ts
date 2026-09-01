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

describe('bloques de agente', () => {
  const hero = {
    id: 'b1', type: 'agent-hero', visible: true, binding: 'agent_profile',
    data: {
      name: 'Andrés Giunta', headline: 'Coordinador Comercial',
      bio: 'Vendo propiedades en Caballito', photo_url: 'https://x/f.jpg',
      ctas: [{ label: 'Quiero vender', href: 'https://wa.me/5491130045087', style: 'whatsapp' }],
      accent_color: 'pink',
    },
  }

  it('acepta agent-hero con binding', () => {
    const r = validateBlock(hero)
    expect(r.success).toBe(true)
  })

  it('acepta agent-hero sin binding', () => {
    const { binding, ...sinBinding } = hero as any
    expect(validateBlock(sinBinding).success).toBe(true)
  })

  it('rechaza un binding desconocido', () => {
    expect(validateBlock({ ...hero, binding: 'otra_cosa' }).success).toBe(false)
  })

  it('agent-hero exige photo_url url válida', () => {
    expect(validateBlock({ ...hero, data: { ...hero.data, photo_url: 'no-es-url' } }).success).toBe(false)
  })

  it('agent-hero admite hasta 3 CTAs', () => {
    const cuatro = Array.from({ length: 4 }, () => ({ label: 'x', href: 'https://x', style: 'primary' }))
    expect(validateBlock({ ...hero, data: { ...hero.data, ctas: cuatro } }).success).toBe(false)
  })

  it('acepta agent-credentials', () => {
    expect(validateBlock({
      id: 'b2', type: 'agent-credentials', visible: true, binding: 'agent_profile',
      data: {
        title: 'Credenciales', license: 'CUCICBA 3906', years_experience: 12,
        zones: ['Saavedra', 'Belgrano'], specialties: ['Residencial'],
        stats: [{ label: 'Seguidores TikTok', value: '170.000' }],
      },
    }).success).toBe(true)
  })

  it('acepta faq con 2 items y rechaza con 1', () => {
    const mk = (n: number) => ({
      id: 'b3', type: 'faq', visible: true,
      data: { title: 'Preguntas', items: Array.from({ length: n }, (_, i) => ({ question: `q${i}`, answer: `a${i}` })) },
    })
    expect(validateBlock(mk(2)).success).toBe(true)
    expect(validateBlock(mk(1)).success).toBe(false)
  })

  it('acepta cta-whatsapp', () => {
    expect(validateBlock({
      id: 'b4', type: 'cta-whatsapp', visible: true, binding: 'agent_profile',
      data: { title: '¿Querés vender?', phone: '+5491130045087', button_label: 'Escribime', message_template: 'Hola Andrés' },
    }).success).toBe(true)
  })

  it('cta-whatsapp exige phone y button_label', () => {
    expect(validateBlock({
      id: 'b4', type: 'cta-whatsapp', visible: true,
      data: { title: 'x' },
    }).success).toBe(false)
  })
})
