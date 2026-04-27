-- 021_property_visit_forms_extend.sql
-- Suma 3 campos al cuestionario de visita para alinear con el form rediseñado:
--   - rating: 1..5 (puntuación general de la propiedad)
--   - source: cómo encontró la propiedad (argenprop, mercadolibre, zonaprop, instagram, recomendacion, otro)
--   - situation: situación actual del visitante (mudanza, primera_vivienda, inversion, downsizing, otro)
--
-- Los 3 son opcionales para no romper datos históricos.
-- buy_intention pasa a ser binario en la UI (compraria | no), pero el dominio
-- sigue aceptando 'tal_vez' por compatibilidad con respuestas viejas.

ALTER TABLE property_visit_forms ADD COLUMN rating INTEGER;
ALTER TABLE property_visit_forms ADD COLUMN source TEXT;
ALTER TABLE property_visit_forms ADD COLUMN situation TEXT;
