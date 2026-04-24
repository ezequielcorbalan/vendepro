import { Hono } from 'hono'
import type { Env } from '../db'

// Public — no auth middleware
const r = new Hono<{ Bindings: Env }>()

r.get('/:token', async (c) => {
  const { token } = c.req.param()

  const landlord = await c.env.DB.prepare(
    'SELECT id,name,last_name,email,phone,cbu,bank_alias,admin_fee_percentage FROM landlords WHERE portal_token=? AND portal_active=1'
  ).bind(token).first()

  if (!landlord) return c.json({ error: 'Portal no encontrado o link inválido' }, 404)

  const lid = (landlord as any).id

  const [{ results: properties }, { results: rentals }, { results: statements }] = await Promise.all([
    c.env.DB.prepare(
      `SELECT rp.* FROM rental_properties rp
       JOIN property_landlords pl ON pl.property_id=rp.id
       WHERE pl.landlord_id=?`
    ).bind(lid).all(),
    c.env.DB.prepare(
      `SELECT r.id,r.alias,r.start_date,r.end_date,r.currency,r.current_price,r.payment_day,r.status
       FROM rentals r
       JOIN rental_property_links rpl ON rpl.rental_id=r.id
       JOIN property_landlords pl ON pl.property_id=rpl.property_id
       WHERE pl.landlord_id=? AND r.status IN ('activo','por_vencer')
       GROUP BY r.id`
    ).bind(lid).all(),
    c.env.DB.prepare(
      'SELECT id,period,total_income,total_expenses,admin_fee_amount,net_amount,status FROM landlord_statements WHERE landlord_id=? ORDER BY period DESC LIMIT 12'
    ).bind(lid).all(),
  ])

  return c.json({ landlord, properties, rentals, statements })
})

export default r
