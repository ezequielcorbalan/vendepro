# Tasaciones — Sistema de Templates (estáticos/dinámicos) + Landing Pública + PDF

**Fecha:** 2026-04-23
**Autor:** Ezequiel Corbalán + Claude
**Estado:** Diseño aprobado, pendiente de plan de implementación

---

## 1. Problema y objetivos

El feature de tasaciones está a medio construir. Hoy existe:

- CRUD de tasaciones en `api-properties` con JSON ad-hoc (`proposal_json`, `market_situation_json`, `work_conditions_json`, `video_links_json`)
- Landing pública en `/t/[slug]` que renderiza esos JSON
- Bloques reutilizables en tabla `tasacion_template_blocks` (CRUD en `/configuracion/tasacion`)
- Editor largo de tasación (845 líneas) con secciones editables
- Un sistema paralelo muy completo de `landing_templates` con versioning, publish, AI editing y renderer de bloques

**Objetivo de este feature:** que las tasaciones se rendericen desde un **template seleccionable** (Casa, Depto, Terreno, Corporativo) que mezcla partes estáticas (config de la inmobiliaria) y dinámicas (datos de esta tasación), con el mismo render sirviendo a:

1. **Landing pública** — `/t/[slug]` — con contenido extra web-only (videos, galerías, CTAs)
2. **PDF imprimible** — generado vía Cloudflare Browser Rendering — sin los bloques web-only

El sistema debe cubrir las 14 páginas del PDF de referencia entregado (`MISTRAL, GABRIELA 3224 - tasacion.pdf`), con 5 categorías de datos según origen:

- `system` — fijo del template sistema (ej. ilustraciones, gráfico de embudo)
- `org-static` — config de la inmobiliaria, editable una vez (ej. textos "Propuesta comercial")
- `org-variable` — variables periódicas de la org (ej. "market.properties_on_sale" mensual, gráficos de escribanos anuales)
- `tasacion` — datos propios de esta tasación puntual (portada, FODA, comparables, precios)
- `default-override` — default del template, pisable por tasación (ej. honorarios 3% pero el agente pone 2% a un cliente)

El `binding_mode` es **configurable por bloque**: el admin puede cambiarlo si cambian las necesidades. No está hardcoded al tipo.

---

## 2. Decisiones de alto nivel

| Decisión | Elegido | Razón |
|---|---|---|
| Scope de templates | Sistema pre-armados (Casa / Depto / Terreno / Corporativo) + custom per-org con copy-on-write | Balance entre arranque rápido y flexibilidad |
| Modelo de páginas estáticas | Copy-on-write desde template del sistema | Un solo lugar para la data "por defecto", custom cuando hace falta |
| Web-only vs PDF | Tipos con default + override por bloque (flag `include_in_pdf`) | Simple UI, defaults razonables, escape por bloque |
| Datos periódicos | Variables en pantalla dedicada + imágenes dentro del bloque | Números cambian solos; imágenes cambian con el bloque |
| Binding mode por bloque | Configurable por el admin | Escalable ante cambios de necesidades |
| Generación PDF | Cloudflare Browser Rendering (binding `@cloudflare/puppeteer`) | Nativo al stack, reusa HTML del landing con CSS print |
| Arquitectura | Híbrida: appraisal entity intacta + `appraisal_templates` nueva + reuso de `<BlockRenderer />` de landings | Domain limpio (hexagonal), reuso del motor de bloques |
| Flujo edición | Wizard 4 pasos al crear, editor pantalla única con preview en vivo al editar | Guía a nuevos, directo a experimentados |
| Config templates | `/configuracion/tasacion/` — admin only, separado del flujo de tasación | Claridad de responsabilidades |
| Edición de bloques en tasación | Auto-override local (no afecta template) | Agente nunca "sale" de su tasación |
| Snapshot al crear + sync opcional | Snapshot del template al crear. Banner "actualización disponible" si cambia | Protege tasaciones en curso sin bloquear updates |
| Variables periódicas | Predefinidas (`market.*`, `notary.*`) + custom libres (`custom.*`) | Cubre hoy, escala mañana |
| PDF cache + TTL | Cache por `content_hash`. Archivo en R2 válido 30 días | Performance + costo |
| Quota PDF | 50 PDFs/mes por org. Cache hits no cuentan | Previene abuso, conservador para empezar |

