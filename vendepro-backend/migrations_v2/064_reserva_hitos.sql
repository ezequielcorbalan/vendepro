-- 064_reserva_hitos.sql
-- La reserva se vincula a la propiedad y suma las fechas de sus hitos, para
-- mostrarle al propietario (portal /d/<token>) cuánto falta para cada uno.
--
-- Hasta ahora `reservations` sólo guardaba la dirección como texto y la fecha
-- de reserva: no se podía saber de qué propiedad era ni cuándo vencía nada.
--
-- Hitos, en orden: plazo para aceptar → firma del boleto → escritura →
-- entrega de llaves. Cuál ya pasó lo dice el `stage` de la reserva
-- (reservada → boleto → escritura → entregada) y, para la aceptación,
-- `accepted_at`. Las fechas son las PREVISTAS que carga el agente.

ALTER TABLE reservations ADD COLUMN property_id TEXT REFERENCES properties(id);
ALTER TABLE reservations ADD COLUMN acceptance_deadline TEXT;
ALTER TABLE reservations ADD COLUMN accepted_at TEXT;
ALTER TABLE reservations ADD COLUMN boleto_date TEXT;
ALTER TABLE reservations ADD COLUMN escritura_date TEXT;
ALTER TABLE reservations ADD COLUMN delivery_date TEXT;

CREATE INDEX IF NOT EXISTS idx_reservations_property ON reservations(property_id);
