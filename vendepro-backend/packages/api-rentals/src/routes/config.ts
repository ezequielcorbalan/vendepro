import { Hono } from 'hono'
import type { Env, AuthVars } from '../db'
import { createId, nowIso } from '../utils'

const r = new Hono<{ Bindings: Env } & AuthVars>()

// ── Financial Accounts ────────────────────────────────────────────────────────

r.get('/financial-accounts', async (c) => {
  const orgId = c.get('orgId')
  const { results } = await c.env.DB.prepare('SELECT * FROM financial_accounts WHERE org_id=? ORDER BY created_at ASC').bind(orgId).all()
  return c.json({ accounts: results })
})

r.post('/financial-accounts', async (c) => {
  const orgId = c.get('orgId')
  const b = await c.req.json() as any
  const id = createId()
  await c.env.DB.prepare(
    `INSERT INTO financial_accounts (id,org_id,name,account_type,bank_name,cbu,bank_alias,initial_balance,is_active,created_at)
     VALUES (?,?,?,?,?,?,?,?,1,?)`
  ).bind(id, orgId, b.name, b.account_type||'banco', b.bank_name||null, b.cbu||null,
    b.bank_alias||null, b.initial_balance||0, nowIso()).run()
  return c.json({ id }, 201)
})

r.delete('/financial-accounts/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  await c.env.DB.prepare('DELETE FROM financial_accounts WHERE id=? AND org_id=?').bind(id, orgId).run()
  return c.json({ ok: true })
})

// ── Custom Indices ─────────────────────────────────────────────────────────────

r.get('/custom-indices', async (c) => {
  const orgId = c.get('orgId')
  const { results } = await c.env.DB.prepare('SELECT * FROM custom_indices WHERE org_id=? ORDER BY name ASC').bind(orgId).all()
  return c.json({ indices: results })
})

r.post('/custom-indices', async (c) => {
  const orgId = c.get('orgId')
  const b = await c.req.json() as any
  const id = createId()
  await c.env.DB.prepare(
    'INSERT INTO custom_indices (id,org_id,name,description,created_at) VALUES (?,?,?,?,?)'
  ).bind(id, orgId, b.name, b.description||null, nowIso()).run()
  return c.json({ id }, 201)
})

r.delete('/custom-indices/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  await c.env.DB.prepare('DELETE FROM custom_index_values WHERE custom_index_id=?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM custom_indices WHERE id=? AND org_id=?').bind(id, orgId).run()
  return c.json({ ok: true })
})

r.get('/custom-indices/:id/values', async (c) => {
  const { id } = c.req.param()
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM custom_index_values WHERE custom_index_id=? ORDER BY value_date ASC'
  ).bind(id).all()
  return c.json({ values: results })
})

r.post('/custom-indices/:id/values', async (c) => {
  const { id } = c.req.param()
  const b = await c.req.json() as any
  const vid = createId()
  await c.env.DB.prepare(
    'INSERT OR REPLACE INTO custom_index_values (id,custom_index_id,value_date,value) VALUES (?,?,?,?)'
  ).bind(vid, id, b.value_date, b.value).run()
  return c.json({ id: vid }, 201)
})

export default r