---

## 3. Arquitectura

### 3.1 Vista general

```
Browser / Mobile
     │
     ▼
Next.js 15 (vendepro-frontend)
  ├── /(dashboard)/tasaciones/nueva          → wizard 4 pasos
  ├── /(dashboard)/tasaciones/[id]/editar    → editor split + preview
  ├── /(dashboard)/configuracion/tasacion/   → admin: templates + variables
  ├── /t/[slug]                              → landing pública (web + ?print=1)
  └── componentes:
       └── <TemplateRenderer blocks={} resolved={} mode="web|print" />
               └── <BlockRenderer block={} /> (catálogo de 16 tipos)
     │
     │ apiFetch()
     ▼
Cloudflare Workers (hexagonal: Hono routes → use cases → domain + ports → repos/services)
  ├── api-properties       → appraisals CRUD, PDF generation, public route publish
  ├── api-admin            → appraisal_templates CRUD, org_variables CRUD
  └── api-public           → GET /public/appraisal/:slug (render data)
     │
     ▼
Cloudflare D1 (vendepro-db)    Cloudflare R2 (reportes-mg-assets)
  ├── appraisals (extendida)    └── appraisals/pdfs/{org}/{id}/{hash}.pdf (TTL 30d)
  ├── appraisal_templates        └── appraisals/assets/{org}/{notary}/{year}.png
  ├── appraisal_comparables
  ├── org_variables
  └── appraisal_pdfs (tracking + cache)

Cloudflare Browser Rendering binding (c.env.BROWSER) en api-properties
```

### 3.2 Render pipeline (crítico)

Un solo render-tree sirve web y PDF. Cambia solo el CSS `@media print` + flag `mode`.

```
Input: appraisalId

1. Load appraisal + snapshot + overrides
2. Load org_variables referenciadas
3. Hidratación de cada block del snapshot:
   a. Start with block.data (del snapshot)
   b. Si binding_mode='org-variable': resolver referencias var_key → valor actual de org_variables (LIVE)
   c. Si binding_mode='tasacion': resolver source: 'appraisal.*' → valor del appraisal actual
   d. Si block.id está en block_overrides_json: shallow-merge sobre lo anterior
4. Filtrar bloques por mode:
   - mode='web': incluye todos
   - mode='print': excluye bloques con include_in_pdf=false
5. Render <TemplateRenderer> con los bloques hidratados
```

Para PDF: el URL interno `/t/{slug}?print=1&token={jwt}` entra al SSR con `data-force-print="true"` en `<body>` y aplica los mismos estilos `@media print`.

---

## 4. Modelo de datos

### 4.1 Tablas nuevas

```sql
-- Templates de tasación (sistema + custom por org)
CREATE TABLE appraisal_templates (
  id TEXT PRIMARY KEY,
  org_id TEXT,                    -- NULL = sistema (Casa/Depto/Terreno/Corporativo)
  kind TEXT NOT NULL,             -- 'casa' | 'depto' | 'terreno' | 'corporativo' | 'custom'
  name TEXT NOT NULL,
  description TEXT,
  preview_image_url TEXT,
  blocks_json TEXT NOT NULL,      -- array de TemplateBlock, ver shape §4.4
  is_system INTEGER DEFAULT 0,    -- 1 = read-only del sistema
  parent_template_id TEXT,        -- si es copy-on-write, apunta al template sistema origen
  active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_appraisal_templates_org ON appraisal_templates(org_id, active);

-- Variables globales por org (periódicas o custom)
CREATE TABLE org_variables (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  key TEXT NOT NULL,              -- 'market.properties_on_sale', 'custom.award_count'
  value TEXT NOT NULL,            -- siempre string, frontend castea por value_type
  value_type TEXT NOT NULL,       -- 'number' | 'percent' | 'text' | 'date' | 'image_url'
  label TEXT,                     -- display-name para admin: "Propiedades en venta"
  namespace TEXT NOT NULL,        -- 'market' | 'notary' | 'custom'
  is_system INTEGER DEFAULT 0,    -- 1 = predefinida (editable, no borrable)
  updated_at TEXT NOT NULL,
  UNIQUE(org_id, key)
);
CREATE INDEX idx_org_variables_org ON org_variables(org_id, namespace);

-- Tracking + cache de PDFs generados
CREATE TABLE appraisal_pdfs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  appraisal_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,     -- SHA256(snapshot + overrides + resolved_vars)
  r2_key TEXT NOT NULL,
  size_bytes INTEGER,
  generated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL        -- generated_at + 30 días
);
CREATE INDEX idx_pdfs_hash ON appraisal_pdfs(content_hash);
CREATE INDEX idx_pdfs_org_month ON appraisal_pdfs(org_id, generated_at);
CREATE INDEX idx_pdfs_appraisal ON appraisal_pdfs(appraisal_id);
```

