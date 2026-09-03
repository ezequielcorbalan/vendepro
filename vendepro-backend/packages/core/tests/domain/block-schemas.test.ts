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

  // === agent-hero: límites de CTAs ===
  it('agent-hero acepta exactamente 3 CTAs', () => {
    const tres = Array.from({ length: 3 }, () => ({ label: 'x', href: 'https://x', style: 'primary' }))
    expect(validateBlock({ ...hero, data: { ...hero.data, ctas: tres } }).success).toBe(true)
  })

  it('agent-hero rechaza accent_color inválido', () => {
    expect(validateBlock({ ...hero, data: { ...hero.data, accent_color: 'blue' } }).success).toBe(false)
  })

  it('agent-hero rechaza CTA con style inválido', () => {
    const ctaBad = [{ label: 'x', href: 'https://x', style: 'invalid' }]
    expect(validateBlock({ ...hero, data: { ...hero.data, ctas: ctaBad } }).success).toBe(false)
  })

  // === agent-credentials: límites ===
  it('agent-credentials: zones acepta 12 y rechaza 13', () => {
    const cred12 = {
      id: 'b2', type: 'agent-credentials', visible: true,
      data: {
        zones: Array.from({ length: 12 }, (_, i) => `Zone${i}`),
        specialties: ['Residencial'],
        stats: [{ label: 'x', value: 'y' }],
      },
    }
    const cred13 = {
      id: 'b2', type: 'agent-credentials', visible: true,
      data: {
        zones: Array.from({ length: 13 }, (_, i) => `Zone${i}`),
        specialties: ['Residencial'],
        stats: [{ label: 'x', value: 'y' }],
      },
    }
    expect(validateBlock(cred12).success).toBe(true)
    expect(validateBlock(cred13).success).toBe(false)
  })

  it('agent-credentials: specialties acepta 8 y rechaza 9', () => {
    const cred8 = {
      id: 'b2', type: 'agent-credentials', visible: true,
      data: {
        zones: ['Z1'],
        specialties: Array.from({ length: 8 }, (_, i) => `Spec${i}`),
        stats: [{ label: 'x', value: 'y' }],
      },
    }
    const cred9 = {
      id: 'b2', type: 'agent-credentials', visible: true,
      data: {
        zones: ['Z1'],
        specialties: Array.from({ length: 9 }, (_, i) => `Spec${i}`),
        stats: [{ label: 'x', value: 'y' }],
      },
    }
    expect(validateBlock(cred8).success).toBe(true)
    expect(validateBlock(cred9).success).toBe(false)
  })

  it('agent-credentials: stats acepta 4 y rechaza 5', () => {
    const cred4 = {
      id: 'b2', type: 'agent-credentials', visible: true,
      data: {
        zones: ['Z1'],
        specialties: ['S1'],
        stats: Array.from({ length: 4 }, (_, i) => ({ label: `l${i}`, value: `v${i}` })),
      },
    }
    const cred5 = {
      id: 'b2', type: 'agent-credentials', visible: true,
      data: {
        zones: ['Z1'],
        specialties: ['S1'],
        stats: Array.from({ length: 5 }, (_, i) => ({ label: `l${i}`, value: `v${i}` })),
      },
    }
    expect(validateBlock(cred4).success).toBe(true)
    expect(validateBlock(cred5).success).toBe(false)
  })

  it('agent-credentials: years_experience acepta 0 y 70, rechaza -1 y 71', () => {
    const mk = (yrs: number) => ({
      id: 'b2', type: 'agent-credentials', visible: true,
      data: {
        years_experience: yrs,
        zones: ['Z1'],
        specialties: ['S1'],
        stats: [{ label: 'x', value: 'y' }],
      },
    })
    expect(validateBlock(mk(0)).success).toBe(true)
    expect(validateBlock(mk(70)).success).toBe(true)
    expect(validateBlock(mk(-1)).success).toBe(false)
    expect(validateBlock(mk(71)).success).toBe(false)
  })

  it('agent-credentials rechaza years_experience no-entero', () => {
    expect(validateBlock({
      id: 'b2', type: 'agent-credentials', visible: true,
      data: {
        years_experience: 12.5,
        zones: ['Z1'],
        specialties: ['S1'],
        stats: [{ label: 'x', value: 'y' }],
      },
    }).success).toBe(false)
  })

  // === faq: límite superior ===
  it('faq: acepta 12 items y rechaza 13', () => {
    const mk = (n: number) => ({
      id: 'b3', type: 'faq', visible: true,
      data: { title: 'FAQ', items: Array.from({ length: n }, (_, i) => ({ question: `q${i}`, answer: `a${i}` })) },
    })
    expect(validateBlock(mk(12)).success).toBe(true)
    expect(validateBlock(mk(13)).success).toBe(false)
  })

  // === cta-whatsapp: campos requeridos aislados ===
  it('cta-whatsapp exige title (aislado)', () => {
    expect(validateBlock({
      id: 'b4', type: 'cta-whatsapp', visible: true,
      data: { phone: '+549', button_label: 'Click' },
    }).success).toBe(false)
  })

  it('cta-whatsapp exige phone (aislado)', () => {
    expect(validateBlock({
      id: 'b4', type: 'cta-whatsapp', visible: true,
      data: { title: 'Vende', button_label: 'Click' },
    }).success).toBe(false)
  })

  it('cta-whatsapp exige button_label (aislado)', () => {
    expect(validateBlock({
      id: 'b4', type: 'cta-whatsapp', visible: true,
      data: { title: 'Vende', phone: '+549' },
    }).success).toBe(false)
  })
})
