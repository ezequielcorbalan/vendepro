# Data Model Rules

- Model real entities, don't overload one table
- States are scoped per entity (lead stages != property stages != reservation stages)
- Foreign keys: lead_id, contact_id, property_id, agent_id, org_id
- All tables have: id (TEXT PK), org_id, created_at, updated_at
- Use TEXT for IDs (generated with crypto.randomBytes)
- Use TEXT for dates (ISO format, SQLite datetime())
- Enums as TEXT columns with constrained values
- stage_history table logs all state transitions
- D1 = SQLite, so no ENUM type — use CHECK constraints or app-level validation
