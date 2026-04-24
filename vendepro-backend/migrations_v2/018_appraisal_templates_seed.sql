-- Migration 018 — Seeds 4 system appraisal templates.
-- Templates: casa, depto, terreno, corporativo (org_id NULL = sistema).

INSERT OR IGNORE INTO appraisal_templates
  (id, org_id, kind, name, description, preview_image_url, blocks_json, is_system, parent_template_id, active, sort_order, created_at, updated_at)
VALUES
(
  'sys-appraisal-casa-v1', NULL, 'casa', 'Casa — Estándar',
  'Template para tasaciones de casas. 14 bloques siguiendo el formato Marcela Genta.',
  NULL,
  '[
    {"id":"b-cover","type":"cover","binding_mode":"tasacion","include_in_pdf":true,"sort_order":0,"data":{"title":"¿Querés saber cuánto vale tu propiedad?"}},
    {"id":"b-proposal","type":"proposal_commercial","binding_mode":"org-static","include_in_pdf":true,"sort_order":1,"data":{"title":"Propuesta comercial","subtitle":"Para lograr VENDER al mejor valor, hoy hay que cumplir con estas 4 condiciones","items":[{"icon":"target","title":"SEGUIMIENTO","body":"Contacto sistemáticamente con potenciales compradores. Resolver dudas, miedos, conflictos y objeciones."},{"icon":"star","title":"DESTACARSE","body":"Invertir fuerte en la comercialización de la propiedad, para mayor visibilidad y mayor probabilidad de venta."},{"icon":"clock","title":"FOMO","body":"El miedo a perderse algo es una de las motivaciones de compra más fuertes."},{"icon":"chart","title":"VALOR DE MERCADO","body":"Salir a valor de mercado aumenta la posibilidad de vender y el aviso recibe más vistas."}]}},
    {"id":"b-services","type":"services_grid","binding_mode":"org-static","include_in_pdf":true,"sort_order":2,"data":{"title":"¿Qué hacemos para vender al mejor valor posible en 4 meses?","services":[{"icon":"camera","label":"Fotografía profesional HDR"},{"icon":"chair","label":"Amoblamiento virtual"},{"icon":"360","label":"Video 360"},{"icon":"video","label":"Videos profesionales"},{"icon":"ruler","label":"Planos profesionales"}],"badge_text":"Anunciante Premier en Zonaprop"}},
    {"id":"b-market","type":"market_stats","binding_mode":"org-variable","include_in_pdf":true,"sort_order":3,"data":{"title":"Datos del mercado","vars":["market.properties_on_sale","market.properties_sold","market.conversion_rate","market.reference_period"]}},
    {"id":"b-funnel","type":"funnel_chart","binding_mode":"system","include_in_pdf":true,"sort_order":4,"data":{"title":"¿Por qué las visualizaciones importan?","funnel":[{"label":"Clics diarios","value":22},{"label":"Consultas","value":30},{"label":"Visitas","value":15},{"label":"Propuestas","value":1}],"ranges":[{"label":"Zona de especulación","from":0,"to":10,"color":"#ff8017"},{"label":"Zona de prueba","from":10,"to":30,"color":"#9ca3af"},{"label":"Zona de reserva","from":30,"to":999,"color":"#ff007c"}]}},
    {"id":"b-method","type":"methodology","binding_mode":"org-static","include_in_pdf":true,"sort_order":5,"data":{"title":"Nuestra metodología","body":"Nos enfocamos en mantener una cartera de propiedades que permita analizar y medir el comportamiento de cada comercialización. Presentamos un reporte quincenal con los resultados, para tomar decisiones junto al propietario y vender lo más rápido y al mejor precio posible.","highlight_text":"100% métricas en cada publicación."}},
    {"id":"b-notary","type":"notary_charts","binding_mode":"org-variable","include_in_pdf":true,"sort_order":6,"data":{"title":"¿Qué nos informa el Colegio de Escribanos?","chart_1_var":"notary.sales_chart","chart_2_var":"notary.semester_chart"}},
    {"id":"b-property","type":"property_data","binding_mode":"tasacion","include_in_pdf":true,"sort_order":7,"data":{"title":"¿Qué variables de mi propiedad influyen en la tasación?","source":"appraisal.*"}},
    {"id":"b-swot","type":"swot","binding_mode":"tasacion","include_in_pdf":true,"sort_order":8,"data":{"title":"FODA","source":"appraisal.swot"}},
    {"id":"b-zone","type":"zone_map","binding_mode":"tasacion","include_in_pdf":true,"sort_order":9,"data":{"title":"¿Qué está pasando en tu zona?"}},
    {"id":"b-comparables-pub","type":"comparables_list","binding_mode":"tasacion","include_in_pdf":true,"sort_order":10,"data":{"title":"Casas publicadas en la zona","source":"appraisal.comparables","variant":"published"}},
    {"id":"b-comparables-res","type":"comparables_list","binding_mode":"tasacion","include_in_pdf":true,"sort_order":11,"data":{"title":"Casas reservadas en la zona","source":"appraisal.comparables","variant":"reserved"}},
    {"id":"b-price","type":"price_projection","binding_mode":"tasacion","include_in_pdf":true,"sort_order":12,"data":{"title":"Tasación proyectada","source":"appraisal.prices"}},
    {"id":"b-conditions","type":"work_conditions","binding_mode":"default-override","include_in_pdf":true,"sort_order":13,"data":{"title":"¿Cuáles son nuestras condiciones de trabajo?","honorarios_pct":3,"exclusividad_dias":120,"required_docs":["Escritura","DNIs de todos los propietarios","Últimas expensas","ABL y AySA","Reglamento de Copropiedad","Plano de Subdivisión y Mensura"],"extras":[],"legal_text":"En caso de venta: 3%. En caso de no venderse la propiedad, toda la inversión publicitaria corre a cuenta y riesgo de la inmobiliaria."}}
  ]',
  1, NULL, 1, 0, '2026-04-23T00:00:00Z', '2026-04-23T00:00:00Z'
);

