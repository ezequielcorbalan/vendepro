import { Hono } from 'hono'
import { corsMiddleware, errorHandler, createAuthMiddleware, D1PropertyRepository, JwtAuthService, CryptoIdGenerator, R2StorageService } from '@vendepro/infrastructure'
import { GetPropertiesUseCase, CreatePropertyUseCase, UpdatePropertyPriceUseCase, UpdatePropertyStatusUseCase } from '@vendepro/core'

type Env = { DB: D1Database; JWT_SECRET: string; R2: R2Bucket; R2_PUBLIC_URL: string }
type AuthVars = { Variables: { userId: string; userRole: string; orgId: string } }

const app = new Hono<{ Bindings: Env } & AuthVars>()

app.use('*', corsMiddleware)
app.onError(errorHandler)

// Apply auth to all routes except public photo proxy
app.use('*', async (c, next) => {
  if (c.req.path.startsWith('/photo/')) return next()
  return createAuthMiddleware(new JwtAuthService(c.env.JWT_SECRET))(c, next)
})

// ── PROPERTIES ─────────────────────────────────────────────────
app.get('/properties', async (c) => {
  const { status, agent_id, neighborhood, property_type } = c.req.query()
  const repo = new D1PropertyRepository(c.env.DB)
  const useCase = new GetPropertiesUseCase(repo)
  const items = await useCase.execute(c.get('orgId'), { status, agent_id, neighborhood, property_type })
  return c.json(items.map(p => p.toObject()))
})

app.post('/properties', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1PropertyRepository(c.env.DB)
  const useCase = new CreatePropertyUseCase(repo, new CryptoIdGenerator())
  const result = await useCase.execute({ ...body, org_id: c.get('orgId'), agent_id: body.agent_id || c.get('userId') })
  return c.json(result, 201)
})

app.get('/properties/:id', async (c) => {
  const repo = new D1PropertyRepository(c.env.DB)
  const prop = await repo.findById(c.req.param('id'), c.get('orgId'))
  if (!prop) return c.json({ error: 'Not found' }, 404)
  return c.json(prop.toObject())
})

app.put('/properties/:id/price', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1PropertyRepository(c.env.DB)
  const useCase = new UpdatePropertyPriceUseCase(repo)
  await useCase.execute({ propertyId: c.req.param('id'), orgId: c.get('orgId'), newPrice: body.price, currency: body.currency || 'USD' })
  return c.json({ success: true })
})

app.put('/properties/:id/status', async (c) => {
  const body = (await c.req.json()) as any
  const repo = new D1PropertyRepository(c.env.DB)
  const useCase = new UpdatePropertyStatusUseCase(repo)
  await useCase.execute({ propertyId: c.req.param('id'), orgId: c.get('orgId'), newStatus: body.status })
  return c.json({ success: true })
})

app.delete('/properties/:id', async (c) => {
  const repo = new D1PropertyRepository(c.env.DB)
  await repo.delete(c.req.param('id'), c.get('orgId'))
  return c.json({ success: true })
})

// ── PHOTO UPLOAD ───────────────────────────────────────────────
app.post('/upload-photo', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  if (!file) return c.json({ error: 'No file' }, 400)
  const buffer = await file.arrayBuffer()
  const key = `photos/${c.get('orgId')}/${Date.now()}-${file.name}`
  const storage = new R2StorageService(c.env.R2, c.env.R2_PUBLIC_URL)
  const url = await storage.upload(key, buffer, file.type)
  return c.json({ url, key })
})

app.get('/photo/*', async (c) => {
  const key = c.req.path.replace('/photo/', '')
  const object = await c.env.R2.get(key)
  if (!object) return c.json({ error: 'Not found' }, 404)
  const headers = new Headers()
  object.httpMetadata?.contentType && headers.set('Content-Type', object.httpMetadata.contentType)
  headers.set('Cache-Control', 'public, max-age=31536000')
  return new Response(object.body, { headers })
})

// ── APPRAISALS ─────────────────────────────────────────────────

app.get('/appraisals', async (c) => {
  const { id, lead_id, status } = c.req.query()
  const db = c.env.DB
  const orgId = c.get('orgId')
  if (id) {
    const row = await db.prepare(
      `SELECT a.*, u.full_name as agent_name FROM appraisals a LEFT JOIN users u ON a.agent_id = u.id WHERE a.id = ? AND a.org_id = ?`
    ).bind(id, orgId).first()
    if (!row) return c.json({ error: 'Not found' }, 404)
    const comparables = (await db.prepare('SELECT * FROM appraisal_comparables WHERE appraisal_id = ? ORDER BY sort_order').bind(id).all()).results
    return c.json({ ...(row as any), comparables })
  }
  let query = `SELECT a.*, u.full_name as agent_name FROM appraisals a LEFT JOIN users u ON a.agent_id = u.id WHERE a.org_id = ?`
  const binds: unknown[] = [orgId]
  if (status) { query += ' AND a.status = ?'; binds.push(status) }
  if (lead_id) { query += ' AND a.lead_id = ?'; binds.push(lead_id) }
  query += ' ORDER BY a.created_at DESC LIMIT 200'
  const rows = (await db.prepare(query).bind(...binds).all()).results
  return c.json(rows)
})

