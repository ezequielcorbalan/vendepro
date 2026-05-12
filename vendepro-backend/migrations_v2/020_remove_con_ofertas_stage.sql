-- Remove "Con ofertas" stage from pipeline
-- Move any properties in con_ofertas back to publicada

UPDATE properties
SET commercial_stage = 'publicada',
    commercial_stage_id = (
      SELECT cs.id FROM commercial_stages cs
      WHERE cs.slug = 'publicada' AND cs.operation_type_id = properties.operation_type_id
    )
WHERE commercial_stage = 'con_ofertas';

DELETE FROM commercial_stages WHERE slug = 'con_ofertas';
