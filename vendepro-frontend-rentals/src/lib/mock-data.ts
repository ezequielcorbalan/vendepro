// Test data — used when NEXT_PUBLIC_USE_MOCK=true

const landlords = [
  { id: 'l1', name: 'Roberto', last_name: 'Fernández', email: 'roberto@gmail.com', phone: '1155443322', cuit: '20-23456789-0', person_type: 'fisica', address: 'Av. Santa Fe 2100, CABA', cbu: '0000003100012345678901', bank_alias: 'roberto.alquileres', admin_fee_percentage: 5, portal_token: null, portal_active: 0 },
  { id: 'l2', name: 'María', last_name: 'González', email: 'maria.g@hotmail.com', phone: '1162334455', cuit: '27-30123456-8', person_type: 'fisica', address: 'Belgrano 450, Córdoba', cbu: '0000003100098765432109', bank_alias: 'maria.propiedades', admin_fee_percentage: 8, portal_token: null, portal_active: 0 },
]

const properties = [
  { id: 'p1', address: 'Av. Corrientes 3456', floor_unit: '4° B', city: 'Buenos Aires', province: 'CABA', property_type: 'departamento', surface_m2: 65, status: 'ocupada', owner_names: 'Roberto Fernández' },
  { id: 'p2', address: 'Lavalle 890', floor_unit: '2° A', city: 'Buenos Aires', province: 'CABA', property_type: 'departamento', surface_m2: 45, status: 'disponible', owner_names: 'Roberto Fernández' },
  { id: 'p3', address: 'Callao 1234', floor_unit: 'PB', city: 'Buenos Aires', province: 'CABA', property_type: 'local', surface_m2: 120, status: 'ocupada', owner_names: 'María González' },
]

const tenants = [
  { id: 't1', name: 'Lucas', last_name: 'Martínez', email: 'lucas.m@gmail.com', phone: '1145678901', dni_cuit: '38456789', person_type: 'fisica', occupation: 'Empleado' },
  { id: 't2', name: 'Ana', last_name: 'Pérez', email: 'ana.perez@gmail.com', phone: '1123456789', dni_cuit: '35123456', person_type: 'fisica', occupation: 'Docente' },
  { id: 't3', name: 'Comercial', last_name: 'Sur S.A.', email: 'admin@comercialsur.com', phone: '1155001122', dni_cuit: '30-71234567-9', person_type: 'juridica', occupation: 'Empresa' },
]

const rentals = [
  { id: 'r1', alias: 'Corrientes 3456 4B — Lucas', status: 'activo', rental_type: 'residencial', start_date: '2025-04-01', end_date: '2027-04-01', duration_months: 24, currency: 'ARS', initial_price: 380000, current_price: 450000, payment_day: 5, adjustment_type: 'ipc_2m', adjustment_frequency: 'trimestral', next_adjustment_date: '2026-07-01', guarantee_type: 'personal_fiador', portal_active: 1, tenant_names: 'Lucas Martínez', property_addresses: 'Av. Corrientes 3456' },
  { id: 'r2', alias: 'Callao 1234 Local — Comercial Sur', status: 'activo', rental_type: 'comercial', start_date: '2025-01-01', end_date: '2028-01-01', duration_months: 36, currency: 'ARS', initial_price: 1200000, current_price: 1350000, payment_day: 1, adjustment_type: 'tasa_fija', adjustment_frequency: 'semestral', next_adjustment_date: '2026-07-01', guarantee_type: 'real', portal_active: 0, tenant_names: 'Comercial Sur S.A.', property_addresses: 'Callao 1234' },
  { id: 'r3', alias: 'Lavalle 890 2A — Ana Pérez', status: 'por_vencer', rental_type: 'residencial', start_date: '2024-05-01', end_date: '2026-05-01', duration_months: 24, currency: 'ARS', initial_price: 280000, current_price: 390000, payment_day: 10, adjustment_type: 'icl', adjustment_frequency: 'trimestral', next_adjustment_date: '2026-05-01', guarantee_type: 'seguro_caucion', portal_active: 0, tenant_names: 'Ana Pérez', property_addresses: 'Lavalle 890' },
]

