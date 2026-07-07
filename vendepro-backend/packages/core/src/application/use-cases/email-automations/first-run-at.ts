import type { AutomationStep } from '../../../domain/entities/email-automation'

/**
 * Momento en que se debe enviar el primer paso de una inscripción:
 * ahora + la demora del paso 0. Con demora 0 sale en el próximo tick del cron.
 */
export function firstRunAt(steps: AutomationStep[], now = new Date()): string {
  const delayHours = steps[0]?.delay_hours ?? 0
  return new Date(now.getTime() + delayHours * 3600_000).toISOString()
}
