import { Hono } from 'hono'
import type { Env, AuthVars } from '../db'
import { createId, nowIso } from '../utils'

const r = new Hono<{ Bindings: Env } & AuthVars>()

r.get('/', async (c) => {
  const orgId = c.get('orgId')
  const { search } = c.req.query()
  let q = 'SELECT * FROM landlords WHERE org_id = ?'
  const params: any[] = [orgId]
  if (search) { q += ' AND (name LIKE ? OR last_name LIKE ? OR email LIKE ?)'; const s = `%${search}%`; params.push(s, s, s) }
  q += ' ORDER BY created_at DESC'
  const { results } = await c.env.DB.prepare(q).bind(...params).all()
  return c.json({ landlords: results })
})

r.post('/', async (c) => {
  const orgId = c.get('orgId')
  const b = await c.req.json() as any
  const id = createId()
  await c.env.DB.prepare(
    `INSERT INTO landlords (id,org_id,name,last_name,email,phone,cuit,person_type,company_name,address,cbu,bank_alias,admin_fee_percentage,notes,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, orgId, b.name, b.last_name||'', b.email||null, b.phone||null, b.cuit||null,
    b.person_type||'fisica', b.company_name||null, b.address||null, b.cbu||null,
    b.bank_alias||null, b.admin_fee_percentage||0, b.notes||null, nowIso(), nowIso()).run()
  return c.json({ id }, 201)
})

r.get('/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  const landlord = await c.env.DB.prepare('SELECT * FROM landlords WHERE id=? AND org_id=?').bind(id, orgId).first()
  if (!landlord) return c.json({ error: 'Not found' }, 404)
  const { results: properties } = await c.env.DB.prepare(
    `SELECT rp.*, pl.participation_percentage FROM rental_properties rp
     JOIN property_landlords pl ON pl.property_id=rp.id WHERE pl.landlord_id=?`
  ).bind(id).all()
  const { results: statements } = await c.env.DB.prepare(
    'SELECT * FROM landlord_statements WHERE landlord_id=? ORDER BY period DESC LIMIT 12'
  ).bind(id).all()
  return c.json({ landlord, properties, statements })
})

r.put('/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  const b = await c.req.json() as any
  await c.env.DB.prepare(
    `UPDATE landlords SET name=?,last_name=?,email=?,phone=?,cuit=?,person_type=?,company_name=?,address=?,cbu=?,bank_alias=?,admin_fee_percentage=?,notes=?,updated_at=? WHERE id=? AND org_id=?`
  ).bind(b.name, b.last_name||'', b.email||null, b.phone||null, b.cuit||null, b.person_type||'fisica',
    b.company_name||null, b.address||null, b.cbu||null, b.bank_alias||null,
    b.admin_fee_percentage||0, b.notes||null, nowIso(), id, orgId).run()
  return c.json({ ok: true })
})

r.delete('/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  await c.env.DB.prepare('DELETE FROM landlords WHERE id=? AND org_id=?').bind(id, orgId).run()
  return c.json({ ok: true })
})

r.post('/:id/portal', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  const existing = await c.env.DB.prepare('SELECT portal_token FROM landlords WHERE id=? AND org_id=?').bind(id, orgId).first() as any
  const token = existing?.portal_token || createId() + createId()
  await c.env.DB.prepare('UPDATE landlords SET portal_token=?,portal_active=1,updated_at=? WHERE id=? AND org_id=?').bind(token, nowIso(), id, orgId).run()
  return c.json({ portal_token: token })
})

export default r
