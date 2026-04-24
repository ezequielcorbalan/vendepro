import { Hono } from 'hono'
import type { Env, AuthVars } from '../db'
import { createId, nowIso } from '../utils'

const r = new Hono<{ Bindings: Env } & AuthVars>()

r.get('/', async (c) => {
  const orgId = c.get('orgId')
  const { results } = await c.env.DB.prepare(
    `SELECT i.*, t.name as tenant_name, t.last_name as tenant_last_name, l.name as landlord_name
     FROM invoices i
     LEFT JOIN tenants t ON t.id=i.tenant_id
     LEFT JOIN landlords l ON l.id=i.landlord_id
     WHERE i.org_id=? ORDER BY i.issue_date DESC`
  ).bind(orgId).all()
  return c.json({ invoices: results })
})

r.post('/', async (c) => {
  const orgId = c.get('orgId')
  const b = await c.req.json() as any
  const id = createId()
  const ivaAmount = (b.subtotal || 0) * ((b.iva_percentage || 0) / 100)
  const total = (b.subtotal || 0) + ivaAmount
  await c.env.DB.prepare(
    `INSERT INTO invoices (id,org_id,invoice_number,invoice_type,issue_date,recipient_type,tenant_id,landlord_id,concept,subtotal,iva_percentage,iva_amount,total,status,notes,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, orgId, b.invoice_number||null, b.invoice_type||'recibo_simple', b.issue_date,
    b.recipient_type||'inquilino', b.tenant_id||null, b.landlord_id||null, b.concept||null,
    b.subtotal||0, b.iva_percentage||0, ivaAmount, total, 'emitida', b.notes||null, nowIso(), nowIso()).run()
  return c.json({ id }, 201)
})

r.put('/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  const b = await c.req.json() as any
  await c.env.DB.prepare(
    `UPDATE invoices SET status=?,notes=?,updated_at=? WHERE id=? AND org_id=?`
  ).bind(b.status||'emitida', b.notes||null, nowIso(), id, orgId).run()
  return c.json({ ok: true })
})

export default r
