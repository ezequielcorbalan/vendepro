import { EnrollOnEventUseCase, type EnrollOnEventInput } from '@vendepro/core'
import { D1EmailAutomationRepository } from '../repositories/d1-email-automation-repository'
import { D1EmailAutomationEnrollmentRepository } from '../repositories/d1-email-automation-enrollment-repository'
import { CryptoIdGenerator } from './crypto-id-generator'

/**
 * Inscribe un destinatario en las automatizaciones activas que matchean el
 * evento, "fire-and-forget": cualquier error se traga para no bloquear el
 * flujo de negocio (creación de lead / cambio de stage). Espejo de
 * `fireMarketingEvent`.
 */
export async function enrollInAutomations(
  env: { DB: D1Database },
  input: EnrollOnEventInput,
): Promise<void> {
  try {
    const uc = new EnrollOnEventUseCase(
      new D1EmailAutomationRepository(env.DB),
      new D1EmailAutomationEnrollmentRepository(env.DB),
      new CryptoIdGenerator(),
    )
    await uc.execute(input)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[automations] enrollInAutomations failed (swallowed):', (err as Error)?.message ?? err)
  }
}
