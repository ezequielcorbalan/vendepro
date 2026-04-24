import { Hono } from 'hono'
import type { Env, AuthVars } from '../db'
import { nowIso } from '../utils'

const r = new Hono<{ Bindings: Env } & AuthVars>()

r.get('/', async (c) => {
  const orgId = c.get('orgId')
  const { rental_id, status } = c.req.query()
  let q = `SELECT up.*, r.alias as rental_alias FROM upcoming_payments up
    LEFT JOIN rentals r ON r.id=up.rental_id WHERE up.org_id=?`
  const params: any[] = [orgId]
  if (rental_id) { q += ' AND up.rental_id=?'; params.push(rental_id) }
  if (status) { q += ' AND up.status=?'; params.push(status) }
  q += ' ORDER BY up.expected_date ASC'
  const { results } = await c.env.DB.prepare(q).bind(...params).all()
  return c.json({ upcoming_payments: results })
})

r.put('/:id/status', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  const { status } = await c.req.json() as any
  await c.env.DB.prepare('UPDATE upcoming_payments SET status=?,updated_at=? WHERE id=? AND org_id=?').bind(status, nowIso(), id, orgId).run()
  return c.json({ ok: true })
})

export default r