### 4.2 Modificaciones a `appraisals`

```sql
ALTER TABLE appraisals ADD COLUMN template_id TEXT;               -- FK a appraisal_templates
ALTER TABLE appraisals ADD COLUMN template_snapshot_json TEXT;    -- snapshot del template al crear
ALTER TABLE appraisals ADD COLUMN template_synced_at TEXT;        -- última sincronización
ALTER TABLE appraisals ADD COLUMN block_overrides_json TEXT;      -- overrides del agente (key por block.id)
```

### 4.3 Campos a eliminar

**Fase 1 (inmediato, sin migración):**

- `appraisals.canva_design_id`
- `appraisals.canva_edit_url`
- `users.canva_template_id`
- `users.canva_report_template_id`

**Fase 2 (post-migración de datos existentes al nuevo modelo):**

- `appraisals.proposal_json` → reemplazado por bloque `proposal_commercial` del template
- `appraisals.market_situation_json` → reemplazado por bloque `market_stats` (binding `org-variable`)
- `appraisals.work_conditions_json` → reemplazado por bloque `work_conditions` (binding `default-override`)
- `appraisals.video_links_json` → reemplazado por bloque `video_gallery` (web-only)
- `appraisals.contact_name`, `contact_phone`, `contact_email` → leer desde `lead_id` → `contacts`

**Mantenidos:**

- `publication_analysis` (texto libre del agente, no forma parte de template)
- SWOT (`strengths`, `weaknesses`, `opportunities`, `threats`) — queryable
- Superficies (`covered_area`, `total_area`, `semi_area`, `weighted_area`) — queryable
- Precios (`suggested_price`, `test_price`, `expected_close_price`, `usd_per_m2`) — queryable
- Metadata (`neighborhood`, `city`, `property_type`, `property_address`, `agent_id`, `lead_id`, `status`, `public_slug`)

### 4.4 Shape de `TemplateBlock` (en `blocks_json`)

```typescript
type TemplateBlock = {
  id: string                    // uuid dentro del template
  type: BlockType               // uno de los 16 tipos
  binding_mode: BindingMode     // configurable (§5)
  include_in_pdf: boolean       // default por tipo; locked=true en web-only types
  sort_order: number
  data: BlockData               // shape según type, ver §5
}

type BindingMode = 'system' | 'org-static' | 'org-variable' | 'tasacion' | 'default-override'
```

### 4.5 Shape de `block_overrides_json` (en `appraisals`)

```typescript
type BlockOverrides = {
  [block_id: string]: Partial<BlockData>  // merge-on-top del snapshot
}
```

Los overrides son opcionales y partial. Al renderizar, se hace merge del override sobre la data hidratada.

---

## 5. Catálogo de tipos de bloques (16)

### 5.1 Estructurales — 7 bloques

| Type | Binding default | `include_in_pdf` | `data` shape |
|------|----------------|-----------------|-------------|
| `cover` | `tasacion` | locked ✅ | `{ title, subtitle, cover_image_url, agent_display: { name, phone, email, avatar_url } }` |
| `proposal_commercial` | `org-static` | editable ✅ | `{ title, subtitle, items: [{ icon, title, body }] }` |
| `services_grid` | `org-static` | editable ✅ | `{ title, services: [{ icon, label }], portals_logos: [url], badge_text }` |
| `market_stats` | `org-variable` | editable ✅ | `{ title, vars: ['market.properties_on_sale', 'market.properties_sold', 'market.conversion_rate', 'market.reference_period'] }` |
| `funnel_chart` | `system` | editable ✅ | `{ title, funnel: [{ label, value }], ranges: [{ label, from, to, color }] }` |
| `methodology` | `org-static` | editable ✅ | `{ title, body, image_url, highlight_text }` |
| `notary_charts` | `org-variable` | editable ✅ | `{ title, chart_1_var: 'notary.sales_chart', chart_2_var: 'notary.semester_chart' }` |

