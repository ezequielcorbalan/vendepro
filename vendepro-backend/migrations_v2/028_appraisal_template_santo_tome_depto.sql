-- Migration 028 — Seeds an org-level appraisal template (org_mg) modeled on the
-- "Santo Tome 3309" PDF (depto 3 amb, Villa Urquiza, formato Marcela Genta).
--
-- Es un template de ORGANIZACIÓN (org_id='org_mg', is_system=0) => aparece con
-- badge "Organización" y botón "Editar" en Configuración · Tasaciones.
--
-- IMPORTANTE sobre el relleno:
--   - Los bloques estructurales (cover, proposal_commercial, services_grid,
--     market_stats, funnel_chart, methodology, notary_charts) y work_conditions
--     quedan PRE-RELLENADOS con el texto exacto del PDF.
--   - Los bloques con binding_mode "tasacion" (property_data, swot, zone_map,
--     comparables_list, price_projection) NO guardan datos en el template: se
--     completan automáticamente con los datos de cada tasación concreta
--     (m², FODA, comparables, precios). Acá sólo definimos su título y orden.

INSERT OR IGNORE INTO appraisal_templates
  (id, org_id, agent_id, kind, name, description, preview_image_url, blocks_json, is_system, parent_template_id, active, sort_order, created_at, updated_at)
VALUES (
  'tpl-mg-depto-santotome-v1', 'org_mg', NULL, 'depto',
  'Departamento — Santo Tomé 3309',
  'Template de tasación para departamentos (3 amb, Villa Urquiza), armado a partir del PDF Santo Tomé 3309. 14 bloques con el copy estándar de Marcela Genta ya cargado.',
  NULL,
  '[
    {"id":"b-cover","type":"cover","binding_mode":"tasacion","include_in_pdf":true,"sort_order":0,"data":{"title":"¿Querés saber cuánto vale tu propiedad?","subtitle":"Una tasación profesional, basada en datos reales del mercado."}},

    {"id":"b-proposal","type":"proposal_commercial","binding_mode":"org-static","include_in_pdf":true,"sort_order":1,"data":{"title":"Propuesta comercial","subtitle":"Para lograr VENDER al mejor valor, hoy hay que cumplir con estas 4 condiciones","items":[{"icon":"star","title":"DESTACARSE","body":"Invertir fuerte en la comercialización de la propiedad, para que tenga mayor visibilidad que el resto, y por ende aumente la probabilidad de venta y vender más caro."},{"icon":"chart","title":"VALOR DE MERCADO","body":"Salir a valor de mercado no sólo aumenta la posibilidad de vender, sino que también estaremos aprovechando el momento de ser la \"nueva del mercado\", momento en el cual el aviso recibe la mayor cantidad de vistas."},{"icon":"target","title":"SEGUIMIENTO","body":"Contacto sistemáticamente con los potenciales compradores. Resolver dudas, miedos, conflictos y objeciones."},{"icon":"clock","title":"FOMO","body":"El miedo a perderse algo es una de las motivaciones de compra más fuertes. Hay que generar urgencia para conseguir que el cliente no se lo piense mucho y decida pasar a la acción cuanto antes."}]}},

    {"id":"b-services","type":"services_grid","binding_mode":"org-static","include_in_pdf":true,"sort_order":2,"data":{"title":"¿Qué hacemos para vender al mejor valor posible en 4 meses?","badge_text":"Anunciante Premier en Zonaprop","services":[{"icon":"camera","label":"Fotografía profesional HDR"},{"icon":"chair","label":"Amoblamiento virtual"},{"icon":"360","label":"Video 360 de tu propiedad"},{"icon":"video","label":"Videos profesionales"},{"icon":"ruler","label":"Planos profesionales"}]}},

    {"id":"b-market","type":"market_stats","binding_mode":"org-variable","include_in_pdf":true,"sort_order":3,"data":{"title":"¿Cómo está el mercado hoy?","vars":["market.properties_on_sale","market.properties_sold","market.conversion_rate","market.reference_period"]}},

    {"id":"b-funnel","type":"funnel_chart","binding_mode":"system","include_in_pdf":true,"sort_order":4,"data":{"title":"¿Por qué las visualizaciones importan?","funnel":[{"label":"Clics diarios","value":22},{"label":"Consultas","value":30},{"label":"Visitas","value":15},{"label":"Propuestas","value":1}],"ranges":[{"label":"Zona de especulación","from":0,"to":10,"color":"#ff8017"},{"label":"Zona de prueba","from":10,"to":30,"color":"#9ca3af"},{"label":"Zona de reserva","from":30,"to":999,"color":"#ff007c"}]}},

    {"id":"b-method","type":"methodology","binding_mode":"org-static","include_in_pdf":true,"sort_order":5,"data":{"title":"Nuestra metodología","body":"Nos enfocamos en mantener una cartera de propiedades que nos permita realizar el análisis y la medición del comportamiento de cada comercialización. Presentamos un reporte quincenal con los resultados, para tomar decisiones junto al propietario y vender lo más rápido y al mejor precio posible.","highlight_text":"100% métricas en cada publicación."}},

    {"id":"b-notary","type":"notary_charts","binding_mode":"org-variable","include_in_pdf":true,"sort_order":6,"data":{"title":"¿Qué nos informa el Colegio de Escribanos?","chart_1_var":"notary.sales_chart","chart_2_var":"notary.semester_chart"}},

    {"id":"b-property","type":"property_data","binding_mode":"tasacion","include_in_pdf":true,"sort_order":7,"data":{"title":"¿Qué variables de mi propiedad influyen en la tasación?","source":"appraisal.*"}},

    {"id":"b-swot","type":"swot","binding_mode":"tasacion","include_in_pdf":true,"sort_order":8,"data":{"title":"FODA","source":"appraisal.swot"}},

    {"id":"b-zone","type":"zone_map","binding_mode":"tasacion","include_in_pdf":true,"sort_order":9,"data":{"title":"¿Qué está pasando en tu zona?"}},

    {"id":"b-comparables-pub","type":"comparables_list","binding_mode":"tasacion","include_in_pdf":true,"sort_order":10,"data":{"title":"Departamentos publicados en la zona","source":"appraisal.comparables","variant":"published"}},

    {"id":"b-comparables-res","type":"comparables_list","binding_mode":"tasacion","include_in_pdf":true,"sort_order":11,"data":{"title":"Departamentos vendidos en la zona","source":"appraisal.comparables","variant":"reserved"}},

    {"id":"b-price","type":"price_projection","binding_mode":"tasacion","include_in_pdf":true,"sort_order":12,"data":{"title":"Tasación proyectada","source":"appraisal.prices"}},

    {"id":"b-conditions","type":"work_conditions","binding_mode":"default-override","include_in_pdf":true,"sort_order":13,"data":{"title":"¿Cuáles son nuestras condiciones de trabajo?","honorarios_pct":3,"exclusividad_dias":120,"required_docs":["Escritura","DNIs de todos los propietarios","Últimas expensas","ABL y AySA","Reglamento de Copropiedad","Plano de Subdivisión y Mensura"],"extras":[],"legal_text":"En caso de venta: 3%. En caso de no venderse la propiedad, toda la inversión publicitaria corre a cuenta y riesgo de la inmobiliaria."}}
  ]',
  0, NULL, 1, 1, '2026-06-16T00:00:00Z', '2026-06-16T00:00:00Z'
);
