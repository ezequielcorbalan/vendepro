import { Hono } from 'hono'
import {
  ListAutomationsUseCase,
  GetAutomationUseCase,
  SaveAutomationUseCase,
  SetAutomationActiveUseCase,
  DeleteAutomationUseCase,
  ListAutomationCatalogUseCase,
  ActivateAutomationTemplateUseCase,
  GetAutomationsMetaUseCase,
  ListAutomationRunsUseCase,
} from '@vendepro/core'
import {
  D1AutomationRepository,
  D1AutomationRunRepository,
  D1AutomationJobRepository,
  CryptoIdGenerator,
  createAutomationContextBuilder,
  createAutomationRegistry,
  drainAutomationJobs,
  type AutomationEnv,
} from '@vendepro/infrastructure'
import { interpolateConfig } from '@vendepro/core'

type Env = AutomationEnv
/** Las setea el auth middleware de la app principal, antes de montar este router. */
type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

/**
 * ABM del motor de automatizaciones. Todo bajo `/automations`, sólo
 * admin/owner: una automatización mal configurada le manda mails a los
 * clientes de la inmobiliaria.
 */
export const automationsRoutes = new Hono<{ Bindings: Env } & AuthVars>()

function requireAdmin(c: any) {
  const role = c.get('userRole') as string
  if (role !== 'admin' && role !== 'owner') {
    return c.json({ error: 'Sin permisos (sólo admin/owner)' }, 403)
  }
  return null
}

const repos = (env: Env) => ({
  automations: new D1AutomationRepository(env.DB),
  runs: new D1AutomationRunRepository(env.DB),
  jobs: new D1AutomationJobRepository(env.DB),
  ids: new CryptoIdGenerator(),
})

// ── Metadatos del editor ──────────────────────────────────────
// Estático: alimenta los selects de triggers, acciones, operadores y
// variables sin que el frontend duplique el catálogo.
automationsRoutes.get('/automations/meta', async (c) => {
  return c.json(new GetAutomationsMetaUseCase().execute())
})

// ── Catálogo de recetas ───────────────────────────────────────
automationsRoutes.get('/automations/catalog', async (c) => {
  const { automations } = repos(c.env)
  const useCase = new ListAutomationCatalogUseCase(automations)
  return c.json(await useCase.execute(c.get('orgId')))
})

automationsRoutes.post('/automations/catalog/:key/activate', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  const { automations, ids } = repos(c.env)
  const useCase = new ActivateAutomationTemplateUseCase(automations, ids)
  const result = await useCase.execute({
    templateKey: c.req.param('key'),
    orgId: c.get('orgId'),
    userId: c.get('userId'),
    active: (await safeBody(c)).active !== false,
  })
  return c.json(result, 201)
})

// ── Ejecuciones ───────────────────────────────────────────────
// Antes que `/automations/:id`, si no Hono matchea 'runs' como id.
automationsRoutes.get('/automations/runs', async (c) => {
  const { runs } = repos(c.env)
  const { automation_id, status, entity_id, limit } = c.req.query()
  const useCase = new ListAutomationRunsUseCase(runs)
  return c.json(await useCase.execute(c.get('orgId'), {
    automationId: automation_id,
    status,
    entityId: entity_id,
    limit: limit ? Number(limit) : undefined,
  }))
})

// ── ABM ───────────────────────────────────────────────────────
automationsRoutes.get('/automations', async (c) => {
  const { automations, runs } = repos(c.env)
  const useCase = new ListAutomationsUseCase(automations, runs)
  return c.json(await useCase.execute(c.get('orgId')))
})

automationsRoutes.post('/automations', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  const body = (await c.req.json()) as any
  const { automations, ids } = repos(c.env)
  const useCase = new SaveAutomationUseCase(automations, ids)
  const result = await useCase.execute({
    ...body,
    orgId: c.get('orgId'),
    userId: c.get('userId'),
  })
  return c.json(result, 201)
})

automationsRoutes.get('/automations/:id', async (c) => {
  const { automations } = repos(c.env)
  const useCase = new GetAutomationUseCase(automations)
  return c.json(await useCase.execute(c.req.param('id'), c.get('orgId')))
})

automationsRoutes.put('/automations/:id', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  const body = (await c.req.json()) as any
  const { automations, ids } = repos(c.env)
  const useCase = new SaveAutomationUseCase(automations, ids)
  const result = await useCase.execute({
    ...body,
    id: c.req.param('id'),
    orgId: c.get('orgId'),
    userId: c.get('userId'),
  })
  return c.json(result)
})

automationsRoutes.post('/automations/:id/status', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  const body = (await c.req.json()) as any
  const { automations, jobs } = repos(c.env)
  const useCase = new SetAutomationActiveUseCase(automations, jobs)
  await useCase.execute({
    id: c.req.param('id'),
    orgId: c.get('orgId'),
    active: body.active === true,
  })
  return c.json({ success: true })
})

automationsRoutes.delete('/automations/:id', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  const { automations, jobs } = repos(c.env)
  const useCase = new DeleteAutomationUseCase(automations, jobs)
  await useCase.execute(c.req.param('id'), c.get('orgId'))
  return c.json({ success: true })
})

// ── Prueba en seco ────────────────────────────────────────────
/**
 * Renderiza las acciones contra una entidad real SIN ejecutar nada. Es el
 * botón "Probar" del editor: deja ver el mail exacto que recibiría el cliente,
 * con sus variables resueltas, antes de encender la automatización.
 */
automationsRoutes.post('/automations/:id/test', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  const body = (await c.req.json()) as any
  const orgId = c.get('orgId')
  const { automations } = repos(c.env)

  const found = await automations.findById(c.req.param('id'), orgId)
  if (!found) return c.json({ error: 'Automatización no encontrada' }, 404)

  const entityId = String(body.entity_id ?? '').trim()
  if (!entityId) return c.json({ error: 'Elegí una entidad de ejemplo para la prueba' }, 400)

  const context = await createAutomationContextBuilder(c.env).execute({
    orgId,
    entityType: found.automation.entity_type,
    entityId,
    stage: { from: body.from_stage ?? null, to: body.to_stage ?? null },
    publicBaseUrl: c.env.PUBLIC_BASE_URL,
  })

  const registry = createAutomationRegistry(c.env)
  return c.json({
    context,
    actions: found.actions.map((action) => ({
      action_type: action.action_type,
      delay_minutes: action.delay_minutes,
      // Lo que realmente se enviaría, con las variables ya resueltas.
      rendered: interpolateConfig(action.action_config, context),
      executable: registry.get(action.action_type) !== null,
    })),
  })
})

// ── Drenaje manual ────────────────────────────────────────────
// Escape hatch operativo: si el cron se atrasó, un admin puede forzar la
// pasada sin esperar los 15 minutos.
automationsRoutes.post('/automations/drain', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  await drainAutomationJobs(c.env, { orgId: c.get('orgId'), limit: 50 })
  return c.json({ success: true })
})

async function safeBody(c: any): Promise<any> {
  try {
    return (await c.req.json()) ?? {}
  } catch {
    return {}
  }
}