### 5.2 Dinámicos — 6 bloques

| Type | Binding default | `include_in_pdf` | `data` shape |
|------|----------------|-----------------|-------------|
| `property_data` | `tasacion` | locked ✅ | `{ title, source: 'appraisal.*' }` → resuelve address, superficies, tipología |
| `swot` | `tasacion` | locked ✅ | `{ title, source: 'appraisal.swot' }` |
| `zone_map` | `tasacion` | editable ✅ | `{ title, map_image_url, neighborhood_name, min_m2_price, avg_m2_price, median_m2_price, published_count }` |
| `comparables_list` | `tasacion` | editable ✅ | `{ title, source: 'appraisal.comparables', variant: 'published' \| 'reserved' }` |
| `price_projection` | `tasacion` | locked ✅ | `{ title, source: 'appraisal.prices' }` |
| `work_conditions` | `default-override` | editable ✅ | `{ title, honorarios_pct, exclusividad_dias, required_docs: [string], extras: [string], legal_text, signature_image_url }` |

### 5.3 Web-only — 4 bloques

| Type | Binding default | `include_in_pdf` | `data` shape |
|------|----------------|-----------------|-------------|
| `video_gallery` | `tasacion` | locked ❌ | `{ title, videos: [{ url, caption, provider: 'youtube' \| 'vimeo' \| 'r2' }] }` |
| `extra_media` | `tasacion` | locked ❌ | `{ title, media: [{ type: 'image' \| 'video', url, caption }] }` |
| `cta_whatsapp` | `org-static` | locked ❌ | `{ text, phone, pre_filled_message }` |
| `agent_contact_card` | `tasacion` | locked ❌ | `{ avatar_url, name, phone, email, whatsapp_link }` |

---

## 6. Flujo de usuario

### 6.1 Agente — Crear tasación (wizard 4 pasos)

Ruta: `/tasaciones/nueva`

1. **Elegir template**. Grid con todos los templates disponibles (sistema + custom de la org) y opción "Empezar de cero" (template vacío mínimo).
2. **Datos de la propiedad**. Address, neighborhood, city, property_type, superficies, lead asociado (select desde `/leads`).
3. **FODA + Precios + Comparables**. SWOT + `suggested_price`/`test_price`/`expected_close_price` + agregar comparables (reusa UI actual + auto-fetch zonaprop si hay URL).
4. **Revisar + publicar**. Preview completo + toggle "generar slug público" + "Guardar como borrador" o "Publicar".

Al crear, **snapshot del template** queda en `appraisals.template_snapshot_json`. Los bloques `org-static` y `org-variable` se auto-rellenan en preview; el agente solo interactúa con los `tasacion` y `default-override`.

### 6.2 Agente — Editar tasación (pantalla única con preview en vivo)

Ruta: `/tasaciones/[id]/editar`

**Desktop split 50/50:**

```
┌────────────────────────────┬─────────────────────────────┐
│  PANEL DE EDICIÓN (izq)    │  PREVIEW EN VIVO (der)      │
│                            │                             │
│  [Selector template ▼]     │  [Web ◉ | PDF ○]            │
│                            │  [⬇ bajar pdf] [🔗 copiar]  │
│  ─ Bloques ─               │  ─────────────────────      │
│  ▶ Portada (tasacion)      │  iframe a /t/[slug]?preview │
│  ▶ Propuesta (org-static)  │  &mode=web|print&token=X    │
│  ▼ Datos propiedad         │                             │
│     • Address: ...         │  Refresca al editar         │
│  ▼ FODA (expand)           │  (debounced 500ms)          │
│  ▶ Comparables (3)         │                             │
│  ▶ Condiciones (override)  │                             │
│                            │                             │
│  [💾 Autosave · ✓ guardado]│                             │
└────────────────────────────┴─────────────────────────────┘
```

**Mobile:** panel full-width, botón flotante "👁 Ver preview" que abre overlay con el iframe.

