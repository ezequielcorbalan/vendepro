-- VendéPro Alquileres — initial schema

CREATE TABLE landlords (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  cuit TEXT,
  person_type TEXT DEFAULT 'fisica',
  company_name TEXT,
  address TEXT,
  cbu TEXT,
  bank_alias TEXT,
  admin_fee_percentage REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE rental_properties (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  address TEXT NOT NULL,
  floor_unit TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  property_type TEXT,
  surface_m2 REAL,
  status TEXT DEFAULT 'disponible',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE property_landlords (
  property_id TEXT REFERENCES rental_properties(id),
  landlord_id TEXT REFERENCES landlords(id),
  participation_percentage REAL DEFAULT 100,
  PRIMARY KEY (property_id, landlord_id)
);

CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  dni_cuit TEXT,
  person_type TEXT DEFAULT 'fisica',
  birth_date TEXT,
  nationality TEXT,
  marital_status TEXT,
  occupation TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE co_signers (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  dni_cuit TEXT,
  person_type TEXT DEFAULT 'fisica',
  guarantee_property_address TEXT,
  guarantee_property_type TEXT,
  guarantee_property_valuation REAL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE custom_indices (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE custom_index_values (
  id TEXT PRIMARY KEY,
  custom_index_id TEXT REFERENCES custom_indices(id),
  value_date TEXT NOT NULL,
  value REAL NOT NULL,
  UNIQUE(custom_index_id, value_date)
);

CREATE TABLE rentals (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  alias TEXT NOT NULL,
  status TEXT DEFAULT 'activo',
  rental_type TEXT DEFAULT 'residencial',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  duration_months INTEGER NOT NULL,
  currency TEXT DEFAULT 'ARS',
  initial_price REAL NOT NULL,
  current_price REAL NOT NULL,
  applies_iva INTEGER DEFAULT 0,
  payment_day INTEGER DEFAULT 1,
  deposit_months REAL DEFAULT 1,
  adjustment_frequency TEXT,
  adjustment_type TEXT,
  adjustment_fixed_rate REAL,
  custom_index_id TEXT REFERENCES custom_indices(id),
  next_adjustment_date TEXT,
  guarantee_type TEXT DEFAULT 'sin_garantia',
  co_signer_id TEXT REFERENCES co_signers(id),
  portal_active INTEGER DEFAULT 0,
  portal_pin TEXT,
  portal_token TEXT UNIQUE,
  charges_municipal_tax INTEGER DEFAULT 0,
  charges_water INTEGER DEFAULT 0,
  charges_electricity INTEGER DEFAULT 0,
  charges_gas INTEGER DEFAULT 0,
  charges_expenses INTEGER DEFAULT 0,
  charges_extras INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE rental_property_links (
  rental_id TEXT REFERENCES rentals(id),
  property_id TEXT REFERENCES rental_properties(id),
  PRIMARY KEY (rental_id, property_id)
);

CREATE TABLE rental_tenant_links (
  rental_id TEXT REFERENCES rentals(id),
  tenant_id TEXT REFERENCES tenants(id),
  PRIMARY KEY (rental_id, tenant_id)
);

CREATE TABLE upcoming_payments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  rental_id TEXT REFERENCES rentals(id),
  expected_date TEXT NOT NULL,
  expected_amount REAL NOT NULL,
  period TEXT NOT NULL,
  status TEXT DEFAULT 'pendiente',
  payment_id TEXT REFERENCES payments(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  rental_id TEXT REFERENCES rentals(id),
  upcoming_payment_id TEXT,
  payment_type TEXT NOT NULL,
  description TEXT,
  payment_date TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT,
  financial_account_id TEXT,
  status TEXT DEFAULT 'pagado',
  is_split INTEGER DEFAULT 0,
  part1_amount REAL,
  part1_method TEXT,
  part1_account_id TEXT,
  part1_date TEXT,
  part2_amount REAL,
  part2_method TEXT,
  part2_account_id TEXT,
  part2_date TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  expense_date TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT,
  financial_account_id TEXT,
  linked_to TEXT DEFAULT 'general',
  rental_id TEXT REFERENCES rentals(id),
  property_id TEXT REFERENCES rental_properties(id),
  provider TEXT,
  receipt_url TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE services (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  property_id TEXT REFERENCES rental_properties(id),
  rental_id TEXT REFERENCES rentals(id),
  provider TEXT,
  account_number TEXT,
  status TEXT DEFAULT 'activo',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE service_payments (
  id TEXT PRIMARY KEY,
  service_id TEXT REFERENCES services(id),
  due_date TEXT,
  payment_date TEXT,
  amount REAL,
  invoice_number TEXT,
  receipt_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE other_income (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  income_date TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT,
  financial_account_id TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE financial_accounts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT,
  bank_name TEXT,
  cbu TEXT,
  bank_alias TEXT,
  initial_balance REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE landlord_statements (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  landlord_id TEXT REFERENCES landlords(id),
  property_id TEXT REFERENCES rental_properties(id),
  period TEXT NOT NULL,
  total_income REAL DEFAULT 0,
  total_expenses REAL DEFAULT 0,
  admin_fee_amount REAL DEFAULT 0,
  net_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'borrador',
  notes TEXT,
  sent_at TEXT,
  paid_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE price_adjustments (
  id TEXT PRIMARY KEY,
  rental_id TEXT REFERENCES rentals(id),
  adjustment_date TEXT NOT NULL,
  previous_price REAL,
  new_price REAL,
  adjustment_percentage REAL,
  adjustment_type TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  invoice_number TEXT UNIQUE,
  invoice_type TEXT,
  issue_date TEXT NOT NULL,
  recipient_type TEXT,
  tenant_id TEXT REFERENCES tenants(id),
  landlord_id TEXT REFERENCES landlords(id),
  concept TEXT,
  subtotal REAL,
  iva_percentage REAL DEFAULT 0,
  iva_amount REAL DEFAULT 0,
  total REAL,
  status TEXT DEFAULT 'emitida',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX idx_rentals_org ON rentals(org_id);
CREATE INDEX idx_payments_rental ON payments(rental_id);
CREATE INDEX idx_payments_org_date ON payments(org_id, payment_date);
CREATE INDEX idx_upcoming_org ON upcoming_payments(org_id);
CREATE INDEX idx_upcoming_rental ON upcoming_payments(rental_id);
CREATE INDEX idx_expenses_org ON expenses(org_id);
CREATE INDEX idx_tenants_org ON tenants(org_id);
CREATE INDEX idx_landlords_org ON landlords(org_id);
