-- Migration 024 — Pesos de ponderación de superficies (cubierta/semi/descubierta).
-- Default por org (con valores estándar AR: 100/75/25) y override opcional por tasación.
-- Se almacenan como JSON: {"covered":1,"semi":0.75,"uncovered":0.25}.

ALTER TABLE organizations
  ADD COLUMN surface_weights TEXT DEFAULT '{"covered":1,"semi":0.75,"uncovered":0.25}';

ALTER TABLE appraisals
  ADD COLUMN surface_weights TEXT DEFAULT NULL;
