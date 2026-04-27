import { Hono } from 'hono'
import type { Env, AuthVars } from '../db'
import { createId, nowIso } from '../utils'

const r = new Hono<{ Bindings: Env } & AuthVars>()

r.get('/', async (c) => {
  const orgId = c.get('orgId')
  const { results } = await c.env.DB.prepare('SELECT * FROM other_income WHERE org_id=? ORDER BY income_date DESC').bind(orgId).all()
  return c.json({ other_income: results })
})

r.post('/', async (c) => {
  const orgId = c.get('orgId')
  const b = await c.req.json() as any
  const id = createId()
  await c.env.DB.prepare(
    `INSERT INTO other_income (id,org_id,description,category,income_date,amount,payment_method,financial_account_id,notes,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, orgId, b.description, b.category||null, b.income_date, b.amount,
    b.payment_method||null, b.financial_account_id||null, b.notes||null, nowIso(), nowIso()).run()
  return c.json({ id }, 201)
})

r.put('/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  const b = await c.req.json() as any
  await c.env.DB.prepare(
    `UPDATE other_income SET description=?,category=?,income_date=?,amount=?,payment_method=?,financial_account_id=?,notes=?,updated_at=? WHERE id=? AND org_id=?`
  ).bind(b.description, b.category||null, b.income_date, b.amount, b.payment_method||null,
    b.financial_account_id||null, b.notes||null, nowIso(), id, orgId).run()
  return c.json({ ok: true })
})

r.delete('/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  await c.env.DB.prepare('DELETE FROM other_income WHERE id=? AND org_id=?').bind(id, orgId).run()
  return c.json({ ok: true })
})

export default r
