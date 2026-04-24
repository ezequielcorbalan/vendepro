import { Hono } from 'hono'
import type { Env, AuthVars } from '../db'
import { createId, nowIso } from '../utils'

const r = new Hono<{ Bindings: Env } & AuthVars>()

r.get('/', async (c) => {
  const orgId = c.get('orgId')
  const { rental_id, status, type, date_from, date_to } = c.req.query()
  let q = `SELECT p.*, r.alias as rental_alias FROM payments p LEFT JOIN rentals r ON r.id=p.rental_id WHERE p.org_id=?`
  const params: any[] = [orgId]
  if (rental_id) { q += ' AND p.rental_id=?'; params.push(rental_id) }
  if (status) { q += ' AND p.status=?'; params.push(status) }
  if (type) { q += ' AND p.payment_type=?'; params.push(type) }
  if (date_from) { q += ' AND p.payment_date>=?'; params.push(date_from) }
  if (date_to) { q += ' AND p.payment_date<=?'; params.push(date_to) }
  q += ' ORDER BY p.payment_date DESC'
  const { results } = await c.env.DB.prepare(q).bind(...params).all()
  return c.json({ payments: results })
})

r.post('/', async (c) => {
  const orgId = c.get('orgId')
  const b = await c.req.json() as any
  const id = createId()
  await c.env.DB.prepare(
    `INSERT INTO payments (id,org_id,rental_id,upcoming_payment_id,payment_type,description,payment_date,amount,payment_method,financial_account_id,status,is_split,part1_amount,part1_method,part1_account_id,part1_date,part2_amount,part2_method,part2_account_id,part2_date,notes,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, orgId, b.rental_id||null, b.upcoming_payment_id||null,
    b.payment_type, b.description||null, b.payment_date, b.amount,
    b.payment_method||null, b.financial_account_id||null, 'pagado',
    b.is_split?1:0,
    b.part1_amount||null, b.part1_method||null, b.part1_account_id||null, b.part1_date||null,
    b.part2_amount||null, b.part2_method||null, b.part2_account_id||null, b.part2_date||null,
    b.notes||null, nowIso(), nowIso()
  ).run()

  if (b.upcoming_payment_id) {
    await c.env.DB.prepare(
      "UPDATE upcoming_payments SET status='cobrado',payment_id=?,updated_at=? WHERE id=?"
    ).bind(id, nowIso(), b.upcoming_payment_id).run()
  }

  return c.json({ id }, 201)
})

r.put('/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  const b = await c.req.json() as any
  await c.env.DB.prepare(
    `UPDATE payments SET payment_type=?,description=?,payment_date=?,amount=?,payment_method=?,financial_account_id=?,notes=?,updated_at=? WHERE id=? AND org_id=?`
  ).bind(b.payment_type, b.description||null, b.payment_date, b.amount, b.payment_method||null,
    b.financial_account_id||null, b.notes||null, nowIso(), id, orgId).run()
  return c.json({ ok: true })
})

r.put('/:id/toggle-status', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  const payment = await c.env.DB.prepare('SELECT * FROM payments WHERE id=? AND org_id=?').bind(id, orgId).first() as any
  if (!payment) return c.json({ error: 'Not found' }, 404)
  const newStatus = payment.status === 'pagado' ? 'pendiente' : 'pagado'
  await c.env.DB.prepare('UPDATE payments SET status=?,updated_at=? WHERE id=?').bind(newStatus, nowIso(), id).run()
  if (payment.upcoming_payment_id) {
    const upStatus = newStatus === 'pagado' ? 'cobrado' : 'pendiente'
    await c.env.DB.prepare('UPDATE upcoming_payments SET status=?,updated_at=? WHERE id=?').bind(upStatus, nowIso(), payment.upcoming_payment_id).run()
  }
  return c.json({ ok: true, status: newStatus })
})

r.delete('/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  const payment = await c.env.DB.prepare('SELECT * FROM payments WHERE id=? AND org_id=?').bind(id, orgId).first() as any
  if (payment?.upcoming_payment_id) {
    await c.env.DB.prepare("UPDATE upcoming_payments SET status='pendiente',payment_id=NULL,updated_at=? WHERE id=?").bind(nowIso(), payment.upcoming_payment_id).run()
  }
  await c.env.DB.prepare('DELETE FROM payments WHERE id=? AND org_id=?').bind(id, orgId).run()
  return c.json({ ok: true })
})

export default r
