-- vendepro-backend/migrations_v2/049_landing_template_agent_profile.sql
-- Template de sistema "Perfil de agente": mini-página personal que un agente
-- inmobiliario usa para venderse (bio, credenciales, servicios, contacto
-- directo). org_id NULL = global, visible para todas las orgs.
--
-- El orden de bloques sale de analizar dos landings reales de la
-- inmobiliaria: hero con foto y propuesta de valor → credenciales y prueba
-- social → servicios → por qué elegirme → galería → FAQ → CTA de WhatsApp →
-- formulario → footer.
--
-- Los bloques agent-hero, agent-credentials, cta-whatsapp y footer llevan
-- binding='agent_profile': se autocompletan en la lectura pública con los
-- datos de agent_profiles (ver agent-bindings.ts). El photo_url del hero
-- lleva un placeholder válido a propósito: users.photo_url es nullable y el
-- binding solo lo pisa cuando el agente cargó una foto; sin eso, la landing
-- de un agente sin foto se rompería (Zod exige photo_url).
--
-- La consume create-landing-from-template.ts, que además hereda el kind
-- ('agent_profile') del template hacia la landing creada.
--
-- Idempotente: INSERT OR IGNORE con id fijo.

INSERT OR IGNORE INTO landing_templates
  (id, org_id, name, kind, description, preview_image_url, blocks_json, active, sort_order)
VALUES (
  'tpl_agent_profile_v1',
  NULL,
  'Perfil de agente',
  'agent_profile',
  'Mini-página personal del agente: bio, credenciales, servicios y contacto directo.',
  NULL,
  '[
  {"id":"b_hero","type":"agent-hero","visible":true,"binding":"agent_profile",
   "data":{"name":"Tu nombre","headline":"Asesor inmobiliario","bio":"Contá en dos o tres líneas quién sos y por qué alguien debería confiarte la venta de su propiedad.","photo_url":"https://placehold.co/600x600/ff007c/ffffff?text=Foto","ctas":[{"label":"Quiero vender","href":"#contacto","style":"primary"},{"label":"Escribime","href":"#whatsapp","style":"whatsapp"}],"accent_color":"pink"}},

  {"id":"b_cred","type":"agent-credentials","visible":true,"binding":"agent_profile",
   "data":{"title":"Credenciales","license":"","zones":[],"specialties":[],"stats":[]}},

  {"id":"b_serv","type":"features-grid","visible":true,
   "data":{"title":"Qué incluye trabajar conmigo","columns":3,"items":[
     {"icon":"camera","title":"Producción profesional","text":"Fotos, video y tour 360 de la propiedad."},
     {"icon":"megaphone","title":"Plan de difusión","text":"Portales, redes y base propia de compradores."},
     {"icon":"chart","title":"Reportes de avance","text":"Sabés siempre en qué estado está tu venta."}]}},

  {"id":"b_ben","type":"benefits-list","visible":true,
   "data":{"title":"Por qué elegirme","items":[
     {"title":"Precio con datos, no con intuición","description":"Tasación apoyada en comparables reales de la zona."},
     {"title":"Un solo interlocutor","description":"Me ocupo yo de punta a punta, sin cadenas de derivaciones."}]}},

  {"id":"b_gal","type":"gallery","visible":true,
   "data":{"layout":"grid","images":[{"url":"https://placehold.co/800x600?text=Trabajo+1","alt":"Trabajo 1","source":"upload"}]}},

  {"id":"b_faq","type":"faq","visible":true,
   "data":{"title":"Preguntas frecuentes","items":[
     {"question":"¿Cuánto tarda en venderse una propiedad?","answer":"Depende del precio de salida y de la zona. Con precio bien puesto, el grueso de las consultas llega en las primeras tres semanas."},
     {"question":"¿Qué gastos tengo que afrontar?","answer":"Te paso el detalle completo antes de firmar nada: honorarios, sellos y certificados."}]}},

  {"id":"b_wa","type":"cta-whatsapp","visible":true,"binding":"agent_profile",
   "data":{"title":"¿Hablamos?","subtitle":"Respondo personalmente.","phone":"+5491100000000","message_template":"Hola, vi tu página y quiero consultarte por una propiedad","button_label":"Escribime por WhatsApp"}},

  {"id":"b_form","type":"lead-form","visible":true,
   "data":{"title":"Dejame tus datos","subtitle":"Te contacto hoy mismo.","fields":[
     {"key":"name","label":"Nombre","required":true},
     {"key":"phone","label":"Teléfono","required":true},
     {"key":"message","label":"Contame brevemente","required":false}],
    "submit_label":"Enviar","success_message":"¡Gracias! Te contacto a la brevedad.","privacy_note":"Usamos tus datos solo para responderte."}},

  {"id":"b_footer","type":"footer","visible":true,"binding":"agent_profile",
   "data":{"agency_name":"","agency_registration":"","phone":"","instagram":""}}
]',
  1,
  10
);
