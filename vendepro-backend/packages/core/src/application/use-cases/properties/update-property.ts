import type { PropertyRepository } from '../../ports/repositories/property-repository'

// La columna properties.status tiene un CHECK en inglés
// (active/sold/suspended/archived/inactive), pero el catálogo property_statuses
// usa slugs en español. Mapeamos slug -> valor permitido antes de escribir para
// no violar el CHECK. Los valores ya válidos pasan sin cambios.
const STATUS_ALLOWED = ['active', 'sold', 'suspended', 'archived', 'inactive']
const STATUS_SLUG_MAP: Record<string, string> = {
  activa: 'active',
  vendida: 'sold',
  alquilada: 'sold',
  reservada: 'active',
  suspendida: 'suspended',
  archivada: 'archived',
  inactiva: 'inactive',
}
function normalizeStatus(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  if (STATUS_ALLOWED.includes(value)) return value
  return STATUS_SLUG_MAP[value] ?? 'active'
}

export class UpdatePropertyUseCase {
  constructor(private readonly propRepo: PropertyRepository) {}

  async execute(id: string, orgId: string, patch: Record<string, unknown>): Promise<void> {
    const existing = await this.propRepo.findById(id, orgId)
    if (!existing) {
      const err = new Error('Property not found')
      ;(err as any).statusCode = 404
      throw err
    }
    // Normaliza el status para respetar el CHECK constraint de la columna.
    const safePatch = 'status' in patch
      ? { ...patch, status: normalizeStatus(patch.status) }
      : patch
    await this.propRepo.update(id, orgId, safePatch)
  }
}
