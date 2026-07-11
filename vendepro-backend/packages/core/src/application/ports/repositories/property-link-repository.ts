/**
 * Mapeo genérico propiedad local ↔ aviso externo (tabla property_links).
 * Hoy lo escribe el sync de KiteProp (provider 'kiteprop'); cuando VendéPro
 * publique a portales, el publicador escribe acá los ids de aviso por provider.
 */
export interface PropertyLinkRepository {
  findPropertyId(orgId: string, provider: string, externalId: string): Promise<string | null>
  /** Idempotente (INSERT OR IGNORE): un link existente no se pisa. */
  save(orgId: string, provider: string, externalId: string, propertyId: string, externalCode?: string | null): Promise<void>
}
