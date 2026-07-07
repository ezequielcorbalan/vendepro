import type { EmailAutomationRepository } from '../../ports/repositories/email-automation-repository'
import type { EmailAutomationStatus } from '../../../domain/entities/email-automation'
import { NotFoundError } from '../../../domain/errors/not-found'
import { ValidationError } from '../../../domain/errors/validation-error'

/**
 * Activa o pausa una automatización. Activar valida que tenga pasos
 * completos. Pausar detiene el envío de nuevos pasos (los inscriptos
 * quedan congelados; al reactivar retoman).
 */
export class SetAutomationStatusUseCase {
  constructor(private readonly repo: EmailAutomationRepository) {}

  async execute(id: string, orgId: string, status: EmailAutomationStatus): Promise<{ ok: true }> {
    const automation = await this.repo.findById(id, orgId)
    if (!automation) throw new NotFoundError('Automatización no encontrada')
    if (status === 'active') {
      automation.assertActivatable()
    }
    if (status !== 'active' && status !== 'paused' && status !== 'draft') {
      throw new ValidationError('Estado inválido')
    }
    automation.update({ status })
    await this.repo.save(automation)
    return { ok: true }
  }
}