INSERT OR IGNORE INTO appraisal_templates
  (id, org_id, kind, name, description, preview_image_url, blocks_json, is_system, parent_template_id, active, sort_order, created_at, updated_at)
SELECT 'sys-appraisal-depto-v1', NULL, 'depto', 'Departamento — Estándar',
  'Template para tasaciones de departamentos. Estructura base equivalente a Casa en v1.',
  NULL, blocks_json, 1, NULL, 1, 1, '2026-04-23T00:00:00Z', '2026-04-23T00:00:00Z'
FROM appraisal_templates WHERE id = 'sys-appraisal-casa-v1';

INSERT OR IGNORE INTO appraisal_templates
  (id, org_id, kind, name, description, preview_image_url, blocks_json, is_system, parent_template_id, active, sort_order, created_at, updated_at)
VALUES (
  'sys-appraisal-terreno-v1', NULL, 'terreno', 'Terreno — Estándar',
  'Template para tasaciones de terrenos. Sin bloques de amoblamiento virtual ni video 360.',
  NULL,
  '[
    {"id":"b-cover","type":"cover","binding_mode":"tasacion","include_in_pdf":true,"sort_order":0,"data":{"title":"¿Querés saber cuánto vale tu terreno?"}},
    {"id":"b-proposal","type":"proposal_commercial","binding_mode":"org-static","include_in_pdf":true,"sort_order":1,"data":{"title":"Propuesta comercial","items":[{"icon":"target","title":"SEGUIMIENTO","body":"Contacto con potenciales compradores."},{"icon":"star","title":"DESTACARSE","body":"Invertir fuerte en comercialización."},{"icon":"clock","title":"FOMO","body":"Generar urgencia en el cliente."},{"icon":"chart","title":"VALOR DE MERCADO","body":"Salir al precio correcto es clave."}]}},
    {"id":"b-services","type":"services_grid","binding_mode":"org-static","include_in_pdf":true,"sort_order":2,"data":{"title":"¿Qué hacemos?","services":[{"icon":"camera","label":"Fotografía profesional HDR"},{"icon":"ruler","label":"Planos profesionales"}]}},
    {"id":"b-market","type":"market_stats","binding_mode":"org-variable","include_in_pdf":true,"sort_order":3,"data":{"title":"Datos del mercado","vars":["market.properties_on_sale","market.properties_sold","market.reference_period"]}},
    {"id":"b-method","type":"methodology","binding_mode":"org-static","include_in_pdf":true,"sort_order":4,"data":{"title":"Nuestra metodología","body":"Nos enfocamos en medir cada publicación."}},
    {"id":"b-property","type":"property_data","binding_mode":"tasacion","include_in_pdf":true,"sort_order":5,"data":{"title":"Variables del terreno","source":"appraisal.*"}},
    {"id":"b-swot","type":"swot","binding_mode":"tasacion","include_in_pdf":true,"sort_order":6,"data":{"title":"FODA","source":"appraisal.swot"}},
    {"id":"b-zone","type":"zone_map","binding_mode":"tasacion","include_in_pdf":true,"sort_order":7,"data":{"title":"¿Qué está pasando en tu zona?"}},
    {"id":"b-comparables-pub","type":"comparables_list","binding_mode":"tasacion","include_in_pdf":true,"sort_order":8,"data":{"title":"Terrenos publicados en la zona","source":"appraisal.comparables","variant":"published"}},
    {"id":"b-price","type":"price_projection","binding_mode":"tasacion","include_in_pdf":true,"sort_order":9,"data":{"title":"Tasación proyectada","source":"appraisal.prices"}},
    {"id":"b-conditions","type":"work_conditions","binding_mode":"default-override","include_in_pdf":true,"sort_order":10,"data":{"title":"Condiciones de trabajo","honorarios_pct":3,"exclusividad_dias":120,"required_docs":["Escritura","DNI propietario","Plano de Mensura"]}}
  ]',
  1, NULL, 1, 2, '2026-04-23T00:00:00Z', '2026-04-23T00:00:00Z'
);

