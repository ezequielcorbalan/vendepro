import { Hono } from 'hono'
import { corsMiddleware, errorHandler, createAuthMiddleware, JwtAuthService } from '@vendepro/infrastructure'
import type { Env, AuthVars } from './db'

import landlordsRouter from './routes/landlords'
import tenantsRouter from './routes/tenants'
import coSignersRouter from './routes/co-signers'
import rentalPropertiesRouter from './routes/rental-properties'
import contractsRouter from './routes/contracts'
import paymentsRouter from './routes/payments'
import upcomingPaymentsRouter from './routes/upcoming-payments'
import expensesRouter from './routes/expenses'
import servicesRouter from './routes/services'
import otherIncomeRouter from './routes/other-income'
import configRouter from './routes/config'
import summaryRouter from './routes/summary'
import landlordStatementsRouter from './routes/landlord-statements'
import invoicingRouter from './routes/invoicing'
import portalsRouter, { publicPortalRoutes } from './routes/portals'
import landlordPortalRouter from './routes/landlord-portal'
import dashboardRouter from './routes/dashboard'

const app = new Hono<{ Bindings: Env } & AuthVars>()

app.use('*', corsMiddleware)
app.onError(errorHandler)

// Public routes (no auth)
app.route('/portal', publicPortalRoutes)
app.route('/landlord-portal', landlordPortalRouter)

app.get('/config', (c) => {
  return c.json({
    rental_types: ['residencial', 'comercial'],
    currencies: ['ARS', 'USD'],
    adjustment_frequencies: ['mensual', 'bimestral', 'trimestral', 'cuatrimestral', 'semestral', 'anual'],
    adjustment_types: ['tasa_fija', 'manual', 'ipc_2m', 'ipc_1m', 'icl', 'personalizado', 'sin_ajuste'],
    guarantee_types: ['sin_garantia', 'real', 'personal_fiador', 'seguro_caucion'],
    payment_methods: ['efectivo', 'transferencia', 'cheque', 'mercado_pago', 'otro'],
    payment_types: ['alquiler', 'llave', 'expensas', 'deposito', 'otros'],
    expense_categories: ['mantenimiento', 'reparacion', 'honorarios', 'impuestos', 'seguros', 'expensas', 'servicios', 'otros'],
    property_types: ['departamento', 'casa', 'local', 'oficina', 'cochera', 'otro'],
    property_statuses: ['disponible', 'ocupada', 'en_mantenimiento'],
    rental_statuses: ['activo', 'por_vencer', 'finalizado', 'rescindido'],
    statement_statuses: ['borrador', 'enviada', 'pagada'],
    invoice_types: ['A', 'B', 'C', 'recibo_simple'],
  })
})

// Auth middleware for all protected routes
app.use('*', async (c, next) => {
  const authService = new JwtAuthService(c.env.JWT_SECRET)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAuthMiddleware(authService)(c as any, next)
})

// Protected routes
app.route('/dashboard', dashboardRouter)
app.route('/rentals', contractsRouter)
app.route('/payments', paymentsRouter)
app.route('/upcoming-payments', upcomingPaymentsRouter)
app.route('/expenses', expensesRouter)
app.route('/services', servicesRouter)
app.route('/other-income', otherIncomeRouter)
app.route('/tenants', tenantsRouter)
app.route('/co-signers', coSignersRouter)
app.route('/landlords', landlordsRouter)
app.route('/rental-properties', rentalPropertiesRouter)
app.route('/summary', summaryRouter)
app.route('/landlord-statements', landlordStatementsRouter)
app.route('/invoices', invoicingRouter)
app.route('/portals', portalsRouter)
app.use('/financial-accounts', async (c, next) => next())
app.use('/custom-indices', async (c, next) => next())
app.route('/', configRouter)

export default app
