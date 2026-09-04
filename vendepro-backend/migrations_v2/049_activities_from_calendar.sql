-- ───────────────────────────────────────────────────────────────
-- 049_activities_from_calendar.sql
--
-- La actividad comercial se registra sola desde el calendario: al marcar
-- completado un evento (reunión, visita, tasación…), el CRM anota la
-- actividad correspondiente. Antes había que cargarla a mano y nadie lo
-- hacía — de ahí que el dashboard mostrara "Actividad (30d) = 0" con 68
-- leads contactados.
--
-- `calendar_event_id` es el vínculo con el evento que la generó. Sirve para
-- dos cosas:
--   1. Idempotencia: el índice único parcial evita que destildar y volver a
--      tildar un evento duplique la actividad.
--   2. Reversibilidad: si el evento se destilda, se puede borrar exactamente
--      la actividad que se había generado, sin tocar las cargadas a mano
--      (esas tienen calendar_event_id NULL).
-- ───────────────────────────────────────────────────────────────

ALTER TABLE activities ADD COLUMN calendar_event_id TEXT;

-- Parcial: sólo aplica a las actividades que vienen del calendario. Las
-- manuales quedan todas con NULL y NULL no colisiona en un índice único.
CREATE UNIQUE INDEX IF NOT EXISTS idx_activities_calendar_event
  ON activities(calendar_event_id)
  WHERE calendar_event_id IS NOT NULL;
