-- ───────────────────────────────────────────────────────────────
-- 054_marketing_por_usuario.sql
--
-- Todo el marketing pasa a ser POR USUARIO: cada agente maneja su propio
-- presupuesto y sus propias cuentas publicitarias, y el panel le muestra SU
-- plata contra SUS leads.
--
-- Revierte la parte org-level de la decisión del 03-sep ("la inmobiliaria tiene
-- la suya y cada agente la propia"). Ahora no hay cuentas de la agencia: si la
-- inmobiliaria tiene una cuenta común, la conecta el usuario que la administra.
--
-- Efectos secundarios buenos:
--   • La pauta ya era por agente (`meta_integration.agent_id`, migración 040):
--     esto alinea el gasto de portales y el histórico con ese mismo criterio.
--   • Achica el problema de "quién ve la plata": cada uno ve la suya. Queda
--     pendiente sólo que el admin pueda ver la de todos.
--
-- ── Retrocompatibilidad ─────────────────────────────────────────
-- Las filas existentes de `portal_spend` no tienen dueño. Se les asigna el
-- usuario que las cargó (`created_by`), que es lo más cercano a la verdad. Si
-- ese dato falta, la fila queda con `owner_user_id` NULL y sigue contando como
-- gasto de la org hasta que alguien la edite — se prefiere eso a adivinar un
-- dueño y atribuirle gasto ajeno a un agente.
-- ───────────────────────────────────────────────────────────────

ALTER TABLE portal_spend ADD COLUMN owner_user_id TEXT;

UPDATE portal_spend SET owner_user_id = created_by WHERE owner_user_id IS NULL;

-- La unicidad pasa a ser por dueño: dos agentes pueden cargar su propio gasto
-- de ZonaProp en el mismo mes sin pisarse. El índice viejo lo impedía.
DROP INDEX IF EXISTS idx_portal_spend_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_spend_unique
  ON portal_spend(org_id, COALESCE(owner_user_id, ''), provider, period_month);

CREATE INDEX IF NOT EXISTS idx_portal_spend_owner
  ON portal_spend(org_id, owner_user_id, period_month);

-- Mismo criterio para el objetivo de las campañas: la campaña es de la cuenta
-- publicitaria de un usuario, así que su etiqueta también.
ALTER TABLE campaign_goals ADD COLUMN owner_user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_campaign_goals_owner
  ON campaign_goals(org_id, owner_user_id);
