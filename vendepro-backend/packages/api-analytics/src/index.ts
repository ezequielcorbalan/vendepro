import { Hono } from 'hono'
import { corsMiddleware, errorHandler, createAuthMiddleware, D1LeadRepository, D1PropertyRepository, D1ReservationRepository, D1CalendarRepository, JwtAuthService } from '@vendepro/infrastructure'
import { GetDashboardStatsUseCase } from '@vendepro/core'

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
  const db = c.env.DB
  const orgId = c.get('orgId')

  const useCase = new GetDashboardStatsUseCase(
    new D1LeadRepository(db),
    new D1PropertyRepository(db),
    new D1ReservationRepository(db),
    new D1CalendarRepository(db),
  )
  const base = await useCase.execute(orgId, agent_id)

  // ── Leads by stage ────────────────────────────────────────────
  const sb = base.stageBreakdown
  const leads = {
    total: base.totalLeads,
    nuevo: sb['nuevo'] ?? 0,
    asignado: sb['asignado'] ?? 0,
    contactados: sb['contactado'] ?? 0,
    calificados: sb['calificado'] ?? 0,
    en_tasacion: sb['en_tasacion'] ?? 0,
    presentados: sb['presentada'] ?? 0,
    seguimiento: sb['seguimiento'] ?? 0,
    captados: sb['captado'] ?? 0,
    perdidos: sb['perdido'] ?? 0,
    archivados: sb['archivado'] ?? 0,
  }

  // ── Funnel ────────────────────────────────────────────────────
  const funnelStages = [
    { key: 'nuevo', label: 'Nuevo' },
    { key: 'contactado', label: 'Contactado' },
    { key: 'calificado', label: 'Calificado' },
    { key: 'en_tasacion', label: 'En tasación' },
    { key: 'presentada', label: 'Presentada' },
    { key: 'captado', label: 'Captado' },
  ]
  const funnel = funnelStages.map(s => ({
    stage: s.key,
    label: s.label,
    count: sb[s.key] ?? 0,
    pct: base.totalLeads > 0 ? Math.round(((sb[s.key] ?? 0) / base.totalLeads) * 100) : 0,
  }))

  // ── Conversion rate ───────────────────────────────────────────
  const conversionRate = base.totalLeads > 0
    ? Math.round(((sb['captado'] ?? 0) / base.totalLeads) * 100)
    : 0

  // ── Overdue leads (urgent) ────────────────────────────────────
  const overdueLeads = base.urgentLeads

  // ── Tasaciones from DB ────────────────────────────────────────
  let tasaciones = { total: 0, captadas: 0 }
  try {
    const [totalRow, captadasRow] = await Promise.all([
      db.prepare(`SELECT COUNT(*) as cnt FROM appraisals WHERE org_id = ?`).bind(orgId).first() as Promise<any>,
      db.prepare(`SELECT COUNT(*) as cnt FROM appraisals WHERE org_id = ? AND stage = 'captado'`).bind(orgId).first() as Promise<any>,
    ])
    tasaciones = { total: totalRow?.cnt ?? 0, captadas: captadasRow?.cnt ?? 0 }
  } catch { /* appraisals table may not exist yet */ }

  // ── Activity stats (last 30 days) ─────────────────────────────
  let activity = { total: 0, llamadas: 0, reuniones: 0, visitas: 0 }
  let weeklyActivity: { day: string; count: number }[] = []
  let recentActivities: any[] = []
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const agentFilter = agent_id ? ' AND agent_id = ?' : ''
    const agentBinds: unknown[] = agent_id ? [orgId, thirtyDaysAgo, agent_id] : [orgId, thirtyDaysAgo]

    const acts = (await db.prepare(
      `SELECT activity_type, created_at FROM activities WHERE org_id = ? AND created_at >= ?${agentFilter} LIMIT 500`
    ).bind(...agentBinds).all()).results as any[]

    activity = {
      total: acts.length,
      llamadas: acts.filter((a: any) => a.activity_type === 'llamada').length,
      reuniones: acts.filter((a: any) => a.activity_type === 'reunion').length,
      visitas: acts.filter((a: any) => ['visita_captacion', 'visita_comprador'].includes(a.activity_type)).length,
    }

    // Weekly activity (last 7 days)
    const dayMap: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      dayMap[d.toISOString().split('T')[0]] = 0
    }
    acts.forEach((a: any) => {
      const day = (a.created_at as string).split('T')[0]
      if (day in dayMap) dayMap[day]++
    })
    weeklyActivity = Object.entries(dayMap).map(([day, count]) => ({ day, count }))

    // Recent activities (last 5)
    recentActivities = (await db.prepare(
      `SELECT a.*, u.full_name as agent_name FROM activities a LEFT JOIN users u ON a.agent_id = u.id WHERE a.org_id = ? ORDER BY a.created_at DESC LIMIT 5`
    ).bind(orgId).all()).results as any[]
  } catch { /* activities table may not exist yet */ }

  // ── Today's events ────────────────────────────────────────────
  let todayEvents: any[] = []
  try {
    const today = new Date().toISOString().split('T')[0]
    todayEvents = (await db.prepare(
      `SELECT * FROM calendar_events WHERE org_id = ? AND date(start_at) = ? AND status != 'cancelled' ORDER BY start_at ASC LIMIT 20`
    ).bind(orgId, today).all()).results as any[]
  } catch { /* calendar_events table may not exist yet */ }

  // ── Pending followups ─────────────────────────────────────────
  let pendingFollowups: any[] = []
  try {
    const now = new Date().toISOString()
    pendingFollowups = (await db.prepare(
      `SELECT id, full_name, next_step, next_step_date, stage FROM leads WHERE org_id = ? AND next_step_date <= ? AND stage NOT IN ('captado','perdido','archivado') ORDER BY next_step_date ASC LIMIT 10`
    ).bind(orgId, now).all()).results as any[]
  } catch { /* leads table may not exist yet */ }

  // ── Pipeline breakdown for dashboard ─────────────────────────
  const pipelineBreakdown = Object.fromEntries(
    Object.entries(sb).map(([k, v]) => [k, v])
  )

  return c.json({
    leads,
    overdueLeads,
    tasaciones,
    activity,
    weeklyActivity,
    todayEvents,
    pendingFollowups,
    agentPerformance: [],
    funnel,
    conversionRate,
    recentActivities,
    pipelineBreakdown,
  })
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