const payments = [
  { id: 'pay1', rental_id: 'r1', rental_alias: 'Corrientes 3456 4B — Lucas', payment_type: 'alquiler', description: 'Alquiler Abril 2026', payment_date: '2026-04-05', amount: 450000, payment_method: 'transferencia', status: 'pagado' },
  { id: 'pay2', rental_id: 'r2', rental_alias: 'Callao 1234 Local — Comercial Sur', payment_type: 'alquiler', description: 'Alquiler Abril 2026', payment_date: '2026-04-01', amount: 1350000, payment_method: 'transferencia', status: 'pagado' },
  { id: 'pay3', rental_id: 'r1', rental_alias: 'Corrientes 3456 4B — Lucas', payment_type: 'alquiler', description: 'Alquiler Marzo 2026', payment_date: '2026-03-05', amount: 450000, payment_method: 'transferencia', status: 'pagado' },
  { id: 'pay4', rental_id: 'r3', rental_alias: 'Lavalle 890 2A — Ana Pérez', payment_type: 'alquiler', description: 'Alquiler Marzo 2026', payment_date: '2026-03-10', amount: 390000, payment_method: 'efectivo', status: 'pagado' },
  { id: 'pay5', rental_id: 'r2', rental_alias: 'Callao 1234 Local — Comercial Sur', payment_type: 'alquiler', description: 'Alquiler Marzo 2026', payment_date: '2026-03-01', amount: 1350000, payment_method: 'transferencia', status: 'pagado' },
  { id: 'pay6', rental_id: 'r1', rental_alias: 'Corrientes 3456 4B — Lucas', payment_type: 'deposito', description: 'Depósito en garantía', payment_date: '2025-04-01', amount: 450000, payment_method: 'transferencia', status: 'pagado' },
]

const upcomingPayments = [
  { id: 'up1', rental_id: 'r1', rental_alias: 'Corrientes 3456 4B — Lucas', expected_date: '2026-05-05', expected_amount: 450000, period: '2026-05', status: 'pendiente' },
  { id: 'up2', rental_id: 'r2', rental_alias: 'Callao 1234 Local — Comercial Sur', expected_date: '2026-05-01', expected_amount: 1350000, period: '2026-05', status: 'pendiente' },
  { id: 'up3', rental_id: 'r3', rental_alias: 'Lavalle 890 2A — Ana Pérez', expected_date: '2026-04-10', expected_amount: 390000, period: '2026-04', status: 'vencido' },
  { id: 'up4', rental_id: 'r1', rental_alias: 'Corrientes 3456 4B — Lucas', expected_date: '2026-06-05', expected_amount: 450000, period: '2026-06', status: 'pendiente' },
  { id: 'up5', rental_id: 'r2', rental_alias: 'Callao 1234 Local — Comercial Sur', expected_date: '2026-06-01', expected_amount: 1350000, period: '2026-06', status: 'pendiente' },
]

const expenses = [
  { id: 'exp1', description: 'Plomero — pérdida de agua baño', category: 'reparacion', expense_date: '2026-04-12', amount: 45000, payment_method: 'efectivo', linked_to: 'propiedad', provider: 'Mario Fontanería' },
  { id: 'exp2', description: 'Honorarios administración Abril', category: 'honorarios', expense_date: '2026-04-05', amount: 67500, payment_method: 'transferencia', linked_to: 'general', provider: null },
  { id: 'exp3', description: 'Pintura interior depto 4B', category: 'mantenimiento', expense_date: '2026-03-20', amount: 120000, payment_method: 'transferencia', linked_to: 'propiedad', provider: 'Pintores Unidos' },
  { id: 'exp4', description: 'Seguro de caución — Lavalle 890', category: 'seguros', expense_date: '2026-03-01', amount: 38000, payment_method: 'transferencia', linked_to: 'contrato', provider: 'Garantizar SA' },
  { id: 'exp5', description: 'Impuesto ABL trimestre', category: 'impuestos', expense_date: '2026-04-15', amount: 25000, payment_method: 'efectivo', linked_to: 'propiedad', provider: null },
]

