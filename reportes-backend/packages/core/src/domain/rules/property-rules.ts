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
