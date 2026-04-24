import { Hono } from 'hono'
import type { Env, AuthVars } from '../db'
import { createId, nowIso, addMonths } from '../utils'

const r = new Hono<{ Bindings: Env } & AuthVars>()

/** Generate upcoming_payments for a new contract */
async function generateUpcomingPayments(db: D1Database, rental: any) {
  const stmts = []
  for (let i = 0; i < rental.duration_months; i++) {
    const expectedDate = addMonths(rental.start_date, i)
    const period = expectedDate.slice(0, 7)
    stmts.push(
      db.prepare(
        `INSERT INTO upcoming_payments (id,org_id,rental_id,expected_date,expected_amount,period,status,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)`
      ).bind(createId(), rental.org_id, rental.id, expectedDate, rental.initial_price, period, 'pendiente', nowIso(), nowIso())
    )
  }
  if (stmts.length) await db.batch(stmts)
}

r.get('/', async (c) => {
  const orgId = c.get('orgId')
  const { status, search, currency } = c.req.query()
  let q = `SELECT r.*,
    GROUP_CONCAT(DISTINCT t.name || ' ' || t.last_name) as tenant_names,
    GROUP_CONCAT(DISTINCT p.address) as property_addresses
    FROM rentals r
    LEFT JOIN rental_tenant_links rtl ON rtl.rental_id=r.id
    LEFT JOIN tenants t ON t.id=rtl.tenant_id
    LEFT JOIN rental_property_links rpl ON rpl.rental_id=r.id
    LEFT JOIN rental_properties p ON p.id=rpl.property_id
    WHERE r.org_id=?`
  const params: any[] = [orgId]
  if (status) { q += ' AND r.status=?'; params.push(status) }
  if (currency) { q += ' AND r.currency=?'; params.push(currency) }
  if (search) { q += ' AND (r.alias LIKE ? OR t.name LIKE ? OR p.address LIKE ?)'; const s = `%${search}%`; params.push(s, s, s) }
  q += ' GROUP BY r.id ORDER BY r.created_at DESC'
  const { results } = await c.env.DB.prepare(q).bind(...params).all()
  return c.json({ rentals: results })
})

