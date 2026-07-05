/**
 * Mapping id externo → contacto de VendéPro, por org y provider.
 * Garantiza idempotencia del sync: un contacto externo ya importado
 * (o matcheado por email/teléfono) no se vuelve a procesar.
 */
export interface IntegrationLinkRepository {
  findContactId(orgId: string, provider: string, externalId: string): Promise<string | null>
  /** Batch para el sync: 1 query por página en vez de 1 por contacto. */
  findContactIds(orgId: string, provider: string, externalIds: string[]): Promise<Record<string, string>>
  /** INSERT OR IGNORE — un link existente no se pisa. */
  save(orgId: string, provider: string, externalId: string, contactId: string): Promise<void>
}
