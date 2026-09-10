export type PropertyStatus = 'active' | 'sold' | 'suspended' | 'archived' | 'inactive'

const VALID_STATUS_TRANSITIONS: Record<PropertyStatus, PropertyStatus[]> = {
  active:    ['sold', 'suspended', 'archived', 'inactive'],
  suspended: ['active', 'archived'],
  inactive:  ['active', 'archived'],
  sold:      ['archived'],
  archived:  [],
}

export function canTransitionPropertyStatus(from: PropertyStatus, to: PropertyStatus): boolean {
  return VALID_STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Status operativo que corresponde a cada etapa comercial. `status` y
 * `commercial_stage` son campos separados (el status alimenta analytics y el
 * pill Activa/Vendida de las cards); si el cambio de etapa no lo deriva, una
 * propiedad "vencida" queda contando como aviso activo en toda la app.
 */
export function statusForPropertyStage(stage: string): PropertyStatus {
  switch (stage) {
    case 'vendida':
    case 'alquilada':
      return 'sold'
    case 'suspendida':
      return 'suspended'
    case 'vencida':
      return 'inactive'
    case 'perdida':
    case 'invalida':
    case 'archivada':
      return 'archived'
    default:
      return 'active'
  }
}
