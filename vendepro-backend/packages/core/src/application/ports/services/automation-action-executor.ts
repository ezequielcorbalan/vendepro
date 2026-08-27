import type { AutomationContext } from '../../../domain/rules/automation-conditions'

/**
 * Contrato de un ejecutor de acción. Cada `action_type` del catálogo tiene el
 * suyo, registrado en `AutomationExecutorRegistry` (infrastructure).
 *
 * Un ejecutor NUNCA lanza por un problema de datos esperable (destinatario sin
 * email, contacto dado de baja): devuelve `skipped` con el motivo. Reserva las
 * excepciones para fallas de infraestructura, que sí ameritan reintento.
 */
export interface ActionExecutionInput {
  orgId: string
  /** Config de la acción, con las variables YA interpoladas. */
  config: Record<string, unknown>
  /** Contexto del evento: { lead, contact, property, agent, org, stage, now }. */
  context: AutomationContext
  /** Datos crudos de la acción, por si el ejecutor necesita re-interpolar. */
  rawConfig: Record<string, unknown>
  automationId: string
  runId: string
}

export type ActionOutcome =
  | { status: 'success'; result?: Record<string, unknown> }
  | { status: 'skipped'; reason: string }

export interface AutomationActionExecutor {
  readonly type: string
  execute(input: ActionExecutionInput): Promise<ActionOutcome>
}

export interface AutomationExecutorRegistry {
  /** null si la acción no tiene ejecutor en este worker — se registra `skipped`. */
  get(actionType: string): AutomationActionExecutor | null
}
