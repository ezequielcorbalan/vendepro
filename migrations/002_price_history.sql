-- Price history tracking
CREATE TABLE IF NOT EXISTS price_history (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  price REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  reason TEXT,
  changed_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_price_history_property ON price_history(property_id);
