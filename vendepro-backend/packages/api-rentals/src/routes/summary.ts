import { Hono } from 'hono'
import type { Env, AuthVars } from '../db'
import { currentPeriod } from '../utils'

const r = new Hono<{ Bindings: Env } & AuthVars>()

r.get('/', async (c) => {
  const orgId = c.get('orgId')
  const period = c.req.query('period') || currentPeriod()
  const [year, month] = period.split('-')
  const dateFrom = `${year}-${month}-01`
  const dateTo = `${year}-${month}-31`

  const [paymentsRes, expensesRes, upcomingRes] = await Promise.all([
    c.env.DB.prepare(
      `SELECT p.*, r.alias as rental_alias FROM payments p LEFT JOIN rentals r ON r.id=p.rental_id
       WHERE p.org_id=? AND p.payment_date BETWEEN ? AND ? ORDER BY p.payment_date DESC`
    ).bind(orgId, dateFrom, dateTo).all(),
    c.env.DB.prepare(
      `SELECT * FROM expenses WHERE org_id=? AND expense_date BETWEEN ? AND ? ORDER BY expense_date DESC`
    ).bind(orgId, dateFrom, dateTo).all(),
    c.env.DB.prepare(
      `SELECT up.*, r.alias as rental_alias FROM upcoming_payments up LEFT JOIN rentals r ON r.id=up.rental_id
       WHERE up.org_id=? AND up.period=?`
    ).bind(orgId, period).all(),
  ])

  const payments = paymentsRes.results
  const expenses = expensesRes.results
  const upcoming = upcomingRes.results

  const totalIncome = payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
  const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0)
  const pendingCount = upcoming.filter((u: any) => u.status === 'pendiente').length
  const overdueCount = upcoming.filter((u: any) => u.status === 'vencido').length

  // Per-landlord breakdown via rentals linked to landlords
  const { results: landlordBreakdown } = await c.env.DB.prepare(
    `SELECT l.id, l.name, l.last_name, l.admin_fee_percentage,
      SUM(p.amount) as income,
      COUNT(p.id) as payment_count
     FROM landlords l
     JOIN property_landlords pl ON pl.landlord_id=l.id
     JOIN rental_property_links rpl ON rpl.property_id=pl.property_id
     JOIN rentals r ON r.id=rpl.rental_id
     JOIN payments p ON p.rental_id=r.id
     WHERE l.org_id=? AND p.payment_date BETWEEN ? AND ?
     GROUP BY l.id`
  ).bind(orgId, dateFrom, dateTo).all()

  return c.json({
    period,
    total_income: totalIncome,
    total_expenses: totalExpenses,
    net: totalIncome - totalExpenses,
    pending_count: pendingCount,
    overdue_count: overdueCount,
    payments,
    expenses,
    upcoming,
    landlord_breakdown: landlordBreakdown,
  })
})

export default r
