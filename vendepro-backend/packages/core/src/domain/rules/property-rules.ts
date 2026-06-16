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

// The legacy `properties.status` column (and its CHECK constraint) speaks the
// English domain enum, but the property_statuses catalog uses Spanish slugs and
// the frontend sends those. Translate catalog/Spanish slugs to the domain enum.
// 'reservada' has no domain status — a reserved property is still on-market, so
// it maps to 'active' (the reservation itself lives in commercial_stage).
const STATUS_SLUG_TO_DOMAIN: Record<string, PropertyStatus> = {
  active: 'active', activa: 'active', reservada: 'active', reserved: 'active',
  sold: 'sold', vendida: 'sold',
  suspended: 'suspended', suspendida: 'suspended',
  archived: 'archived', archivada: 'archived',
  inactive: 'inactive', inactiva: 'inactive',
}

/** Maps a catalog/Spanish/English status slug to the domain enum, or null if unknown. */
export function normalizePropertyStatus(slug: unknown): PropertyStatus | null {
  if (typeof slug !== 'string') return null
  return STATUS_SLUG_TO_DOMAIN[slug.trim().toLowerCase()] ?? null
}