**Regla clave:** cualquier edición del agente a un bloque queda en `appraisals.block_overrides_json`. **No** afecta al template de la org. Si quiere modificar globalmente, va a `/configuracion/tasacion/templates/[id]`.

**Autosave:** 2 segundos de inactividad → PUT `/appraisals/:id` con `block_overrides_json`.

**Banner sync:** si `template.updated_at > appraisal.template_synced_at`, aparece banner "Hay una versión más nueva del template. [Actualizar]". Al actualizar: refresh del snapshot preservando overrides.

### 6.3 Admin — Configurar templates

Ruta: `/configuracion/tasacion/`

Home con 3 secciones:

- **Templates** → lista + CRUD (duplicar sistema, crear desde cero, archivar)
- **Variables de mercado** → formulario con namespaces `market`, `notary`, `custom`
- **Configuración general** → firma del titular, disclaimer legal de org

**Editor de template** (`/configuracion/tasacion/templates/[id]`): mismo split 50/50 que el editor de tasación, pero con dropdown de `binding_mode` y toggle de `include_in_pdf` visibles por bloque. Preview con datos mock de tasación de ejemplo.

**Warning en el editor:** "Cambios afectan a las tasaciones nuevas. Las existentes ven un banner con opción de actualizar."

### 6.4 Variables de mercado

Ruta: `/configuracion/tasacion/variables`

```
── market (actualizar mensual) ────────────────────────
  market.properties_on_sale   number     111294       [editar]
  market.properties_sold      number     7646         [editar]
  market.conversion_rate      percent    6.9          [editar]
  market.reference_period     text       "Dic 2025"   [editar]

── notary (actualizar anual) ──────────────────────────
  notary.sales_chart          image_url  [preview]    [reemplazar]
  notary.semester_chart       image_url  [preview]    [reemplazar]

── custom (creadas por la org) ────────────────────────
  custom.award_count          number     12           [editar] [🗑]
  + Nueva variable
```

**"+ Nueva variable":** modal con `key` (prefijo `custom.` forzado), `label`, `value_type` (dropdown), `value` inicial.

---

## 7. Generación de PDF

### 7.1 Endpoint

**API:** `api-properties`
**Ruta:** `POST /appraisals/:id/pdf`
**Auth:** agente dueño o admin

```typescript
app.post('/appraisals/:id/pdf', async (c) => {
  const useCase = new GenerateAppraisalPdfUseCase(
    new D1AppraisalRepository(c.env.DB),
    new D1AppraisalPdfRepository(c.env.DB),
    new D1OrgVariableRepository(c.env.DB),
    new CfBrowserRenderingService(c.env.BROWSER),
    new R2AssetStorage(c.env.R2)
  )
  const result = await useCase.execute({
    appraisalId: c.req.param('id'),
    orgId: c.get('orgId'),
    userId: c.get('userId'),
  })
  return c.json(result)  // { pdf_url, expires_at, from_cache }
})
```

### 7.2 Lógica del use case

```
1. Load appraisal + snapshot + overrides + referenced org variables
2. Compute content_hash = SHA256(snapshot + overrides + resolved_vars)
3. SELECT * FROM appraisal_pdfs WHERE content_hash = ? AND expires_at > now()
4. Si hay cache hit:
   - Generar signed URL de R2 (15 min validez)
   - Return { pdf_url, expires_at, from_cache: true }   ← NO cuenta contra quota
5. Si no hay cache:
   - Verificar quota: SELECT COUNT(*) FROM appraisal_pdfs WHERE org_id=? AND generated_at >= first-of-month
   - Si >= 50: throw QuotaExceededError
   - Generar publicSlug si falta
   - Crear render-access JWT (5 min validez) con { appraisalId, mode: 'print' } — token usado por el renderer headless para bypass del noindex
   - Call BrowserRendering.renderToPdf(url='https://vendepro.com.ar/t/{slug}?print=1&token={render_jwt}', {
       format: 'A4', margin: '12mm', printBackground: true,
       waitUntil: 'networkidle0', preferCSSPageSize: true
     })
   - Upload a R2 con key appraisals/pdfs/{orgId}/{appraisalId}/{hash}.pdf
   - INSERT INTO appraisal_pdfs (...)
   - Generar R2 signed URL (15 min validez) para que el agente descargue
   - Return { pdf_url, expires_at, from_cache: false }

Dos tokens distintos: el `render_jwt` (5 min) permite que el Browser Rendering acceda al HTML sin auth del user; la `signed URL` de R2 (15 min) permite que el cliente descargue el PDF. Ninguno se persiste.
```

