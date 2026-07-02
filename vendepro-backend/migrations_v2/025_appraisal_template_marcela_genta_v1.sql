-- Migration 025 — Seed template "Marcela Genta — Plan de Marketing v1"
-- Basado en la propuesta comercial que usa hoy la inmobiliaria (Gastón Corbalan).
-- 12 bloques, orden y contenido replicando la captura de referencia.
-- is_system=1, org_id NULL → visible para todas las orgs, se duplica para editar.

INSERT OR IGNORE INTO appraisal_templates
  (id, org_id, kind, name, description, preview_image_url, blocks_json, is_system, parent_template_id, active, sort_order, created_at, updated_at)
VALUES (
  'sys-appraisal-marcela-genta-v1', NULL, 'custom',
  'Marcela Genta — Plan de Marketing',
  'Plantilla completa con el plan de marketing de Marcela Genta: propuesta comercial de 8 puntos, embudo de venta, metodología, comparables y ficha del asesor.',
  NULL,
  '[
    {"id":"b-cover","type":"cover","binding_mode":"tasacion","include_in_pdf":true,"sort_order":0,"data":{"title":"","subtitle":""}},

    {"id":"b-proposal","type":"proposal_commercial","binding_mode":"org-static","include_in_pdf":true,"sort_order":1,"data":{"title":"Plan de Marketing Personalizado","subtitle":"Cada propiedad recibe una estrategia completa para maximizar su visibilidad y atraer compradores calificados.","show_agent_signature":true,"items":[
      {"icon":"camera","title":"Fotografía HDR","body":"Imágenes de alta definición que destacan cada ambiente y captan la atención al instante."},
      {"icon":"video","title":"Video profesional","body":"Producción audiovisual en formato vertical y horizontal, lista para redes y portales."},
      {"icon":"ruler","title":"Plano digital","body":"Relevamiento profesional con un arquitecto para generar planos precisos de cada ambiente."},
      {"icon":"360","title":"Tour virtual 360°","body":"Recorrido inmersivo disponible 24/7 que permite visitar cada rincón sin moverse de casa."},
      {"icon":"chair","title":"Amoblamiento virtual","body":"Home staging digital que multiplica las consultas x10."},
      {"icon":"megaphone","title":"Publicación","body":"Super destacado en ZonaProp, MercadoLibre, Argenprop."},
      {"icon":"share","title":"Redes Sociales","body":"Video personalizado para Tiktok e Instagram."},
      {"icon":"file","title":"Folletería","body":"Folletería personalizada de la Propiedad."}
    ]}},

    {"id":"b-funnel","type":"funnel_chart","binding_mode":"org-static","include_in_pdf":true,"sort_order":2,"data":{"title":"¿Por qué las visualizaciones en los portales importan?","funnel":[
      {"label":"Clics mensuales","value":660,"color":"#ff007c"},
      {"label":"Consultas","value":30,"color":"#ff8017"},
      {"label":"Visitas Presenciales","value":15,"color":"#c6f048"},
      {"label":"Ofertas","value":1,"color":"#22c55e"}
    ]}},

    {"id":"b-method","type":"methodology","binding_mode":"tasacion","include_in_pdf":true,"sort_order":3,"data":{"title":"Metodología de trabajo","body":"Presentamos un reporte quincenal con los resultados, para tomar decisiones junto al propietario y vender lo más rápido y al mejor precio posible.","highlight_text":""}},

    {"id":"b-videos","type":"video_gallery","binding_mode":"org-static","include_in_pdf":false,"sort_order":4,"data":{"title":"Videos","videos":[
      {"url":"https://www.youtube.com/watch?v=QXsCXVp8A-Y","provider":"youtube","caption":""}
    ]}},

    {"id":"b-property","type":"property_data","binding_mode":"tasacion","include_in_pdf":true,"sort_order":5,"data":{"title":"Datos de la propiedad","source":"appraisal.*"}},

    {"id":"b-swot","type":"swot","binding_mode":"tasacion","include_in_pdf":true,"sort_order":6,"data":{"title":"FODA","source":"appraisal.swot"}},

    {"id":"b-zone","type":"zone_map","binding_mode":"tasacion","include_in_pdf":true,"sort_order":7,"data":{"title":"¿QUÉ ESTÁ PASANDO EN TU ZONA?"}},

    {"id":"b-comparables","type":"comparables_list","binding_mode":"tasacion","include_in_pdf":true,"sort_order":8,"data":{"title":"Propiedades comparables","source":"appraisal.comparables","variant":"published"}},

    {"id":"b-price","type":"price_projection","binding_mode":"tasacion","include_in_pdf":true,"sort_order":9,"data":{"title":"Proyección de precios","source":"appraisal.prices"}},

    {"id":"b-conditions","type":"work_conditions","binding_mode":"tasacion","include_in_pdf":true,"sort_order":10,"data":{"title":"Condiciones de trabajo","honorarios_pct":3,"exclusividad_dias":120,"required_docs":["Escritura","DNIs de todos los propietarios","Últimas expensas","ABL y AySA","Reglamento de Copropiedad","Plano de Subdivisión y Mensura","Estado Parcelario"],"extras":[],"legal_text":"Requerimos fotocopias de: Escritura | DNIs de todos los propietarios | Últimas expensas ABL y AySA | Reglamento de Copropiedad Plano de Subdivisión y Mensura | ESTADO PARCELARIO"}},

    {"id":"b-agent","type":"agent_contact_card","binding_mode":"org-static","include_in_pdf":false,"sort_order":11,"data":{"name":"Gastón Corbalan","title":"Contactame","phone":"+5401158574005","email":"gastoncorbalan@deinmobiliarios.com"}}
  ]',
  1, NULL, 1, 5, '2026-04-27T00:00:00Z', '2026-04-27T00:00:00Z'
);
