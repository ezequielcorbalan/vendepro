import { Hono } from 'hono'
import type { Env, AuthVars } from '../db'
import { createId, nowIso } from '../utils'

const r = new Hono<{ Bindings: Env } & AuthVars>()

r.get('/', async (c) => {
  const orgId = c.get('orgId')
  const { status, landlord_id } = c.req.query()
  let q = `SELECT rp.*, GROUP_CONCAT(l.name || ' ' || l.last_name, ', ') as owner_names
    FROM rental_properties rp
    LEFT JOIN property_landlords pl ON pl.property_id=rp.id
    LEFT JOIN landlords l ON l.id=pl.landlord_id
    WHERE rp.org_id=?`
  const params: any[] = [orgId]
  if (status) { q += ' AND rp.status=?'; params.push(status) }
  if (landlord_id) { q += ' AND pl.landlord_id=?'; params.push(landlord_id) }
  q += ' GROUP BY rp.id ORDER BY rp.created_at DESC'
  const { results } = await c.env.DB.prepare(q).bind(...params).all()
  return c.json({ properties: results })
})

r.post('/', async (c) => {
  const orgId = c.get('orgId')
  const b = await c.req.json() as any
  const id = createId()
  await c.env.DB.prepare(
    `INSERT INTO rental_properties (id,org_id,address,floor_unit,city,province,postal_code,property_type,surface_m2,status,notes,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, orgId, b.address, b.floor_unit||null, b.city||null, b.province||null,
    b.postal_code||null, b.property_type||null, b.surface_m2||null, 'disponible',
    b.notes||null, nowIso(), nowIso()).run()
  if (b.owners?.length) {
    for (const o of b.owners) {
      if (!o.landlord_id) continue
      await c.env.DB.prepare(
        'INSERT INTO property_landlords (property_id,landlord_id,participation_percentage) VALUES (?,?,?)'
      ).bind(id, o.landlord_id, o.participation_percentage||100).run()
    }
  }
  return c.json({ id }, 201)
})

r.get('/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  const property = await c.env.DB.prepare('SELECT * FROM rental_properties WHERE id=? AND org_id=?').bind(id, orgId).first()
  if (!property) return c.json({ error: 'Not found' }, 404)
  const { results: owners } = await c.env.DB.prepare(
    `SELECT l.*, pl.participation_percentage FROM landlords l JOIN property_landlords pl ON pl.landlord_id=l.id WHERE pl.property_id=?`
  ).bind(id).all()
  const { results: rentals } = await c.env.DB.prepare(
    `SELECT r.* FROM rentals r JOIN rental_property_links rl ON rl.rental_id=r.id WHERE rl.property_id=? ORDER BY r.start_date DESC`
  ).bind(id).all()
  return c.json({ property, owners, rentals })
})

r.put('/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  const b = await c.req.json() as any
  await c.env.DB.prepare(
    `UPDATE rental_properties SET address=?,floor_unit=?,city=?,province=?,postal_code=?,property_type=?,surface_m2=?,status=?,notes=?,updated_at=? WHERE id=? AND org_id=?`
  ).bind(b.address, b.floor_unit||null, b.city||null, b.province||null, b.postal_code||null,
    b.property_type||null, b.surface_m2||null, b.status||'disponible', b.notes||null, nowIso(), id, orgId).run()
  return c.json({ ok: true })
})

r.delete('/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  await c.env.DB.prepare('DELETE FROM property_landlords WHERE property_id=?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM rental_properties WHERE id=? AND org_id=?').bind(id, orgId).run()
  return c.json({ ok: true })
})

export default r