const services = [
  { id: 'svc1', name: 'Luz (EDESUR)', property_id: 'p1', rental_id: 'r1', provider: 'EDESUR', account_number: '12345678', status: 'activo' },
  { id: 'svc2', name: 'Gas (Metrogas)', property_id: 'p1', rental_id: 'r1', provider: 'Metrogas', account_number: '87654321', status: 'activo' },
  { id: 'svc3', name: 'Expensas', property_id: 'p1', rental_id: 'r1', provider: 'Consorcio Corrientes 3456', account_number: null, status: 'activo' },
  { id: 'svc4', name: 'Agua (AySA)', property_id: 'p3', rental_id: 'r2', provider: 'AySA', account_number: '11223344', status: 'activo' },
  { id: 'svc5', name: 'Internet (Fibertel)', property_id: 'p1', rental_id: 'r1', provider: 'Fibertel', account_number: '99887766', status: 'activo' },
]

const otherIncome = [
  { id: 'oi1', description: 'Comisión nuevo contrato Callao', category: 'comision', income_date: '2026-01-05', amount: 675000, payment_method: 'transferencia' },
  { id: 'oi2', description: 'Honorarios renovación contrato', category: 'honorarios', income_date: '2026-03-15', amount: 195000, payment_method: 'transferencia' },
]

const coSigners = [
  { id: 'cs1', name: 'Carlos', last_name: 'Rodríguez', email: 'carlos.r@gmail.com', phone: '1167890123', dni_cuit: '25678901', guarantee_property_address: 'Av. Rivadavia 5000, CABA', guarantee_property_type: 'departamento', guarantee_property_valuation: 15000000 },
]

const landlordStatements = [
  { id: 'st1', landlord_id: 'l1', landlord_name: 'Roberto Fernández', period: '2026-04', total_income: 450000, total_expenses: 45000, admin_fee_amount: 22500, net_amount: 382500, status: 'borrador' },
  { id: 'st2', landlord_id: 'l2', landlord_name: 'María González', period: '2026-04', total_income: 1350000, total_expenses: 25000, admin_fee_amount: 108000, net_amount: 1217000, status: 'enviada' },
  { id: 'st3', landlord_id: 'l1', landlord_name: 'Roberto Fernández', period: '2026-03', total_income: 450000, total_expenses: 120000, admin_fee_amount: 22500, net_amount: 307500, status: 'pagada' },
]

const invoices = [
  { id: 'inv1', invoice_number: 'RC-0001', invoice_type: 'recibo_simple', issue_date: '2026-04-05', recipient_type: 'inquilino', tenant_name: 'Lucas', tenant_last_name: 'Martínez', concept: 'Alquiler Abril 2026 — Corrientes 3456 4B', subtotal: 450000, iva_percentage: 0, iva_amount: 0, total: 450000, status: 'emitida' },
  { id: 'inv2', invoice_number: 'FA-0001', invoice_type: 'A', issue_date: '2026-04-01', recipient_type: 'inquilino', tenant_name: 'Comercial Sur', tenant_last_name: 'S.A.', concept: 'Alquiler Abril 2026 — Callao 1234', subtotal: 1115702, iva_percentage: 21, iva_amount: 234298, total: 1350000, status: 'emitida' },
]

const financialAccounts = [
  { id: 'fa1', name: 'Cuenta BNA', account_type: 'banco', bank_name: 'Banco Nación', cbu: '0110012340000123456789', bank_alias: 'inmobiliaria.bna', initial_balance: 500000, is_active: 1 },
  { id: 'fa2', name: 'Caja chica oficina', account_type: 'efectivo', bank_name: null, cbu: null, bank_alias: null, initial_balance: 50000, is_active: 1 },
  { id: 'fa3', name: 'Mercado Pago', account_type: 'mercado_pago', bank_name: null, cbu: null, bank_alias: 'inmobiliaria.mp', initial_balance: 0, is_active: 1 },
]

const customIndices = [
  { id: 'ci1', name: 'Índice Casa Propia', description: 'Índice de ajuste del programa Casa Propia' },
]

