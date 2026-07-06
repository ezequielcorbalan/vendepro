import type { EmailSuppressionRepository } from '../../ports/repositories/email-suppression-repository'
import type { UnsubscribeTokenSigner } from '../../ports/services/unsubscribe-token-signer'
import type { IdGenerator } from '../../ports/id-generator'
import { EmailSuppression } from '../../../domain/entities/email-suppression'

export interface ProcessUnsubscribeResult {
  ok: boolean
  /** Email dado de baja (para mostrar confirmación). Null si token inválido. */
  email: string | null
}

/**
 * Procesa un link de baja (/u/:token): verifica la firma y agrega el
 * email a la lista de supresión de la org. Idempotente: repetir el
 * click no falla.
 */
export class ProcessUnsubscribeUseCase {
  constructor(
    private readonly signer: UnsubscribeTokenSigner,
    private readonly suppressionRepo: EmailSuppressionRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(token: string): Promise<ProcessUnsubscribeResult> {
    const payload = await this.signer.verify(token)
    if (!payload) return { ok: false, email: null }

    const suppression = EmailSuppression.create({
      id: this.idGenerator.generate(),
      org_id: payload.orgId,
      email: payload.email,
      reason: 'unsubscribe',
      source: 'link',
    })
    await this.suppressionRepo.add(suppression)
    return { ok: true, email: suppression.email }
  }
}
