-- Template blocks for tasacion landing pages (per org)
CREATE TABLE IF NOT EXISTS tasacion_template_blocks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  block_type TEXT NOT NULL DEFAULT 'service' CHECK (block_type IN ('service', 'video', 'stats', 'text', 'custom')),
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  number_label TEXT,
  video_url TEXT,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  section TEXT NOT NULL DEFAULT 'commercial' CHECK (section IN ('commercial', 'conditions')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_template_blocks_org ON tasacion_template_blocks(org_id, section, sort_order);

-- Add accent color to organizations
ALTER TABLE organizations ADD COLUMN brand_accent_color TEXT DEFAULT '#ff8017';

-- Seed default blocks for org_mg
INSERT INTO tasacion_template_blocks (id, org_id, block_type, title, description, icon, number_label, sort_order, section) VALUES
('blk_video_comercial', 'org_mg', 'video', 'Nuestra propuesta comercial', 'Te mostramos cómo trabajamos para que tu propiedad se venda al mejor precio y en el menor tiempo posible.', 'Video', NULL, 1, 'commercial'),
('blk_foto_hdr', 'org_mg', 'service', 'Fotografía profesional HDR', 'Imágenes de alta definición que destacan cada ambiente de tu propiedad, capturando la mejor luz y los mejores ángulos para generar impacto visual inmediato.', 'Camera', '01', 2, 'commercial'),
('blk_video_pro', 'org_mg', 'service', 'Video profesional del inmueble', 'Producción audiovisual en formato vertical y horizontal, optimizada para redes sociales y portales inmobiliarios, que permite recorrer cada espacio.', 'Video', '02', 3, 'commercial'),
('blk_multiportal', 'org_mg', 'service', 'Distribución multi-portal', 'Publicación destacada en los principales portales: ZonaProp, MercadoLibre, Argenprop y más de 10 plataformas con máxima visibilidad y posicionamiento.', 'Globe', '03', 4, 'commercial'),
('blk_tour360', 'org_mg', 'service', 'Tour virtual 360°', 'Recorrido inmersivo disponible 24/7 que permite a los interesados visitar tu propiedad desde cualquier lugar, precalificando compradores antes de la visita presencial.', 'RotateCcw', '04', 5, 'commercial'),
('blk_planos', 'org_mg', 'service', 'Planos digitales de planta', 'Relevamiento profesional con medidas precisas de cada ambiente, presentado en formato digital que facilita la toma de decisiones del comprador.', 'Layout', '05', 6, 'commercial'),
('blk_staging', 'org_mg', 'service', 'Amoblamiento virtual (staging)', 'Transformamos espacios vacíos en ambientes atractivos y funcionales mediante staging digital, aumentando hasta 10x las consultas recibidas.', 'Sofa', '06', 7, 'commercial'),
('blk_embudo', 'org_mg', 'service', 'Seguimiento del embudo de ventas', 'Embudo comercial medible: vistas, consultas, visitas, propuestas. Cada etapa es monitoreada para optimizar la estrategia de venta en tiempo real.', 'BarChart3', '07', 8, 'commercial'),
('blk_reportes', 'org_mg', 'service', 'Reportes quincenales de gestión', 'Cada 15 días recibís un informe detallado con métricas de rendimiento: impresiones, consultas, visitas y comparación con el mercado.', 'FileBarChart', '08', 9, 'commercial'),
('blk_mercado', 'org_mg', 'stats', 'Situación del mercado', 'Datos actualizados del mercado inmobiliario para que tengas contexto sobre la oferta, demanda y ritmo de ventas en tu zona.', 'TrendingUp', NULL, 10, 'commercial'),
('blk_video_mercado', 'org_mg', 'video', 'Video: Situación del mercado', 'Análisis en video sobre la coyuntura actual del mercado inmobiliario y cómo impacta en la venta de tu propiedad.', 'Video', NULL, 11, 'commercial'),
('blk_condiciones', 'org_mg', 'text', 'Condiciones de trabajo', 'Autorización de exclusiva por 120 días.\n\nDocumentación necesaria: copia de escritura, DNI de titulares, expensas, ABL, agua, reglamento de copropiedad, poderes si aplica.\n\nPrevio a la publicación: fotos, video, tour 360°, plano, informe de dominio e inhibición.', 'FileText', NULL, 12, 'conditions');
