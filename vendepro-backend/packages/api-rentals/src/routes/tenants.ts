import { Hono } from 'hono'
import type { Env, AuthVars } from '../db'
import { createId, nowIso } from '../utils'

const r = new Hono<{ Bindings: Env } & AuthVars>()

r.get('/', async (c) => {
  const orgId = c.get('orgId')
  const { search } = c.req.query()
  let q = 'SELECT * FROM tenants WHERE org_id = ?'
  const params: any[] = [orgId]
  if (search) { q += ' AND (name LIKE ? OR last_name LIKE ? OR email LIKE ? OR dni_cuit LIKE ?)'; const s = `%${search}%`; params.push(s, s, s, s) }
  q += ' ORDER BY created_at DESC'
  const { results } = await c.env.DB.prepare(q).bind(...params).all()
  return c.json({ tenants: results })
})

r.post('/', async (c) => {
  const orgId = c.get('orgId')
  const b = await c.req.json() as any
  const id = createId()
  await c.env.DB.prepare(
    `INSERT INTO tenants (id,org_id,name,last_name,email,phone,dni_cuit,person_type,birth_date,nationality,marital_status,occupation,notes,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, orgId, b.name, b.last_name||'', b.email||null, b.phone||null, b.dni_cuit||null,
    b.person_type||'fisica', b.birth_date||null, b.nationality||null, b.marital_status||null,
    b.occupation||null, b.notes||null, nowIso(), nowIso()).run()
  return c.json({ id }, 201)
})

r.get('/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  const tenant = await c.env.DB.prepare('SELECT * FROM tenants WHERE id=? AND org_id=?').bind(id, orgId).first()
  if (!tenant) return c.json({ error: 'Not found' }, 404)
  const { results: rentals } = await c.env.DB.prepare(
    `SELECT r.* FROM rentals r JOIN rental_tenant_links rt ON rt.rental_id=r.id WHERE rt.tenant_id=? ORDER BY r.created_at DESC`
  ).bind(id).all()
  const { results: payments } = await c.env.DB.prepare(
    `SELECT p.* FROM payments p JOIN rentals r ON r.id=p.rental_id
     JOIN rental_tenant_links rt ON rt.rental_id=r.id WHERE rt.tenant_id=? ORDER BY p.payment_date DESC LIMIT 20`
  ).bind(id).all()
  return c.json({ tenant, rentals, payments })
})

r.put('/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  const b = await c.req.json() as any
  await c.env.DB.prepare(
    `UPDATE tenants SET name=?,last_name=?,email=?,phone=?,dni_cuit=?,person_type=?,birth_date=?,nationality=?,marital_status=?,occupation=?,notes=?,updated_at=? WHERE id=? AND org_id=?`
  ).bind(b.name, b.last_name||'', b.email||null, b.phone||null, b.dni_cuit||null,
    b.person_type||'fisica', b.birth_date||null, b.nationality||null, b.marital_status||null,
    b.occupation||null, b.notes||null, nowIso(), id, orgId).run()
  return c.json({ ok: true })
})

r.delete('/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  await c.env.DB.prepare('DELETE FROM tenants WHERE id=? AND org_id=?').bind(id, orgId).run()
  return c.json({ ok: true })
})

export default r
