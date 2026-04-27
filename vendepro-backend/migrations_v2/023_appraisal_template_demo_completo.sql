-- Migration 023 — Seeds a demo "Tasación Completa" template (system, org_id NULL).
-- Contiene los 17 tipos de bloques con contenido realista listo para usar.
-- Pensado para que el usuario lo duplique y arranque editando, en lugar de armar uno desde cero.

INSERT OR IGNORE INTO appraisal_templates
  (id, org_id, kind, name, description, preview_image_url, blocks_json, is_system, parent_template_id, active, sort_order, created_at, updated_at)
VALUES (
  'sys-appraisal-demo-completo-v1', NULL, 'custom',
  'Demo — Tasación completa',
  'Template de referencia con los 17 bloques poblados. Duplicalo y editá lo que necesites.',
  NULL,
  '[
    {"id":"b-cover","type":"cover","binding_mode":"tasacion","include_in_pdf":true,"sort_order":0,"data":{"title":"¿Querés saber cuánto vale tu propiedad?","subtitle":"Una tasación profesional, basada en datos reales del mercado."}},

    {"id":"b-proposal","type":"proposal_commercial","binding_mode":"org-static","include_in_pdf":true,"sort_order":1,"data":{"title":"Propuesta comercial","subtitle":"Para vender al mejor valor posible, hoy hay que cumplir con estas 4 condiciones.","items":[{"icon":"target","title":"Seguimiento","body":"Contacto sistemático con potenciales compradores. Resolvemos dudas, miedos y objeciones."},{"icon":"star","title":"Destacarse","body":"Invertimos fuerte en marketing digital y posicionamiento, para mayor visibilidad."},{"icon":"clock","title":"Generar interés","body":"El miedo a perderse algo (FOMO) es una de las motivaciones de compra más fuertes."},{"icon":"chart","title":"Valor de mercado","body":"Salir al precio correcto multiplica las visitas y acelera la venta."}]}},

    {"id":"b-services","type":"services_grid","binding_mode":"org-static","include_in_pdf":true,"sort_order":2,"data":{"title":"¿Qué incluye nuestro servicio?","badge_text":"Anunciante Premier","services":[{"icon":"camera","label":"Fotografía profesional HDR"},{"icon":"chair","label":"Amoblamiento virtual"},{"icon":"360","label":"Tour virtual 360°"},{"icon":"video","label":"Videos profesionales"},{"icon":"ruler","label":"Planos profesionales"},{"icon":"drone","label":"Tomas con drone"},{"icon":"megaphone","label":"Pauta en redes sociales"},{"icon":"globe","label":"Publicación en portales premium"},{"icon":"file","label":"Asesoramiento legal y fiscal"}]}},

    {"id":"b-market","type":"market_stats","binding_mode":"org-variable","include_in_pdf":true,"sort_order":3,"data":{"title":"¿Cómo está el mercado hoy?","vars":["market.properties_on_sale","market.properties_sold","market.conversion_rate","market.reference_period"]}},

    {"id":"b-funnel","type":"funnel_chart","binding_mode":"system","include_in_pdf":true,"sort_order":4,"data":{"title":"¿Por qué importan las visualizaciones?","funnel":[{"label":"Clics diarios","value":22},{"label":"Consultas","value":30},{"label":"Visitas","value":15},{"label":"Propuestas","value":1}],"ranges":[{"label":"Zona de especulación","from":0,"to":10,"color":"#e17a2a"},{"label":"Zona de prueba","from":10,"to":30,"color":"#9ca3af"},{"label":"Zona de reserva","from":30,"to":999,"color":"#ff007c"}]}},

    {"id":"b-method","type":"methodology","binding_mode":"org-static","include_in_pdf":true,"sort_order":5,"data":{"title":"Nuestra metodología","body":"Mantenemos una cartera acotada de propiedades para poder analizar y medir el comportamiento de cada una. Cada 15 días entregamos al propietario un reporte con métricas reales: cuántas personas vieron el aviso, cuántas consultas llegaron, qué visitas se concretaron y qué feedback dejaron. Con esa información tomamos decisiones juntos para llegar a la venta lo más rápido y al mejor precio posible.","highlight_text":"100% métricas en cada publicación."}},

    {"id":"b-notary","type":"notary_charts","binding_mode":"org-variable","include_in_pdf":true,"sort_order":6,"data":{"title":"Datos del Colegio de Escribanos","chart_1_var":"notary.sales_chart","chart_2_var":"notary.semester_chart"}},

    {"id":"b-property","type":"property_data","binding_mode":"tasacion","include_in_pdf":true,"sort_order":7,"data":{"title":"Datos de la propiedad","source":"appraisal.*"}},

    {"id":"b-swot","type":"swot","binding_mode":"tasacion","include_in_pdf":true,"sort_order":8,"data":{"title":"Análisis FODA","source":"appraisal.swot"}},

    {"id":"b-zone","type":"zone_map","binding_mode":"tasacion","include_in_pdf":true,"sort_order":9,"data":{"title":"¿Qué está pasando en tu zona?"}},

    {"id":"b-comparables-pub","type":"comparables_list","binding_mode":"tasacion","include_in_pdf":true,"sort_order":10,"data":{"title":"Propiedades publicadas en la zona","source":"appraisal.comparables","variant":"published"}},

    {"id":"b-comparables-res","type":"comparables_list","binding_mode":"tasacion","include_in_pdf":true,"sort_order":11,"data":{"title":"Propiedades reservadas en la zona","source":"appraisal.comparables","variant":"reserved"}},

    {"id":"b-price","type":"price_projection","binding_mode":"tasacion","include_in_pdf":true,"sort_order":12,"data":{"title":"Tasación proyectada","source":"appraisal.prices"}},

    {"id":"b-conditions","type":"work_conditions","binding_mode":"default-override","include_in_pdf":true,"sort_order":13,"data":{"title":"Condiciones de trabajo","honorarios_pct":3,"exclusividad_dias":120,"required_docs":["Escritura","DNI de todos los propietarios","Últimas expensas","Boletas de ABL y AySA","Reglamento de Copropiedad","Plano de Subdivisión y Mensura"],"extras":["Certificado de libre deuda","Tasación fiscal"],"legal_text":"En caso de venta: 3% sobre el valor final. Si la propiedad no se vende, toda la inversión publicitaria corre por cuenta y riesgo de la inmobiliaria."}},

    {"id":"b-videos","type":"video_gallery","binding_mode":"tasacion","include_in_pdf":false,"sort_order":14,"data":{"title":"Videos de la propiedad","videos":[]}},

    {"id":"b-media","type":"extra_media","binding_mode":"tasacion","include_in_pdf":false,"sort_order":15,"data":{"title":"Material complementario","items":[]}},

    {"id":"b-cta","type":"cta_whatsapp","binding_mode":"org-static","include_in_pdf":false,"sort_order":16,"data":{"text":"¿Querés que avancemos con tu tasación?","phone":"+5491155555555","pre_filled_message":"Hola! Vi la tasación de mi propiedad y me gustaría coordinar una reunión."}},

    {"id":"b-agent","type":"agent_contact_card","binding_mode":"tasacion","include_in_pdf":false,"sort_order":17,"data":{}}
  ]',
  1, NULL, 1, 99, '2026-04-26T00:00:00Z', '2026-04-26T00:00:00Z'
);
