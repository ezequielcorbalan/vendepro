import type { BlockType } from './types'

/** Espejo de AGENT_BINDINGS del backend (core/src/domain/value-objects/agent-bindings.ts).
 *  Si cambia allá, cambiar acá. */
export const AGENT_BINDINGS: Partial<Record<BlockType, Record<string, string>>> = {
  'agent-hero': {
    name: 'user.full_name', headline: 'headline', bio: 'bio',
    photo_url: 'user.photo_url', background_image_url: 'cover_image_url',
  },
  'agent-credentials': {
    license: 'license', years_experience: 'years_experience',
    zones: 'zones', specialties: 'specialties', stats: 'stats',
  },
  'cta-whatsapp': { phone: 'whatsapp' },
  'footer': { phone: 'whatsapp', instagram: 'instagram', agency_registration: 'license' },
}

export function isBoundField(blockType: BlockType, field: string, binding?: string): boolean {
  if (binding !== 'agent_profile') return false
  return Boolean(AGENT_BINDINGS[blockType]?.[field])
}
