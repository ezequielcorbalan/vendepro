import { Hono } from 'hono'
import type { Env, AuthVars } from '../db'
import { currentPeriod } from '../utils'

const r = new Hono<{ Bindings: Env } & AuthVars>()

r.get('/', async (c) => {
  const orgId = c.get('orgId')
  const period = currentPeriod()
  const [year, month] = period.split('-')
  const dateFrom = `${year}-${month}-01`
  const dateTo = `${year}-${month}-31`
  const today = new Date().toISOString().slice(0, 10)

  const [
    activeRentals,
    monthPayments,
    monthExpenses,
    pendingUpcoming,
    expiringRentals,
    overdueUpcoming,
  ] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) as count FROM rentals WHERE org_id=? AND status IN ('activo','por_vencer')").bind(orgId).first() as Promise<any>,
    c.env.DB.prepare("SELECT COUNT(*) as count, SUM(amount) as total FROM payments WHERE org_id=? AND payment_date BETWEEN ? AND ?").bind(orgId, dateFrom, dateTo).first() as Promise<any>,
    c.env.DB.prepare("SELECT SUM(amount) as total FROM expenses WHERE org_id=? AND expense_date BETWEEN ? AND ?").bind(orgId, dateFrom, dateTo).first() as Promise<any>,
    c.env.DB.prepare("SELECT COUNT(*) as count FROM upcoming_payments WHERE org_id=? AND status='pendiente'").bind(orgId).first() as Promise<any>,
    c.env.DB.prepare(`SELECT r.id, r.alias, r.end_date FROM rentals r WHERE r.org_id=? AND r.status='activo' AND r.end_date BETWEEN ? AND date(?, '+60 days') ORDER BY r.end_date ASC LIMIT 5`).bind(orgId, today, today).first() as Promise<any>,
    c.env.DB.prepare(`SELECT up.*, r.alias as rental_alias FROM upcoming_payments up LEFT JOIN rentals r ON r.id=up.rental_id WHERE up.org_id=? AND up.status='pendiente' ORDER BY up.expected_date ASC LIMIT 10`).bind(orgId).all() as Promise<any>,
  ])

  return c.json({
    active_rentals: activeRentals?.count || 0,
    month_payments_count: monthPayments?.count || 0,
    month_payments_total: monthPayments?.total || 0,
    month_expenses_total: monthExpenses?.total || 0,
    pending_upcoming_count: pendingUpcoming?.count || 0,
    expiring_rentals: expiringRentals ? [expiringRentals] : [],
    overdue_upcoming: overdueUpcoming?.results || [],
  })
})

export default r
