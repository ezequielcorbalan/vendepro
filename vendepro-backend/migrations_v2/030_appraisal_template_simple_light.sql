-- Migration 030 — Seeds 1 system appraisal template "Light".
--
-- Template simple (org_id NULL = sistema, is_system=1) pensado para los casos
-- en que al asesor le cuesta armar las imágenes de portada. La portada NO carga
-- cover_image_url: el bloque cover cae automáticamente al degradado de marca
-- (logo + título + dirección + ficha del asesor), sin pedir ninguna imagen.
--
-- 5 bloques enfocados en el precio:
--   cover (sin foto) → property_data → comparables_list → price_projection → work_conditions
--
-- Los bloques con binding_mode "tasacion" (property_data, comparables_list,
-- price_projection) NO guardan datos en el template: se completan con los datos
-- de cada tasación concreta. Acá sólo definimos título y orden.

INSERT OR IGNORE INTO appraisal_templates
  (id, org_id, agent_id, kind, name, description, preview_image_url, blocks_json, is_system, parent_template_id, active, sort_order, created_at, updated_at)
VALUES (
  'sys-appraisal-light-v1', NULL, NULL, 'custom',
  'Light',
  'Tasación simple sin imágenes de portada. Ideal cuando no se tienen fotos: la portada usa el degradado de marca. 5 bloques enfocados en el precio.',
  NULL,
  '[
    {"id":"b-cover","type":"cover","binding_mode":"tasacion","include_in_pdf":true,"sort_order":0,"data":{"title":"¿Querés saber cuánto vale tu propiedad?"}},
    {"id":"b-property","type":"property_data","binding_mode":"tasacion","include_in_pdf":true,"sort_order":1,"data":{"title":"¿Qué variables de mi propiedad influyen en la tasación?","source":"appraisal.*"}},
    {"id":"b-comparables-pub","type":"comparables_list","binding_mode":"tasacion","include_in_pdf":true,"sort_order":2,"data":{"title":"Propiedades publicadas en la zona","source":"appraisal.comparables","variant":"published"}},
    {"id":"b-price","type":"price_projection","binding_mode":"tasacion","include_in_pdf":true,"sort_order":3,"data":{"title":"Tasación proyectada","source":"appraisal.prices"}},
    {"id":"b-conditions","type":"work_conditions","binding_mode":"default-override","include_in_pdf":true,"sort_order":4,"data":{"title":"¿Cuáles son nuestras condiciones de trabajo?","honorarios_pct":3,"exclusividad_dias":120,"required_docs":["Escritura","DNIs de todos los propietarios","Últimas expensas","ABL y AySA","Reglamento de Copropiedad","Plano de Subdivisión y Mensura"],"extras":[],"legal_text":"En caso de venta: 3%. En caso de no venderse la propiedad, toda la inversión publicitaria corre a cuenta y riesgo de la inmobiliaria."}}
  ]',
  1, NULL, 1, 4, '2026-06-22T00:00:00Z', '2026-06-22T00:00:00Z'
);
