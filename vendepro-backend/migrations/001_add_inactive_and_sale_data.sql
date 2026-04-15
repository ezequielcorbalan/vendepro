-- Add 'inactive' status to properties
-- SQLite doesn't support ALTER CHECK, so we drop and recreate isn't needed
-- since D1 doesn't enforce CHECK constraints strictly on existing data.
-- We just need to allow 'inactive' in our app code.

-- Add sale tracking fields to properties
ALTER TABLE properties ADD COLUMN sold_price REAL;
ALTER TABLE properties ADD COLUMN sold_date TEXT;
ALTER TABLE properties ADD COLUMN days_on_market INTEGER;

-- Index for neighborhood analytics
CREATE INDEX IF NOT EXISTS idx_properties_neighborhood ON properties(neighborhood);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
