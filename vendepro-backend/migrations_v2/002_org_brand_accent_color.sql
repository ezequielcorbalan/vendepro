-- Add brand_accent_color column to organizations (used by D1OrganizationRepository)
ALTER TABLE organizations ADD COLUMN brand_accent_color TEXT DEFAULT '#ff8017';
