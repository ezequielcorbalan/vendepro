import {
  RunAutomationsForEventUseCase,
  DrainAutomationJobsUseCase,
  BuildAutomationContextUseCase,
  type RunAutomationsForEventOutput,
  type EntityType,
} from '@vendepro/core'
import { D1AutomationRepository } from '../repositories/d1-automation-repository'
import { D1AutomationRunRepository } from '../repositories/d1-automation-run-repository'
import { D1AutomationJobRepository } from '../repositories/d1-automation-job-repository'
import { D1LeadRepository } from '../repositories/d1-lead-repository'
import { D1ContactRepository } from '../repositories/d1-contact-repository'
import { D1PropertyRepository } from '../repositories/d1-property-repository'
import { D1UserRepository } from '../repositories/d1-user-repository'
import { D1OrganizationRepository } from '../repositories/d1-organization-repository'
import { D1EmailSettingsRepository } from '../repositories/d1-email-settings-repository'
import { D1EmailSuppressionRepository } from '../repositories/d1-email-suppression-repository'
import { D1NotificationRepository } from '../repositories/d1-notification-repository'
import { ResendEmailService } from './resend-email-service'
import { HmacUnsubscribeTokenSigner } from './unsubscribe-token-signer-impl'
import { CryptoIdGenerator } from './crypto-id-generator'
import {
  SendEmailActionExecutor,
  NotifyAgentActionExecutor,
  MapExecutorRegistry,
} from './automation-executors'

/**
 * Entorno mínimo para el motor. `RESEND_API_KEY` es opcional: sin ella el
 * worker igual encola los jobs, y los ejecuta el cron de api-crm que sí la
 * tiene. Eso es lo que permite disparar eventos desde api-properties sin
 * repartir el secret por todos los workers.
 */
export interface AutomationEnv {
  DB: D1Database
  JWT_SECRET: string
  RESEND_API_KEY?: string
  PUBLIC_BASE_URL?: string
}

const DEFAULT_PUBLIC_BASE_URL = 'https://www.marcelagenta.com'

export function createAutomationRunner(env: AutomationEnv): RunAutomationsForEventUseCase {
  return new RunAutomationsForEventUseCase(
    new D1AutomationRepository(env.DB),
    new D1AutomationRunRepository(env.DB),
    new D1AutomationJobRepository(env.DB),
    new CryptoIdGenerator(),
  )
}

export function createAutomationContextBuilder(env: AutomationEnv): BuildAutomationContextUseCase {
  return new BuildAutomationContextUseCase(
    new D1LeadRepository(env.DB),
    new D1ContactRepository(env.DB),
    new D1PropertyRepository(env.DB),
    new D1UserRepository(env.DB),
    new D1OrganizationRepository(env.DB),
  )
}

/**
 * Registry de ejecutores disponibles en este worker. Las acciones sin ejecutor
 * quedan registradas como `skipped: not_implemented` en vez de reintentarse.
 */
export function createAutomationRegistry(env: AutomationEnv): MapExecutorRegistry {
  const publicBaseUrl = env.PUBLIC_BASE_URL ?? DEFAULT_PUBLIC_BASE_URL
  const executors = [
    new NotifyAgentActionExecutor(
      new D1NotificationRepository(env.DB),
      new D1UserRepository(env.DB),
      new CryptoIdGenerator(),
    ),
  ]

  if (env.RESEND_API_KEY) {
    executors.push(
      new SendEmailActionExecutor(
        new D1EmailSettingsRepository(env.DB),
        new D1EmailSuppressionRepository(env.DB),
        new ResendEmailService(env.RESEND_API_KEY),
        new HmacUnsubscribeTokenSigner(env.JWT_SECRET),
        publicBaseUrl,
      ) as any,
    )
  }

  return new MapExecutorRegistry(executors as any)
}

export function createAutomationDrainer(env: AutomationEnv): DrainAutomationJobsUseCase {
  return new DrainAutomationJobsUseCase(
    new D1AutomationJobRepository(env.DB),
    new D1AutomationRunRepository(env.DB),
    createAutomationRegistry(env),
  )
}

export interface FireAutomationEventInput {
  orgId: string
  trigger: string
  entityType: EntityType
  entityId: string
  stage?: { from?: string | null; to?: string | null }
  depth?: number
}

/**
 * Dispara un evento de automatización "fire-and-forget": arma el contexto,
 * evalúa las automatizaciones y encola sus acciones. Cualquier error se logea
 * y se traga — crear un lead nunca puede fallar porque una automatización esté
 * mal configurada.
 *
 * No ejecuta nada: para que las acciones inmediatas salgan en el acto hay que
 * encadenar `drainAutomationJobs` dentro de `ctx.waitUntil`.
 */
export async function fireAutomationEvent(
  env: AutomationEnv,
  input: FireAutomationEventInput,
): Promise<RunAutomationsForEventOutput | null> {
  try {
    const context = await createAutomationContextBuilder(env).execute({
      orgId: input.orgId,
      entityType: input.entityType,
      entityId: input.entityId,
      stage: input.stage,
      publicBaseUrl: env.PUBLIC_BASE_URL ?? DEFAULT_PUBLIC_BASE_URL,
    })

    return await createAutomationRunner(env).execute({
      orgId: input.orgId,
      trigger: input.trigger,
      entityType: input.entityType,
      entityId: input.entityId,
      context,
      event: { to_stage: input.stage?.to ?? null, from_stage: input.stage?.from ?? null },
      depth: input.depth ?? 0,
    })
  } catch (err) {
    console.error('[automations] fireAutomationEvent failed (swallowed):', (err as Error)?.message ?? err)
    return null
  }
}

/**
 * Drena la cola de la org. Pensado para `ctx.waitUntil` justo después de
 * disparar un evento: las acciones sin delay salen dentro del mismo request.
 */
export async function drainAutomationJobs(
  env: AutomationEnv,
  opts: { orgId?: string; limit?: number } = {},
): Promise<void> {
  try {
    await createAutomationDrainer(env).execute(opts)
  } catch (err) {
    console.error('[automations] drain failed (swallowed):', (err as Error)?.message ?? err)
  }
}

/**
 * Dispara y drena en un solo paso. Es lo que se pasa a `ctx.waitUntil` desde
 * un route handler.
 */
export async function fireAndDrainAutomations(
  env: AutomationEnv,
  input: FireAutomationEventInput,
): Promise<void> {
  const result = await fireAutomationEvent(env, input)
  if (result && result.queued > 0) await drainAutomationJobs(env, { orgId: input.orgId })
}