app.post('/appraisals', async (c) => {
  const body = (await c.req.json()) as any
  const db = c.env.DB
  const orgId = c.get('orgId')
  const agentId = body.agent_id || c.get('userId')
  const id = crypto.randomUUID().replace(/-/g, '')
  const now = new Date().toISOString()
  await db.prepare(`
    INSERT INTO appraisals (id, org_id, property_address, neighborhood, city, property_type,
      covered_area, total_area, semi_area, weighted_area,
      strengths, weaknesses, opportunities, threats, publication_analysis,
      suggested_price, test_price, expected_close_price, usd_per_m2,
      contact_name, contact_phone, contact_email, lead_id, agent_id, status, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id, orgId,
    body.property_address, body.neighborhood || '', body.city || 'Buenos Aires', body.property_type || 'departamento',
    body.covered_area ?? null, body.total_area ?? null, body.semi_area ?? null, body.weighted_area ?? null,
    body.strengths ?? null, body.weaknesses ?? null, body.opportunities ?? null, body.threats ?? null, body.publication_analysis ?? null,
    body.suggested_price ?? null, body.test_price ?? null, body.expected_close_price ?? null, body.usd_per_m2 ?? null,
    body.contact_name ?? null, body.contact_phone ?? null, body.contact_email ?? null,
    body.lead_id ?? null, agentId, 'draft', now, now
  ).run()
  return c.json({ id, status: 'draft' }, 201)
})

app.put('/appraisals', async (c) => {
  const body = (await c.req.json()) as any
  const { id } = c.req.query()
  const db = c.env.DB
  const orgId = c.get('orgId')
  const now = new Date().toISOString()
  const existing = await db.prepare('SELECT id FROM appraisals WHERE id = ? AND org_id = ?').bind(id, orgId).first()
  if (!existing) return c.json({ error: 'Not found' }, 404)
  await db.prepare(`
    UPDATE appraisals SET
      property_address=COALESCE(?,property_address), neighborhood=COALESCE(?,neighborhood),
      city=COALESCE(?,city), property_type=COALESCE(?,property_type),
      covered_area=?, total_area=?, semi_area=?, weighted_area=?,
      strengths=?, weaknesses=?, opportunities=?, threats=?, publication_analysis=?,
      suggested_price=?, test_price=?, expected_close_price=?, usd_per_m2=?,
      contact_name=?, contact_phone=?, contact_email=?,
      lead_id=COALESCE(?,lead_id), status=COALESCE(?,status), updated_at=?
    WHERE id = ? AND org_id = ?
  `).bind(
    body.property_address ?? null, body.neighborhood ?? null,
    body.city ?? null, body.property_type ?? null,
    body.covered_area ?? null, body.total_area ?? null, body.semi_area ?? null, body.weighted_area ?? null,
    body.strengths ?? null, body.weaknesses ?? null, body.opportunities ?? null, body.threats ?? null, body.publication_analysis ?? null,
    body.suggested_price ?? null, body.test_price ?? null, body.expected_close_price ?? null, body.usd_per_m2 ?? null,
    body.contact_name ?? null, body.contact_phone ?? null, body.contact_email ?? null,
    body.lead_id ?? null, body.status ?? null, now,
    id, orgId
  ).run()
  return c.json({ success: true })
})

app.delete('/appraisals', async (c) => {
  const { id } = c.req.query()
  const db = c.env.DB
  await db.prepare('DELETE FROM appraisals WHERE id = ? AND org_id = ?').bind(id, c.get('orgId')).run()
  return c.json({ success: true })
})

// Comparables
app.post('/appraisals/comparables', async (c) => {
  const body = (await c.req.json()) as any
  const db = c.env.DB
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.prepare(`
    INSERT INTO appraisal_comparables (id, appraisal_id, zonaprop_url, address, total_area, covered_area, price, usd_per_m2, sort_order)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).bind(id, body.appraisal_id, body.zonaprop_url ?? null, body.address ?? null,
    body.total_area ?? null, body.covered_area ?? null, body.price ?? null, body.usd_per_m2 ?? null,
    body.sort_order ?? 0).run()
  return c.json({ id }, 201)
})

