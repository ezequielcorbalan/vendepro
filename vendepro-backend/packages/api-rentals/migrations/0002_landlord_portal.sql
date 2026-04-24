-- Add portal token to landlords
ALTER TABLE landlords ADD COLUMN portal_token TEXT UNIQUE;
ALTER TABLE landlords ADD COLUMN portal_active INTEGER DEFAULT 0;