### 7.3 CSS print

En `PublicAppraisalShell.tsx` o CSS global de `/t/[slug]`:

```css
@media print, [data-force-print="true"] * {
  [data-block-web-only="true"] { display: none !important; }
  [data-block] { page-break-inside: avoid; }
  [data-block-page-break="true"] { page-break-before: always; }
  .no-print, nav, header[role="banner"] { display: none !important; }
  body { font-size: 10pt; }
}
@page { size: A4; margin: 12mm; }
```

El parámetro `?print=1` en la URL aplica `data-force-print="true"` en `<body>` en SSR, habilitando la misma rama de estilos que `@media print`.

### 7.4 Binding CF

`api-properties/wrangler.jsonc`:

```jsonc
{ "browser": { "binding": "BROWSER" } }
```

Requiere activar **Browser Rendering** en el dashboard de Cloudflare para el worker `vendepro-api-properties`.

### 7.5 R2 lifecycle

Configurar regla en el bucket `reportes-mg-assets`:

```
prefix: appraisals/pdfs/
action: expire after 30 days
```

Limpieza automática; la tabla `appraisal_pdfs` se limpia con un cron que borra rows donde `expires_at < now()`.

---

## 8. Errores y validaciones

### 8.1 Errores previsibles

| Escenario | Respuesta |
|-----------|-----------|
| Quota mensual excedida | `429` + `{ used, limit: 50, reset_at: 'YYYY-MM-01' }` → UI: "Alcanzaste el límite de 50 PDFs este mes" |
| Browser Rendering timeout (>30s) | `503` → UI: "Tardó más de lo esperado, reintentá" |
| Cache hit | `200` inmediato con signed URL (sin contar quota) |
| Template sistema sin `active` | Tasaciones con snapshot siguen funcionando; no se puede "actualizar" |
| Variable referenciada no existe al renderizar | Placeholder visual `{{key}}` con estilo warning + log |
| Override con schema mismatch | Se descarta, render usa snapshot + log |
| Agente sin permiso | `403` |
| Slug colisión al publicar | Sufijo numérico (`-2`, `-3`) |
| Admin intenta eliminar template en uso | `400` + "Archivalo en vez de eliminarlo" |

### 8.2 Validaciones

**Cliente (wizard):** address requerido, `property_type` en enum, superficies > 0, precios > 0.

**Servidor (use cases):** org ownership del `template_id`, schema validation del `data` según type, keys de variables alfanumércios + puntos + underscores, superficies y precios positivos.

---

## 9. Testing

### 9.1 Unit tests — `core/tests/`

- `appraisal-template.test.ts` — validación de bloques en la entity
- `hydrate-template-blocks.test.ts` — resolver con todas las combinaciones de `binding_mode`
- `apply-block-overrides.test.ts` — merge snapshot + overrides sin perder datos
- `generate-appraisal-pdf.test.ts` — mock BrowserRenderingService + R2, verifica cache hit y quota
- `sync-template-snapshot.test.ts` — refresh preservando overrides
- `create-appraisal-from-template.test.ts` — snapshot inicial correcto
- `duplicate-template.test.ts` — copy-on-write desde sistema a custom

### 9.2 Integration tests — `infrastructure/tests/`

- `d1-appraisal-template-repository.test.ts` — CRUD + filtro por org + sistema vs custom
- `d1-org-variables-repository.test.ts` — CRUD + constraint UNIQUE(org_id, key) + namespaces
- `d1-appraisal-pdfs-repository.test.ts` — lookup por hash + contador mensual + cleanup expirados
- `d1-appraisal-repository.test.ts` (extender) — nuevos campos `template_id`, `template_snapshot_json`, etc.

### 9.3 Frontend tests

- `BlockRenderer.test.tsx` — un test por tipo (16 tipos) renderizando correctamente
- `TemplateRenderer.test.tsx` — orden correcto, filtrado print mode
- `AppraisalEditor.test.tsx` — preview refresh, autosave debounced, override local