app.delete('/appraisals/comparables', async (c) => {
  const { id } = c.req.query()
  await c.env.DB.prepare('DELETE FROM appraisal_comparables WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// ── PREFACTIBILIDADES ──────────────────────────────────────────

app.get('/prefactibilidades', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  try {
    const rows = (await db.prepare(
      `SELECT pf.*, u.full_name as agent_name FROM prefactibilidades pf LEFT JOIN users u ON pf.agent_id = u.id WHERE pf.org_id = ? ORDER BY pf.created_at DESC LIMIT 100`
    ).bind(orgId).all()).results
    return c.json(rows)
  } catch { return c.json([]) }
})

app.post('/prefactibilidades', async (c) => {
  const body = (await c.req.json()) as any
  const db = c.env.DB
  const orgId = c.get('orgId')
  const agentId = c.get('userId')
  const id = crypto.randomUUID().replace(/-/g, '')
  const slug = `pf-${id.slice(0, 12)}`
  const now = new Date().toISOString()
  try {
    await db.prepare(`
      INSERT INTO prefactibilidades (
        id, org_id, agent_id, lead_id, public_slug, status,
        address, neighborhood, city, lot_area, lot_frontage, lot_depth,
        zoning, fot, fos, max_height, lot_price, lot_price_per_m2, lot_description,
        project_name, project_description, buildable_area, total_units,
        units_mix, parking_spots, amenities,
        construction_cost_per_m2, total_construction_cost, professional_fees,
        permits_cost, commercialization_cost, other_costs, total_investment,
        avg_sale_price_per_m2, total_sellable_area, projected_revenue,
        gross_margin, margin_pct, comparables, timeline,
        executive_summary, recommendation, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      id, orgId, agentId, body.lead_id ?? null, slug, 'draft',
      body.address, body.neighborhood ?? null, body.city ?? 'Buenos Aires',
      body.lot_area ?? null, body.lot_frontage ?? null, body.lot_depth ?? null,
      body.zoning ?? null, body.fot ?? null, body.fos ?? null, body.max_height ?? null,
      body.lot_price ?? null, body.lot_price_per_m2 ?? null, body.lot_description ?? null,
      body.project_name ?? null, body.project_description ?? null,
      body.buildable_area ?? null, body.total_units ?? null,
      body.units_mix ? JSON.stringify(body.units_mix) : null,
      body.parking_spots ?? null,
      body.amenities ? JSON.stringify(body.amenities) : null,
      body.construction_cost_per_m2 ?? null, body.total_construction_cost ?? null,
      body.professional_fees ?? null, body.permits_cost ?? null,
      body.commercialization_cost ?? null, body.other_costs ?? null, body.total_investment ?? null,
      body.avg_sale_price_per_m2 ?? null, body.total_sellable_area ?? null,
      body.projected_revenue ?? null, body.gross_margin ?? null, body.margin_pct ?? null,
      body.comparables ? JSON.stringify(body.comparables) : null,
      body.timeline ? JSON.stringify(body.timeline) : null,
      body.executive_summary ?? null, body.recommendation ?? null,
      now, now
    ).run()
    return c.json({ id, slug }, 201)
  } catch (e: any) {
    return c.json({ error: e.message || 'Error creating prefactibilidad' }, 500)
  }
})

app.get('/prefactibilidades/:id', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')
  try {
    const row = await db.prepare(
      `SELECT pf.*, u.full_name as agent_name FROM prefactibilidades pf LEFT JOIN users u ON pf.agent_id = u.id WHERE pf.id = ? AND pf.org_id = ?`
    ).bind(c.req.param('id'), orgId).first()
    if (!row) return c.json({ error: 'Not found' }, 404)
    return c.json(row)
  } catch { return c.json({ error: 'Not found' }, 404) }
})

// ── REPORTS (stub) ─────────────────────────────────────────────
app.get('/reports', async (c) => {
  const { property_id } = c.req.query()
  const db = c.env.DB
  let rows: any[]
  if (property_id) {
    rows = (await db.prepare('SELECT * FROM reports WHERE property_id = ? AND org_id = ? ORDER BY created_at DESC').bind(property_id, c.get('orgId')).all()).results
  } else {
    rows = (await db.prepare('SELECT r.*, p.address FROM reports r LEFT JOIN properties p ON r.property_id = p.id WHERE r.org_id = ? ORDER BY r.created_at DESC').bind(c.get('orgId')).all()).results
  }
  return c.json(rows)
})

export default app
