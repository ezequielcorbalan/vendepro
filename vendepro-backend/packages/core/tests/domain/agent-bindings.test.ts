// tests/domain/agent-bindings.test.ts
import { describe, it, expect } from 'vitest'
import { resolveAgentBindings } from '../../src/domain/value-objects/agent-bindings'
import { AgentProfile } from '../../src/domain/entities/agent-profile'
import type { Block } from '../../src/domain/value-objects/block-schemas'

const user = { full_name: 'Andrés Giunta', photo_url: 'https://cdn/andres.jpg', phone: '+5491100000000' }

const profile = AgentProfile.create({
  user_id: 'u1', org_id: 'o1', slug: 'andres-giunta',
  headline: 'Coordinador Comercial', bio: 'Vendo en Caballito',
  license: 'CUCICBA 3906', zones: ['Caballito'], whatsapp: '+5491130045087',
  instagram: 'el.actor.inmobiliario',
})

const heroBindeado = (): Block => ({
  id: 'b1', type: 'agent-hero', visible: true, binding: 'agent_profile',
  data: {
    name: 'PLACEHOLDER', headline: 'PLACEHOLDER', bio: 'PLACEHOLDER',
    photo_url: 'https://cdn/placeholder.jpg', ctas: [], accent_color: 'pink',
  },
} as Block)

describe('resolveAgentBindings', () => {
  it('rellena agent-hero con los datos del perfil y del user', () => {
    const [b] = resolveAgentBindings([heroBindeado()], { user, profile })
    expect((b.data as any).name).toBe('Andrés Giunta')
    expect((b.data as any).headline).toBe('Coordinador Comercial')
    expect((b.data as any).bio).toBe('Vendo en Caballito')
    expect((b.data as any).photo_url).toBe('https://cdn/andres.jpg')
  })

  it('no toca bloques sin binding', () => {
    const sinBinding = { ...heroBindeado(), binding: undefined } as Block
    const [b] = resolveAgentBindings([sinBinding], { user, profile })
    expect((b.data as any).name).toBe('PLACEHOLDER')
  })

  it('conserva el valor del bloque cuando el perfil no tiene el dato', () => {
    const sinFoto = { ...user, photo_url: null }
    const [b] = resolveAgentBindings([heroBindeado()], { user: sinFoto, profile })
    expect((b.data as any).photo_url).toBe('https://cdn/placeholder.jpg')
  })

  it('conserva el valor del bloque cuando el array del perfil está vacío', () => {
    const vacio = AgentProfile.create({ user_id: 'u1', org_id: 'o1', slug: 'xyz' })
    const cred: Block = {
      id: 'b2', type: 'agent-credentials', visible: true, binding: 'agent_profile',
      data: { zones: ['Fallback'], specialties: [], stats: [] },
    } as Block
    const [b] = resolveAgentBindings([cred], { user, profile: vacio })
    expect((b.data as any).zones).toEqual(['Fallback'])
  })

  it('rellena el teléfono de cta-whatsapp desde el whatsapp del perfil', () => {
    const cta: Block = {
      id: 'b3', type: 'cta-whatsapp', visible: true, binding: 'agent_profile',
      data: { title: '¿Vendemos?', phone: '+540000000000', button_label: 'Escribime' },
    } as Block
    const [b] = resolveAgentBindings([cta], { user, profile })
    expect((b.data as any).phone).toBe('+5491130045087')
  })

  it('no rompe si el merge produciría algo inválido: devuelve el bloque original', () => {
    const malo = { ...heroBindeado(), data: { ...(heroBindeado().data as any) } } as Block
    const userSinNombre = { ...user, full_name: '' }
    const [b] = resolveAgentBindings([malo], { user: userSinNombre, profile })
    expect((b.data as any).name).toBe('PLACEHOLDER')
  })

  it('no muta los bloques de entrada', () => {
    const input = [heroBindeado()]
    resolveAgentBindings(input, { user, profile })
    expect((input[0].data as any).name).toBe('PLACEHOLDER')
  })
})
