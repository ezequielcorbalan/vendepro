import { Hono } from 'hono'
import type { Env, AuthVars } from '../db'
import { createId, nowIso } from '../utils'

const r = new Hono<{ Bindings: Env } & AuthVars>()

r.get('/', async (c) => {
  const orgId = c.get('orgId')
  const { landlord_id, period } = c.req.query()
  let q = `SELECT ls.*, l.name as landlord_name, l.last_name as landlord_last_name
    FROM landlord_statements ls LEFT JOIN landlords l ON l.id=ls.landlord_id WHERE ls.org_id=?`
  const params: any[] = [orgId]
  if (landlord_id) { q += ' AND ls.landlord_id=?'; params.push(landlord_id) }
  if (period) { q += ' AND ls.period=?'; params.push(period) }
  q += ' ORDER BY ls.period DESC, l.last_name ASC'
  const { results } = await c.env.DB.prepare(q).bind(...params).all()
  const mapped = (results as any[]).map(s => ({
    ...s,
    landlord_name: `${s.landlord_name} ${s.landlord_last_name}`.trim(),
  }))
  return c.json({ statements: mapped })
})

r.post('/', async (c) => {
  const orgId = c.get('orgId')
  const b = await c.req.json() as any
  const { landlord_id, period } = b

  const [year, month] = period.split('-')
  const dateFrom = `${year}-${month}-01`
  const dateTo = `${year}-${month}-31`

  // Calculate totals for this landlord/period
  const { results: payments } = await c.env.DB.prepare(
    `SELECT p.amount, pl.participation_percentage FROM payments p
     JOIN rentals r ON r.id=p.rental_id
     JOIN rental_property_links rpl ON rpl.rental_id=r.id
     JOIN property_landlords pl ON pl.property_id=rpl.property_id
     WHERE p.org_id=? AND pl.landlord_id=? AND p.payment_date BETWEEN ? AND ?`
  ).bind(orgId, landlord_id, dateFrom, dateTo).all()

  const { results: expenses } = await c.env.DB.prepare(
    `SELECT e.amount FROM expenses e
     JOIN rental_property_links rpl ON rpl.rental_id=e.rental_id
     JOIN property_landlords pl ON pl.property_id=rpl.property_id
     WHERE e.org_id=? AND pl.landlord_id=? AND e.expense_date BETWEEN ? AND ?`
  ).bind(orgId, landlord_id, dateFrom, dateTo).all()

  const landlord = await c.env.DB.prepare('SELECT admin_fee_percentage FROM landlords WHERE id=?').bind(landlord_id).first() as any

  const totalIncome = (payments as any[]).reduce((s, p) => s + Number(p.amount) * (Number(p.participation_percentage) / 100), 0)
  const totalExpenses = (expenses as any[]).reduce((s, e) => s + Number(e.amount), 0)
  const adminFee = totalIncome * ((landlord?.admin_fee_percentage || 0) / 100)
  const netAmount = totalIncome - totalExpenses - adminFee

  const id = createId()
  await c.env.DB.prepare(
    `INSERT INTO landlord_statements (id,org_id,landlord_id,period,total_income,total_expenses,admin_fee_amount,net_amount,status,notes,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, orgId, landlord_id, period, totalIncome, totalExpenses, adminFee, netAmount,
    'borrador', b.notes||null, nowIso(), nowIso()).run()

  return c.json({ id, total_income: totalIncome, total_expenses: totalExpenses, admin_fee_amount: adminFee, net_amount: netAmount }, 201)
})

r.put('/:id', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  const b = await c.req.json() as any
  const sentAt = b.status === 'enviada' ? nowIso() : null
  const paidAt = b.status === 'pagada' ? nowIso() : null
  await c.env.DB.prepare(
    `UPDATE landlord_statements SET status=?,notes=?,sent_at=COALESCE(?,sent_at),paid_at=COALESCE(?,paid_at),updated_at=? WHERE id=? AND org_id=?`
  ).bind(b.status, b.notes||null, sentAt, paidAt, nowIso(), id, orgId).run()
  return c.json({ ok: true })
})

r.get('/:id/pdf', async (c) => {
  const orgId = c.get('orgId')
  const { id } = c.req.param()
  const stmt = await c.env.DB.prepare(
    `SELECT ls.*, l.name as l_name, l.last_name as l_last, l.email, l.cbu, l.bank_alias
     FROM landlord_statements ls JOIN landlords l ON l.id=ls.landlord_id WHERE ls.id=? AND ls.org_id=?`
  ).bind(id, orgId).first() as any
  if (!stmt) return c.json({ error: 'Not found' }, 404)

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;padding:40px;color:#111}
    h1{color:#ff007c}table{width:100%;border-collapse:collapse;margin-top:20px}
    th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}
    .total{font-weight:bold;font-size:1.1em}
    </style></head><body>
    <h1>Liquidación de propietario</h1>
    <p><strong>Propietario:</strong> ${stmt.l_name} ${stmt.l_last}</p>
    <p><strong>Período:</strong> ${stmt.period}</p>
    <table>
      <tr><th>Concepto</th><th>Monto</th></tr>
      <tr><td>Ingresos del período</td><td>$${Number(stmt.total_income).toLocaleString('es-AR')}</td></tr>
      <tr><td>Gastos del período</td><td>-$${Number(stmt.total_expenses).toLocaleString('es-AR')}</td></tr>
      <tr><td>Honorarios de administración</td><td>-$${Number(stmt.admin_fee_amount).toLocaleString('es-AR')}</td></tr>
      <tr class="total"><td>Monto neto a transferir</td><td>$${Number(stmt.net_amount).toLocaleString('es-AR')}</td></tr>
    </table>
    ${stmt.cbu ? `<p style="margin-top:20px"><strong>CBU:</strong> ${stmt.cbu}${stmt.bank_alias ? ` (${stmt.bank_alias})` : ''}</p>` : ''}
    <p style="margin-top:40px;font-size:0.8em;color:#888">Generado por VendéPro Alquileres</p>
    </body></html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="liquidacion-${stmt.period}.html"`,
    },
  })
})

export default r
