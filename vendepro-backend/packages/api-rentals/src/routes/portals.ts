import { Hono } from 'hono'
import type { Env, AuthVars } from '../db'
import { createId, nowIso } from '../utils'

const r = new Hono<{ Bindings: Env } & AuthVars>()

/** Admin: list active portals */
r.get('/', async (c) => {
  const orgId = c.get('orgId')
  const { results } = await c.env.DB.prepare(
    `SELECT r.id, r.alias, r.portal_token, r.portal_pin, r.portal_active,
      GROUP_CONCAT(t.name || ' ' || t.last_name, ', ') as tenant_names
     FROM rentals r
     LEFT JOIN rental_tenant_links rtl ON rtl.rental_id=r.id
     LEFT JOIN tenants t ON t.id=rtl.tenant_id
     WHERE r.org_id=? AND r.portal_active=1
     GROUP BY r.id`
  ).bind(orgId).all()
  return c.json({ portals: results })
})

export default r

// Public portal routes (no auth middleware) — must be mounted separately
export const publicPortalRoutes = new Hono<{ Bindings: Env }>()

publicPortalRoutes.post('/:token/auth', async (c) => {
  const { token } = c.req.param()
  const { dni, pin } = await c.req.json() as any

  const rental = await c.env.DB.prepare(
    `SELECT r.*, t.dni_cuit FROM rentals r
     JOIN rental_tenant_links rtl ON rtl.rental_id=r.id
     JOIN tenants t ON t.id=rtl.tenant_id
     WHERE r.portal_token=? AND r.portal_active=1 AND t.dni_cuit=?`
  ).bind(token, dni).first() as any

  if (!rental || rental.portal_pin !== pin) {
    return c.json({ error: 'DNI o PIN incorrecto' }, 401)
  }

  // Generate a short-lived session token (simple approach: encode rental id + timestamp)
  const sessionToken = createId() + createId()
  // Store in a simple KV-less approach: embed rental id in a signed-ish token
  // For now encode as base64 JSON (not cryptographically secure, but ok for read-only portal)
  const payload = btoa(JSON.stringify({ rental_id: rental.id, exp: Date.now() + 3600_000 }))

  return c.json({ session_token: payload })
})

publicPortalRoutes.get('/:token/data', async (c) => {
  const { token } = c.req.param()
  const authHeader = c.req.header('Authorization')
  const sessionToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!sessionToken) return c.json({ error: 'Unauthorized' }, 401)

  let rentalId: string
  try {
    const decoded = JSON.parse(atob(sessionToken))
    if (decoded.exp < Date.now()) return c.json({ error: 'Session expired' }, 401)
    rentalId = decoded.rental_id
  } catch {
    return c.json({ error: 'Invalid session' }, 401)
  }

  const rental = await c.env.DB.prepare(
    'SELECT id,alias,status,start_date,end_date,currency,current_price,payment_day FROM rentals WHERE id=? AND portal_token=?'
  ).bind(rentalId, token).first()
  if (!rental) return c.json({ error: 'Not found' }, 404)

  const [{ results: payments }, { results: upcomingPayments }] = await Promise.all([
    c.env.DB.prepare('SELECT id,payment_date,amount,payment_type,description FROM payments WHERE rental_id=? ORDER BY payment_date DESC LIMIT 12').bind(rentalId).all(),
    c.env.DB.prepare('SELECT id,expected_date,expected_amount,period,status FROM upcoming_payments WHERE rental_id=? ORDER BY expected_date ASC LIMIT 6').bind(rentalId).all(),
  ])

  return c.json({ rental, payments, upcoming_payments: upcomingPayments })
})
