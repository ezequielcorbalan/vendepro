-- 011_landings_seed_templates.sql
-- Seeds 3 templates globales (org_id = NULL) para arrancar.

INSERT INTO landing_templates (id, org_id, name, kind, description, preview_image_url, blocks_json, active, sort_order) VALUES
('tpl_emprendimiento_premium', NULL, 'Emprendimiento Premium', 'property',
 'Landing rica para emprendimientos: hero con foto, amenities, gallery y formulario.',
 NULL,
 '{"blocks":[
   {"id":"b_hero","type":"hero","visible":true,"data":{"eyebrow":"Palermo Soho · CABA","title":"Viví en el corazón de Palermo","subtitle":"40 unidades · entrega 2027","cta":{"label":"Agendar visita","href":"#form"},"background_image_url":"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600","overlay_opacity":0.55}},
   {"id":"b_amenities","type":"amenities-chips","visible":true,"data":{"title":"Amenities","chips":[{"emoji":"🏊","label":"Piscina"},{"emoji":"🏋️","label":"Gym"},{"emoji":"💼","label":"Coworking"},{"emoji":"🌳","label":"Solarium"}]}},
   {"id":"b_gallery","type":"gallery","visible":true,"data":{"layout":"mosaic","images":[{"url":"https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200","alt":"Living","source":"external"}]}},
   {"id":"b_form","type":"lead-form","visible":true,"data":{"title":"Consultanos sin compromiso","subtitle":"Te contactamos en menos de 24 hs.","fields":[{"key":"name","label":"Nombre","required":true},{"key":"phone","label":"Teléfono","required":true}],"submit_label":"Quiero más info","success_message":"¡Gracias! Te contactamos en breve."}},
   {"id":"b_footer","type":"footer","visible":true,"data":{"agency_name":"Marcela Genta Operaciones Inmobiliarias","agency_registration":"Matr. 5123"}}
 ]}',
 1, 1),

('tpl_propiedad_clasica', NULL, 'Propiedad clásica', 'property',
 'Landing simple para una propiedad con hero split, beneficios y formulario.',
 NULL,
 '{"blocks":[
   {"id":"b_hero","type":"hero-split","visible":true,"data":{"title":"Departamento 3 amb · Recoleta","subtitle":"98 m² · cochera · amenities","cta":{"label":"Ver más","href":"#form"},"media_url":"https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200","media_side":"right","accent_color":"pink"}},
   {"id":"b_benefits","type":"benefits-list","visible":true,"data":{"title":"Por qué este depto","items":[{"title":"Ubicación prime","description":"A 2 cuadras del subte D."},{"title":"Cochera fija","description":"En subsuelo del edificio."},{"title":"Amenities completos","description":"Gym, SUM, laundry."}]}},
   {"id":"b_form","type":"lead-form","visible":true,"data":{"title":"Pedir más información","fields":[{"key":"name","label":"Nombre","required":true},{"key":"phone","label":"Teléfono","required":true},{"key":"email","label":"Email","required":false}],"submit_label":"Contactar","success_message":"Recibimos tu consulta. Te contactamos a la brevedad."}},
   {"id":"b_footer","type":"footer","visible":true,"data":{}}
 ]}',
 1, 2),

('tpl_captacion_rapida', NULL, 'Captación rápida', 'lead_capture',
 'Landing agresiva para captación: tasación gratis en 24 hs.',
 NULL,
 '{"blocks":[
   {"id":"b_hero","type":"hero-split","visible":true,"data":{"title":"¿Querés vender tu propiedad?","subtitle":"Te decimos cuánto vale en 24 hs. Sin compromiso, sin letras chicas.","cta":{"label":"Pedir tasación gratis","href":"#form"},"media_url":"https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=1200","media_side":"right","accent_color":"pink"}},
   {"id":"b_benefits","type":"benefits-list","visible":true,"data":{"items":[{"title":"Tasación en 24 hs","description":"Respuesta rápida de un experto."},{"title":"Sin compromiso","description":"No hace falta firmar nada."},{"title":"15+ años en Buenos Aires","description":"Conocemos el mercado local."}]}},
   {"id":"b_form","type":"lead-form","visible":true,"data":{"title":"Pedir tasación","fields":[{"key":"name","label":"Nombre","required":true},{"key":"phone","label":"Teléfono","required":true},{"key":"address","label":"Dirección de la propiedad","required":true}],"submit_label":"Pedir tasación","success_message":"Gracias. Un asesor te contacta en menos de 24 hs."}},
   {"id":"b_footer","type":"footer","visible":true,"data":{"disclaimer":"Los datos son tratados con confidencialidad."}}
 ]}',
 1, 3);