r.post('/', async (c) => {
  const orgId = c.get('orgId')
  const b = await c.req.json() as any
  const id = createId()
  const portalToken = b.portal_active ? createId() + createId() : null

  await c.env.DB.prepare(
    `INSERT INTO rentals (id,org_id,alias,status,rental_type,start_date,end_date,duration_months,currency,initial_price,current_price,applies_iva,payment_day,deposit_months,adjustment_frequency,adjustment_type,adjustment_fixed_rate,custom_index_id,next_adjustment_date,guarantee_type,co_signer_id,portal_active,portal_pin,portal_token,charges_municipal_tax,charges_water,charges_electricity,charges_gas,charges_expenses,charges_extras,notes,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, orgId, b.alias, 'activo', b.rental_type||'residencial',
    b.start_date, b.end_date, b.duration_months, b.currency||'ARS',
    b.initial_price, b.initial_price, b.applies_iva?1:0,
    b.payment_day||1, b.deposit_months||1,
    b.adjustment_frequency||null, b.adjustment_type||null, b.adjustment_fixed_rate||null,
    b.custom_index_id||null,
    b.adjustment_frequency ? addMonths(b.start_date, 1) : null,
    b.guarantee_type||'sin_garantia', b.co_signer_id||null,
    b.portal_active?1:0, b.portal_pin||null, portalToken,
    b.charges_municipal_tax?1:0, b.charges_water?1:0, b.charges_electricity?1:0,
    b.charges_gas?1:0, b.charges_expenses?1:0, b.charges_extras?1:0,
    b.notes||null, nowIso(), nowIso()
  ).run()

  // Link tenants
  for (const tenantId of (b.tenant_ids || [])) {
    await c.env.DB.prepare('INSERT OR IGNORE INTO rental_tenant_links (rental_id,tenant_id) VALUES (?,?)').bind(id, tenantId).run()
  }
  // Link properties
  for (const propId of (b.property_ids || [])) {
    await c.env.DB.prepare('INSERT OR IGNORE INTO rental_property_links (rental_id,property_id) VALUES (?,?)').bind(id, propId).run()
    await c.env.DB.prepare("UPDATE rental_properties SET status='ocupada' WHERE id=?").bind(propId).run()
  }
  // Generate upcoming payments
  await generateUpcomingPayments(c.env.DB, { id, org_id: orgId, start_date: b.start_date, duration_months: b.duration_months, initial_price: b.initial_price })

  return c.json({ id, portal_token: portalToken }, 201)
})

r.get('/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  const rental = await c.env.DB.prepare('SELECT * FROM rentals WHERE id=? AND org_id=?').bind(id, orgId).first()
  if (!rental) return c.json({ error: 'Not found' }, 404)

  const [{ results: tenants }, { results: properties }, { results: payments }, { results: upcoming }, { results: adjustments }] = await Promise.all([
    c.env.DB.prepare(`SELECT t.* FROM tenants t JOIN rental_tenant_links rt ON rt.tenant_id=t.id WHERE rt.rental_id=?`).bind(id).all(),
    c.env.DB.prepare(`SELECT p.* FROM rental_properties p JOIN rental_property_links rl ON rl.property_id=p.id WHERE rl.rental_id=?`).bind(id).all(),
    c.env.DB.prepare(`SELECT * FROM payments WHERE rental_id=? ORDER BY payment_date DESC`).bind(id).all(),
    c.env.DB.prepare(`SELECT * FROM upcoming_payments WHERE rental_id=? ORDER BY expected_date ASC`).bind(id).all(),
    c.env.DB.prepare(`SELECT * FROM price_adjustments WHERE rental_id=? ORDER BY adjustment_date DESC`).bind(id).all(),
  ])

  return c.json({ rental, tenants, properties, payments, upcoming, adjustments })
})

r.put('/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  const b = await c.req.json() as any
  await c.env.DB.prepare(
    `UPDATE rentals SET alias=?,status=?,rental_type=?,payment_day=?,deposit_months=?,applies_iva=?,guarantee_type=?,co_signer_id=?,portal_active=?,portal_pin=?,charges_municipal_tax=?,charges_water=?,charges_electricity=?,charges_gas=?,charges_expenses=?,charges_extras=?,notes=?,updated_at=? WHERE id=? AND org_id=?`
  ).bind(b.alias, b.status||'activo', b.rental_type||'residencial', b.payment_day||1, b.deposit_months||1,
    b.applies_iva?1:0, b.guarantee_type||'sin_garantia', b.co_signer_id||null,
    b.portal_active?1:0, b.portal_pin||null,
    b.charges_municipal_tax?1:0, b.charges_water?1:0, b.charges_electricity?1:0,
    b.charges_gas?1:0, b.charges_expenses?1:0, b.charges_extras?1:0,
    b.notes||null, nowIso(), id, orgId).run()
  return c.json({ ok: true })
})

r.delete('/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  await c.env.DB.prepare('DELETE FROM upcoming_payments WHERE rental_id=?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM rental_tenant_links WHERE rental_id=?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM rental_property_links WHERE rental_id=?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM rentals WHERE id=? AND org_id=?').bind(id, orgId).run()
  return c.json({ ok: true })
})

/** Apply price adjustment */
r.post('/:id/adjust-price', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  const b = await c.req.json() as any
  const rental = await c.env.DB.prepare('SELECT * FROM rentals WHERE id=? AND org_id=?').bind(id, orgId).first() as any
  if (!rental) return c.json({ error: 'Not found' }, 404)

  const previousPrice = rental.current_price
  const newPrice = b.new_price || (previousPrice * (1 + (b.adjustment_percentage || 0) / 100))
  const pct = ((newPrice - previousPrice) / previousPrice) * 100

  await c.env.DB.prepare('UPDATE rentals SET current_price=?,updated_at=? WHERE id=?').bind(newPrice, nowIso(), id).run()
  await c.env.DB.prepare(
    `INSERT INTO price_adjustments (id,rental_id,adjustment_date,previous_price,new_price,adjustment_percentage,adjustment_type,notes,created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(createId(), id, b.adjustment_date || nowIso().slice(0, 10), previousPrice, newPrice, pct, rental.adjustment_type||'manual', b.notes||null, nowIso()).run()

  // Update future upcoming_payments
  const today = nowIso().slice(0, 10)
  await c.env.DB.prepare(
    "UPDATE upcoming_payments SET expected_amount=?,updated_at=? WHERE rental_id=? AND status='pendiente' AND expected_date>=?"
  ).bind(newPrice, nowIso(), id, today).run()

  return c.json({ ok: true, new_price: newPrice })
})

/** AI contract extraction */
r.post('/extract-from-file', async (c) => {
  // This endpoint requires ANTHROPIC_API_KEY — handled via Workers env
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    if (!file) return c.json({ error: 'No file provided' }, 400)

    const bytes = await file.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)))
    const mediaType = file.type || 'application/pdf'

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': (c.env as any).ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: mediaType.startsWith('image') ? 'image' : 'document',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: 'Extract rental contract data and return ONLY a JSON object with these fields (use null for missing): alias (string), rental_type (residencial|comercial), start_date (YYYY-MM-DD), duration_months (number), currency (ARS|USD), initial_price (number), payment_day (number 1-28), adjustment_type (string), adjustment_fixed_rate (number), notes (string)',
            },
          ],
        }],
      }),
    })

    const data = await response.json() as any
    const text = data.content?.[0]?.text || '{}'
    const match = text.match(/\{[\s\S]*\}/)
    const extracted = match ? JSON.parse(match[0]) : {}
    return c.json(extracted)
  } catch (e: any) {
    return c.json({ error: e.message || 'Extraction failed' }, 500)
  }
})

export default r
