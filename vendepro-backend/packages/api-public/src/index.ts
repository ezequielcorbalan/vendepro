import { Hono } from 'hono'
import { corsMiddleware, errorHandler } from '@vendepro/infrastructure'

type Env = { DB: D1Database }

const app = new Hono<{ Bindings: Env }>()

app.use('*', corsMiddleware)
app.onError(errorHandler)

// ── PUBLIC REPORT (/r/:slug) ───────────────────────────────────
app.get('/public/report/:slug', async (c) => {
  const db = c.env.DB
  const slug = c.req.param('slug')

  const property = await db.prepare('SELECT * FROM properties WHERE public_slug = ?').bind(slug).first()
  if (!property) return c.json({ error: 'Not found' }, 404)

  const report = await db.prepare('SELECT * FROM reports WHERE property_id = ? AND status = \'published\' ORDER BY created_at DESC LIMIT 1').bind((property as any).id).first()

  return c.json({ property, report: report ?? null })
})

// ── PUBLIC APPRAISAL (/t/:slug) ────────────────────────────────
app.get('/public/appraisal/:slug', async (c) => {
  const db = c.env.DB
  const slug = c.req.param('slug')

  const appraisal = await db.prepare('SELECT a.*, o.name as org_name, o.logo_url, o.brand_color FROM appraisals a LEFT JOIN organizations o ON a.org_id = o.id WHERE a.id = ? OR a.public_slug = ?').bind(slug, slug).first() as any
  if (!appraisal) return c.json({ error: 'Not found' }, 404)

  const blocks = (await db.prepare('SELECT * FROM tasacion_template_blocks WHERE org_id = ? AND enabled = 1 ORDER BY sort_order').bind(appraisal.org_id).all()).results

  return c.json({ appraisal, blocks })
})

// ── PUBLIC VISIT FORM (/v/:slug) ───────────────────────────────
app.get('/public/visit-form/:slug', async (c) => {
  const db = c.env.DB
  const row = await db.prepare('SELECT vf.*, p.address, p.neighborhood, o.name as org_name, o.logo_url, o.brand_color FROM visit_forms vf LEFT JOIN properties p ON vf.property_id = p.id LEFT JOIN organizations o ON p.org_id = o.id WHERE vf.public_slug = ?').bind(c.req.param('slug')).first()
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

app.post('/public/visit-form/:slug', async (c) => {
  // Record a visit form submission
  const body = (await c.req.json()) as any
  const db = c.env.DB
  const form = await db.prepare('SELECT * FROM visit_forms WHERE public_slug = ?').bind(c.req.param('slug')).first() as any
  if (!form) return c.json({ error: 'Not found' }, 404)

  const id = crypto.randomUUID().replace(/-/g, '')
  await db.prepare(`
    INSERT INTO visit_form_responses (id, form_id, visitor_name, visitor_phone, visitor_email, responses, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(id, form.id, body.name, body.phone, body.email, JSON.stringify(body.responses ?? {})).run()

  return c.json({ success: true })
})

// ── PUBLIC PREFACTIBILIDAD (/p/:slug) ──────────────────────────
app.get('/public/prefact/:slug', async (c) => {
  const row = await c.env.DB.prepare('SELECT pf.*, o.name as org_name, o.logo_url, o.brand_color FROM prefactibilidades pf LEFT JOIN organizations o ON pf.org_id = o.id WHERE pf.public_slug = ?').bind(c.req.param('slug')).first()
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

// ── PUBLIC LEADS (/public/leads) ─────────────────────────────────
app.post('/public/leads', async (c) => {
  const apiKey = c.req.header('X-API-Key')
  if (!apiKey) return c.json({ error: 'API key requerida' }, 401)

  const db = c.env.DB

  // 1. Buscar organización por api_key
  const org = await db
    .prepare('SELECT id FROM organizations WHERE api_key = ?')
    .bind(apiKey)
    .first() as any
  if (!org) return c.json({ error: 'API key inválida' }, 401)

  const orgId = org.id as string
  const body = (await c.req.json()) as any

  if (!body.full_name?.trim()) {
    return c.json({ error: 'full_name es requerido' }, 400)
  }

  // 2. Obtener primer admin de la org (para agent_id)
  const admin = await db
    .prepare("SELECT id FROM users WHERE org_id = ? AND role = 'admin' ORDER BY created_at LIMIT 1")
    .bind(orgId)
    .first() as any
  if (!admin) return c.json({ error: 'Organización sin administrador configurado' }, 422)

  const agentId = admin.id as string
  const now = new Date().toISOString()

  // 3. Crear contacto
  const contactId = crypto.randomUUID().replace(/-/g, '')
  await db.prepare(`
    INSERT INTO contacts (id, org_id, full_name, phone, email, contact_type, notes, source, agent_id, created_at)
    VALUES (?, ?, ?, ?, ?, 'otro', ?, 'web', ?, ?)
  `).bind(
    contactId, orgId, body.full_name.trim(),
    body.phone ?? null, body.email ?? null,
    body.notes ?? null, agentId, now
  ).run()

  // 4. Crear lead
  const leadId = crypto.randomUUID().replace(/-/g, '')
  await db.prepare(`
    INSERT INTO leads (id, org_id, full_name, phone, email, source, source_detail, operation, stage, contact_id, assigned_to, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'web', ?, ?, 'nuevo', ?, ?, ?, ?)
  `).bind(
    leadId, orgId, body.full_name.trim(),
    body.phone ?? null, body.email ?? null,
    body.source_detail ?? null,
    body.operation ?? 'otro',
    contactId, agentId, now, now
  ).run()

  return c.json({ id: leadId, success: true }, 201)
})

export default app