INSERT OR IGNORE INTO appraisal_templates
  (id, org_id, kind, name, description, preview_image_url, blocks_json, is_system, parent_template_id, active, sort_order, created_at, updated_at)
VALUES (
  'sys-appraisal-corp-v1', NULL, 'corporativo', 'Corporativo — Reducido',
  'Template conciso para locales comerciales / oficinas.',
  NULL,
  '[
    {"id":"b-cover","type":"cover","binding_mode":"tasacion","include_in_pdf":true,"sort_order":0,"data":{"title":"Tasación comercial"}},
    {"id":"b-services","type":"services_grid","binding_mode":"org-static","include_in_pdf":true,"sort_order":1,"data":{"title":"¿Qué hacemos?","services":[{"icon":"camera","label":"Fotografía HDR"},{"icon":"ruler","label":"Planos profesionales"}]}},
    {"id":"b-property","type":"property_data","binding_mode":"tasacion","include_in_pdf":true,"sort_order":2,"data":{"title":"Variables del inmueble","source":"appraisal.*"}},
    {"id":"b-price","type":"price_projection","binding_mode":"tasacion","include_in_pdf":true,"sort_order":3,"data":{"title":"Tasación proyectada","source":"appraisal.prices"}},
    {"id":"b-conditions","type":"work_conditions","binding_mode":"default-override","include_in_pdf":true,"sort_order":4,"data":{"title":"Condiciones de trabajo","honorarios_pct":3,"exclusividad_dias":120,"required_docs":["Escritura","DNI representante legal"]}}
  ]',
  1, NULL, 1, 3, '2026-04-23T00:00:00Z', '2026-04-23T00:00:00Z'
);
