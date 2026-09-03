import type { Block, BlockType } from './block-schemas'
import { validateBlock } from './block-schemas'
import type { AgentProfile } from '../entities/agent-profile'

export interface AgentBindingUser {
  full_name: string
  photo_url: string | null
  phone: string | null
}

/**
 * Qué campo del bloque se llena con qué dato. Prefijo `user.` = viene de la
 * tabla users; sin prefijo = viene de agent_profiles.
 * Fuente única: la usan el resolver público y el preview del editor.
 */
export const AGENT_BINDINGS: Partial<Record<BlockType, Record<string, string>>> = {
  'agent-hero': {
    name: 'user.full_name',
    headline: 'headline',
    bio: 'bio',
    photo_url: 'user.photo_url',
    background_image_url: 'cover_image_url',
  },
  'agent-credentials': {
    license: 'license',
    years_experience: 'years_experience',
    zones: 'zones',
    specialties: 'specialties',
    stats: 'stats',
  },
  'cta-whatsapp': {
    phone: 'whatsapp',
  },
  'footer': {
    phone: 'whatsapp',
    instagram: 'instagram',
    agency_registration: 'license',
  },
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
}

function readSource(path: string, ctx: { user: AgentBindingUser; profile: AgentProfile }): unknown {
  if (path.startsWith('user.')) {
    return (ctx.user as unknown as Record<string, unknown>)[path.slice(5)]
  }
  return (ctx.profile as unknown as Record<string, unknown>)[path]
}

/**
 * Rellena los bloques marcados con `binding: 'agent_profile'` con los datos
 * vivos del agente. Un campo vacío en el perfil deja el valor del bloque, que
 * funciona como fallback editorial. Si el merge produce un bloque inválido,
 * se devuelve el original: la landing nunca se rompe por un perfil incompleto.
 */
export function resolveAgentBindings(
  blocks: Block[],
  ctx: { user: AgentBindingUser; profile: AgentProfile },
): Block[] {
  return blocks.map((block) => {
    if (block.binding !== 'agent_profile') return block
    const map = AGENT_BINDINGS[block.type]
    if (!map) return block

    const data: Record<string, unknown> = { ...(block.data as Record<string, unknown>) }
    for (const [field, path] of Object.entries(map)) {
      const value = readSource(path, ctx)
      // Los arrays de AgentProfile (zones, specialties, stats) vienen por
      // referencia de los getters de la entidad — clonamos para que nadie
      // pueda mutar el estado interno del perfil a través del bloque resuelto.
      if (!isEmpty(value)) data[field] = Array.isArray(value) ? [...value] : value
    }

    const candidate = { ...block, data }
    const parsed = validateBlock(candidate)
    return parsed.success ? parsed.data : block
  })
}
