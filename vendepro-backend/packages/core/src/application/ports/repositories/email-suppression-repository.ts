import type { EmailSuppression } from '../../../domain/entities/email-suppression'

export interface EmailSuppressionRepository {
  /** Alta idempotente: si (org_id, email) ya existe, no falla ni duplica. */
  add(suppression: EmailSuppression): Promise<void>
  findByEmail(orgId: string, email: string): Promise<EmailSuppression | null>
  listByOrg(orgId: string, limit?: number): Promise<EmailSuppression[]>
  remove(orgId: string, email: string): Promise<void>
}