### 9.4 E2E manual (checklist al cerrar)

- [ ] Admin crea template custom duplicando "Casa"
- [ ] Admin cambia `binding_mode` de un bloque `org-static` a `default-override`
- [ ] Admin actualiza `market.properties_on_sale`
- [ ] Agente crea tasación eligiendo el template custom
- [ ] Agente edita un bloque → se guarda como override local
- [ ] Preview en vivo refleja cambio
- [ ] Toggle PDF en preview oculta bloques web-only
- [ ] Descarga PDF → cache miss → quota mensual +1
- [ ] Descarga mismo PDF 5 min después → cache hit → quota NO se incrementa
- [ ] Admin cambia template → tasación ya creada muestra banner "Actualizar"
- [ ] Agente clickea "Actualizar" → snapshot refresca, overrides preservados
- [ ] Org llega a 50 PDFs → siguiente request devuelve 429 con fecha de reset
- [ ] Link público `/t/[slug]` muestra contenido correcto en web
- [ ] PDF descargado no contiene bloques web-only

---

## 10. Plan de migración

### 10.1 Datos existentes

1. **Migración 0xx_appraisal_templates_v1.sql:** crea `appraisal_templates`, `org_variables`, `appraisal_pdfs`; extiende `appraisals`.
2. **Seed templates del sistema:** script que inserta 4 templates base (Casa, Depto, Terreno, Corporativo) con `org_id = NULL`, `is_system = 1`. Los bloques se modelan replicando el PDF de referencia.
3. **Backfill de tasaciones existentes:** use case `MigrateLegacyAppraisalUseCase` que:
   - Detecta tasaciones con `proposal_json`/`market_situation_json`/`work_conditions_json` no nulos
   - Asigna `template_id` al sistema "Casa" (o detecta por `property_type`)
   - Convierte el contenido JSON a `block_overrides_json` con los block IDs correspondientes
   - Setea `template_snapshot_json` desde el template asignado
   - Al verificar éxito, cleanup de campos legacy (migración posterior)

### 10.2 Feature flag (opcional)

Flag `feature_appraisal_templates_v2` scope por org. Si está off, sigue el flujo actual (legacy JSON blocks). Se enciende por org una vez migrada. Una vez todas en v2, el flag se elimina y los campos legacy también. El mecanismo concreto (columna en tabla `organizations`, tabla `org_settings`, o KV) se decide al implementar.

---

## 11. Fuera de alcance (YAGNI)

Estos temas se consideraron y se dejan fuera. No se construyen ahora pero el modelo los permite como extensión:

- **AI editing de bloques** (como en `landings/edit-block-with-ai.ts`). Se suma cuando haya demanda real.
- **Versionado histórico de templates** (tabla `appraisal_template_versions`). El snapshot en tasación cubre el caso real.
- **Congelar una tasación** (impedir cualquier update futuro). Las tasaciones se pueden actualizar siempre; el PDF es el snapshot en papel.
- **Bloque `custom_html` escape hatch**. Si aparece un caso que no encaja, se suma un tipo de bloque nuevo bien pensado.
- **UI de drag-drop para que el agente agregue bloques a su tasación**. Hoy los bloques son fijos por template; el agente solo edita data.
- **Publish workflow con review** (como `landings`). Las tasaciones se publican directo.
- **Compartir templates entre orgs**. Un custom template de una org no es visible a otras.

---

## 12. Glosario

- **Template:** estructura de bloques ordenados (del sistema o custom de una org).
- **Bloque:** unidad de contenido con un `type`, `binding_mode`, flag `include_in_pdf`, y `data`.
- **Binding mode:** de dónde viene la data del bloque (`system` / `org-static` / `org-variable` / `tasacion` / `default-override`).
- **Snapshot:** copia del template almacenada en la tasación al momento de creación.
- **Override:** edición del agente en una tasación puntual. Guardada en `appraisals.block_overrides_json`.
- **Variable:** par clave/valor por org (periódicas como market stats, o custom de la org).
- **Cache hit:** un PDF solicitado cuyo `content_hash` ya existe en `appraisal_pdfs` con `expires_at > now()`.
- **Copy-on-write:** al editar un template del sistema, se clona automáticamente a `org_id` actual con `parent_template_id` apuntando al original.
