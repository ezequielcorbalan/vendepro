import { Hono } from 'hono'
import { corsMiddleware, errorHandler, createAuthMiddleware, D1LeadRepository, D1PropertyRepository, D1ReservationRepository, D1CalendarRepository, JwtAuthService } from '@reportes/infrastructure'
import { GetDashboardStatsUseCase } from '@reportes/core'

type Env = { DB: D1Database; JWT_SECRET: string }
type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

const app = new Hono<{ Bindings: Env } & AuthVars>()

app.use('*', corsMiddleware)
app.onError(errorHandler)

app.use('*', async (c, next) => {
  return createAuthMiddleware(new JwtAuthService(c.env.JWT_SECRET))(c, next)
})

app.get('/dashboard', async (c) => {
  const { agent_id } = c.req.query()
  const useCase = new GetDashboardStatsUseCase(
    new D1LeadRepository(c.env.DB),
    new D1PropertyRepository(c.env.DB),
    new D1ReservationRepository(c.env.DB),
    new D1CalendarRepository(c.env.DB),
  )
  const stats = await useCase.execute(c.get('orgId'), agent_id)
  return c.json(stats)
})

app.get('/search', async (c) => {
  const { q } = c.req.query()
  if (!q || q.length < 2) return c.json([])
  const db = c.env.DB
  const orgId = c.get('orgId')
  const like = `%${q}%`

  const [leads, contacts, properties] = await Promise.all([
    db.prepare(`SELECT 'lead' as type, id, full_name as label FROM leads WHERE org_id = ? AND full_name LIKE ? LIMIT 5`).bind(orgId, like).all(),
    db.prepare(`SELECT 'contact' as type, id, full_name as label FROM contacts WHERE org_id = ? AND full_name LIKE ? LIMIT 5`).bind(orgId, like).all(),
    db.prepare(`SELECT 'property' as type, id, address as label FROM properties WHERE org_id = ? AND address LIKE ? LIMIT 5`).bind(orgId, like).all(),
  ])

  return c.json([
    ...(leads.results as any[]),
    ...(contacts.results as any[]),
    ...(properties.results as any[]),
  ])
})

app.get('/export', async (c) => {
  const { type } = c.req.query()
  const db = c.env.DB
  const orgId = c.get('orgId')

  if (type === 'leads') {
    const rows = (await db.prepare(`SELECT l.*, u.full_name as assigned_name FROM leads l LEFT JOIN users u ON l.assigned_to = u.id WHERE l.org_id = ? ORDER BY l.created_at DESC`).bind(orgId).all()).results
    return c.json(rows)
  }

  return c.json({ error: 'Unknown export type' }, 400)
})

export default app