const tenantPortals = [
  { id: 'r1', alias: 'Corrientes 3456 4B — Lucas', portal_token: 'tok_demo_lucas_corrientes', portal_pin: '1234', portal_active: 1, tenant_names: 'Lucas Martínez' },
]

// ── Router ──────────────────────────────────────────────────────────────────

export function mockFetch(path: string): any {
  const clean = path.split('?')[0].replace(/\/$/, '')

  if (clean === '/dashboard') return {
    active_rentals: 3,
    month_payments_count: 5,
    month_payments_total: 2190000,
    month_expenses_total: 137500,
    pending_upcoming_count: 4,
    expiring_rentals: [{ id: 'r3', alias: 'Lavalle 890 2A — Ana Pérez', end_date: '2026-05-01' }],
    overdue_upcoming: upcomingPayments.filter(u => u.status === 'vencido'),
  }

  if (clean === '/rentals') return { rentals }
  if (clean.match(/^\/rentals\/(\w+)$/)) {
    const id = clean.split('/')[2]
    const rental = rentals.find(r => r.id === id) || rentals[0]
    return {
      rental,
      tenants: [tenants[0]],
      properties: [properties[0]],
      payments: payments.filter(p => p.rental_id === rental.id),
      upcoming: upcomingPayments.filter(u => u.rental_id === rental.id),
      adjustments: [{ id: 'adj1', adjustment_date: '2026-01-01', previous_price: 380000, new_price: 450000, adjustment_percentage: 18.4, adjustment_type: 'ipc_2m' }],
    }
  }

  if (clean === '/payments') return { payments }
  if (clean === '/upcoming-payments') return { upcoming_payments: upcomingPayments }
  if (clean === '/expenses') return { expenses }
  if (clean === '/services') return { services }
  if (clean === '/other-income') return { other_income: otherIncome }
  if (clean === '/tenants') return { tenants }
  if (clean.match(/^\/tenants\/\w+$/)) return { tenant: tenants[0], rentals: [rentals[0]], payments: payments.slice(0, 3) }
  if (clean === '/co-signers') return { co_signers: coSigners }
  if (clean === '/landlords') return { landlords }
  if (clean.match(/^\/landlords\/\w+$/)) {
    const id = clean.split('/')[2]
    const landlord = landlords.find(l => l.id === id) || landlords[0]
    return { landlord, properties: [{ ...properties[0], participation_percentage: 100 }], rentals, statements: landlordStatements.filter(s => s.landlord_id === landlord.id) }
  }
  if (clean === '/rental-properties') return { properties }
  if (clean.match(/^\/rental-properties\/\w+$/)) return { property: properties[0], owners: [{ ...landlords[0], participation_percentage: 100 }], rentals: [rentals[0]] }
  if (clean === '/portals') return { portals: tenantPortals }
  if (clean === '/summary') return {
    period: '2026-04',
    total_income: 2190000,
    total_expenses: 137500,
    net: 2052500,
    pending_count: 3,
    overdue_count: 1,
    payments,
    expenses,
    upcoming: upcomingPayments,
    landlord_breakdown: [
      { id: 'l1', name: 'Roberto', last_name: 'Fernández', admin_fee_percentage: 5, income: 450000, payment_count: 1 },
      { id: 'l2', name: 'María', last_name: 'González', admin_fee_percentage: 8, income: 1350000, payment_count: 1 },
    ],
  }
  if (clean === '/landlord-statements') return { statements: landlordStatements }
  if (clean === '/invoices') return { invoices }
  if (clean === '/financial-accounts') return { accounts: financialAccounts }
  if (clean === '/custom-indices') return { indices: customIndices }
  if (clean.match(/^\/custom-indices\/\w+\/values$/)) return { values: [
    { id: 'v1', value_date: '2026-01-01', value: 4.2 },
    { id: 'v2', value_date: '2026-02-01', value: 3.8 },
    { id: 'v3', value_date: '2026-03-01', value: 5.1 },
    { id: 'v4', value_date: '2026-04-01', value: 4.7 },
  ]}

  return null
}
