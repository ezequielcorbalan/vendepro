import { Hono } from 'hono'
import type { Env, AuthVars } from '../db'
import { createId, nowIso } from '../utils'

const r = new Hono<{ Bindings: Env } & AuthVars>()

r.get('/', async (c) => {
  const orgId = c.get('orgId')
  const { rental_id, property_id, category } = c.req.query()
  let q = 'SELECT * FROM expenses WHERE org_id=?'
  const params: any[] = [orgId]
  if (rental_id) { q += ' AND rental_id=?'; params.push(rental_id) }
  if (property_id) { q += ' AND property_id=?'; params.push(property_id) }
  if (category) { q += ' AND category=?'; params.push(category) }
  q += ' ORDER BY expense_date DESC'
  const { results } = await c.env.DB.prepare(q).bind(...params).all()
  return c.json({ expenses: results })
})

r.post('/', async (c) => {
  const orgId = c.get('orgId')
  const b = await c.req.json() as any
  const id = createId()
  await c.env.DB.prepare(
    `INSERT INTO expenses (id,org_id,description,category,expense_date,amount,payment_method,financial_account_id,linked_to,rental_id,property_id,provider,notes,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, orgId, b.description, b.category||null, b.expense_date, b.amount,
    b.payment_method||null, b.financial_account_id||null, b.linked_to||'general',
    b.rental_id||null, b.property_id||null, b.provider||null, b.notes||null, nowIso(), nowIso()).run()
  return c.json({ id }, 201)
})

r.put('/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  const b = await c.req.json() as any
  await c.env.DB.prepare(
    `UPDATE expenses SET description=?,category=?,expense_date=?,amount=?,payment_method=?,financial_account_id=?,linked_to=?,rental_id=?,property_id=?,provider=?,notes=?,updated_at=? WHERE id=? AND org_id=?`
  ).bind(b.description, b.category||null, b.expense_date, b.amount, b.payment_method||null,
    b.financial_account_id||null, b.linked_to||'general', b.rental_id||null, b.property_id||null,
    b.provider||null, b.notes||null, nowIso(), id, orgId).run()
  return c.json({ ok: true })
})

r.delete('/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  await c.env.DB.prepare('DELETE FROM expenses WHERE id=? AND org_id=?').bind(id, orgId).run()
  return c.json({ ok: true })
})

export default r
