import { Hono } from 'hono'
import type { Env, AuthVars } from '../db'
import { createId, nowIso } from '../utils'

const r = new Hono<{ Bindings: Env } & AuthVars>()

r.get('/', async (c) => {
  const orgId = c.get('orgId')
  const { property_id, rental_id } = c.req.query()
  let q = 'SELECT * FROM services WHERE org_id=?'
  const params: any[] = [orgId]
  if (property_id) { q += ' AND property_id=?'; params.push(property_id) }
  if (rental_id) { q += ' AND rental_id=?'; params.push(rental_id) }
  q += ' ORDER BY created_at DESC'
  const { results } = await c.env.DB.prepare(q).bind(...params).all()
  return c.json({ services: results })
})

r.post('/', async (c) => {
  const orgId = c.get('orgId')
  const b = await c.req.json() as any
  const id = createId()
  await c.env.DB.prepare(
    `INSERT INTO services (id,org_id,name,property_id,rental_id,provider,account_number,status,created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(id, orgId, b.name, b.property_id||null, b.rental_id||null, b.provider||null, b.account_number||null, 'activo', nowIso()).run()
  return c.json({ id }, 201)
})

r.post('/:id/payments', async (c) => {
  const { id: serviceId } = c.req.param()
  const b = await c.req.json() as any
  const id = createId()
  await c.env.DB.prepare(
    `INSERT INTO service_payments (id,service_id,due_date,payment_date,amount,invoice_number,created_at)
     VALUES (?,?,?,?,?,?,?)`
  ).bind(id, serviceId, b.due_date||null, b.payment_date||null, b.amount||null, b.invoice_number||null, nowIso()).run()
  return c.json({ id }, 201)
})

r.delete('/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  await c.env.DB.prepare('DELETE FROM services WHERE id=? AND org_id=?').bind(id, orgId).run()
  return c.json({ ok: true })
})

export default r
