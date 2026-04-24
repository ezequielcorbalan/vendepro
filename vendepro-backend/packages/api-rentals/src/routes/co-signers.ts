import { Hono } from 'hono'
import type { Env, AuthVars } from '../db'
import { createId, nowIso } from '../utils'

const r = new Hono<{ Bindings: Env } & AuthVars>()

r.get('/', async (c) => {
  const orgId = c.get('orgId')
  const { search } = c.req.query()
  let q = 'SELECT * FROM co_signers WHERE org_id = ?'
  const params: any[] = [orgId]
  if (search) { q += ' AND (name LIKE ? OR last_name LIKE ?)'; const s = `%${search}%`; params.push(s, s) }
  q += ' ORDER BY created_at DESC'
  const { results } = await c.env.DB.prepare(q).bind(...params).all()
  return c.json({ co_signers: results })
})

r.post('/', async (c) => {
  const orgId = c.get('orgId')
  const b = await c.req.json() as any
  const id = createId()
  await c.env.DB.prepare(
    `INSERT INTO co_signers (id,org_id,name,last_name,email,phone,dni_cuit,person_type,guarantee_property_address,guarantee_property_type,guarantee_property_valuation,notes,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, orgId, b.name, b.last_name||'', b.email||null, b.phone||null, b.dni_cuit||null,
    b.person_type||'fisica', b.guarantee_property_address||null, b.guarantee_property_type||null,
    b.guarantee_property_valuation||null, b.notes||null, nowIso(), nowIso()).run()
  return c.json({ id }, 201)
})

r.put('/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  const b = await c.req.json() as any
  await c.env.DB.prepare(
    `UPDATE co_signers SET name=?,last_name=?,email=?,phone=?,dni_cuit=?,person_type=?,guarantee_property_address=?,guarantee_property_type=?,guarantee_property_valuation=?,notes=?,updated_at=? WHERE id=? AND org_id=?`
  ).bind(b.name, b.last_name||'', b.email||null, b.phone||null, b.dni_cuit||null,
    b.person_type||'fisica', b.guarantee_property_address||null, b.guarantee_property_type||null,
    b.guarantee_property_valuation||null, b.notes||null, nowIso(), id, orgId).run()
  return c.json({ ok: true })
})

r.delete('/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  await c.env.DB.prepare('DELETE FROM co_signers WHERE id=? AND org_id=?').bind(id, orgId).run()
  return c.json({ ok: true })
})

export default r
