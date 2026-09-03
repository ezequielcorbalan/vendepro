import type { LandingKind } from './types'

/**
 * Label legible de un `LandingKind`. Única fuente para no repetir el mapeo:
 * lo usan el modal de creación (`NewLandingModal`), la tarjeta de listado
 * (`LandingCard`) y el detalle mobile (`LandingMobileInfo`). Si mañana se
 * agrega un `LandingKind` nuevo, TypeScript obliga a cubrirlo acá (switch
 * exhaustivo) en vez de dejarlo caer en un "Propiedad" por defecto en algún
 * lugar y no en otro.
 */
export function landingKindLabel(kind: LandingKind): string {
  switch (kind) {
    case 'lead_capture':
      return 'Captación'
    case 'property':
      return 'Propiedad'
    case 'agent_profile':
      return 'Mi perfil de agente'
  }
}
