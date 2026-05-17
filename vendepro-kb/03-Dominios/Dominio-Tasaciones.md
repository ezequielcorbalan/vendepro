# 📐 Dominio: Tasaciones (Appraisals)

El producto estrella de VendéPro. Cada tasación es un documento técnico-comercial que se construye con **bloques estructurados** desde un **template** + variables de la org + datos de la propiedad.

## Pipeline funcional

```
crear tasación → llenar ficha (datos físicos) → cargar comparables (Zonaprop)
              → ajustar bloques → publicar (genera public_slug)
              → generar PDF (CF Browser Rendering) → enviar al cliente
```

## Entidades

### `Appraisal` — `domain/entities/appraisal.ts`
La tasación en sí. Conecta lead, propiedad analizada, template, comparables.

Campos clave:
- Identificación: `id`, `org_id`, `lead_id`, `agent_id`, `public_slug`
- Datos propiedad: `property_address`, `neighborhood`, `city`, `property_type`, `covered_area`, `total_area`, `semi_area`, `weighted_area`
- Análisis: `strengths`, `weaknesses`, `opportunities`, `threats` (SWOT), `publication_analysis`
- Precios: `suggested_price`, `test_price`, `expected_close_price`, `usd_per_m2`
- Contacto: `contact_name/phone/email`
- Bloques JSON: `proposal_json`, `market_situation_json`, `work_conditions_json`, `video_links_json`
- Template moderno: `template_id`, `template_snapshot_json`, `template_synced_at`, `block_overrides_json`
- Estado: `status` (draft|generated|sent)
- Legacy Canva (deprecated, pending DROP): `canva_design_id`, `canva_edit_url`

### `AppraisalTemplate` — `domain/entities/appraisal-template.ts`
Plantilla reutilizable por tipo (casa, depto, terreno, corp, custom). Org puede tener custom o usar sistema (`is_system=1`).

Operaciones: `isGlobal()`, `isSystem()`, `duplicateFor(orgId, newId, newName)` para copy-on-write.

Seeds: 4 system templates en migration `018_appraisal_templates_seed.sql`.

### `AppraisalComparable`
Comparables de Zonaprop dentro de una tasación: dirección, áreas, precio, días en mercado, vistas/día.

### `AppraisalPdf`
PDF cacheado por `content_hash` con `r2_key` + `expires_at`. Si una request pide PDF con hash idéntico, retorna el cacheado.

### `FichaTasacion` — `domain/entities/ficha-tasacion.ts`
Ficha completa y detallada que llena el agente en la visita: piso, ascensores, antigüedad, condición, ambientes con dimensiones, amenities, expensas, ABL, AySA, etc. (~40 campos).

Se vincula a Appraisal vía `appraisal_id` o vive independiente.

## Value objects

- `AppraisalBlockType` (`domain/value-objects/appraisal-block-type.ts`)
  - **Estructurales**: cover, proposal_commercial, services_grid, market_stats, funnel_chart, methodology, notary_charts
  - **Dinámicos**: property_data, swot, zone_map, comparables_list, price_projection, work_conditions
  - **Web-only**: video_gallery, extra_media, cta_whatsapp, agent_contact_card
- `AppraisalBindingMode` — `system | org-static | org-variable | tasacion | default-override`
- Schemas Zod por tipo en `domain/value-objects/appraisal-block-schemas.ts`

## Tablas D1

Ver [[DB-overview]]:
- `appraisals` (40+ columnas)
- `appraisal_comparables`
- `appraisal_templates` (sistema nuevo)
- `appraisal_pdfs` (cache)
- `tasacion_template_blocks` (legacy, plano)
- `fichas_tasacion`

## Use cases (en `appraisals/`)

- CRUD: `CreateAppraisal`, `GetAppraisals`, `GetAppraisalDetail`, `UpdateAppraisal`, `DeleteAppraisal`
- Comparables: `AddAppraisalComparable`, `RemoveAppraisalComparable`
- PDF: `GenerateAppraisalPdf` (usa CF Browser Rendering)
- Template binding (críticos):
  - `HydrateTemplateBlocks` — fusiona template snapshot + org variables + overrides + datos tasación
  - `SetBlockOverrides` — override puntual de un block en una tasación
  - `SyncTemplateSnapshot` — refresca el snapshot del template (si cambió la plantilla)
- Templates: `ListAppraisalTemplates`, `GetAppraisalTemplate`, `CreateAppraisalTemplate`, `UpdateAppraisalTemplate`, `DuplicateAppraisalTemplate`, `ArchiveAppraisalTemplate`

## Fichas use cases

- `CreateFicha`, `ListFichas`, `GetFicha`, `UpdateFicha`, `DeleteFicha`

## Endpoints

[[API-properties]]:
- `GET/POST/PUT/DELETE /appraisals`
- `POST /appraisals/publish`
- `POST /appraisals/comparables`, `DELETE /appraisals/comparables`
- `POST /appraisals/:id/sync-template`
- `PATCH /appraisals/:id/blocks/:block_id`
- `POST /appraisals/:id/pdf`
- `GET/POST /fichas`

[[API-admin]] (templates):
- `GET/POST/PUT /appraisal-templates`, `GET /:id`, `POST /:id/duplicate`, `DELETE /:id` (archive)

[[API-public]]:
- `GET /public/appraisal/:slug`
- `GET /public/pdf/:orgId/:appraisalId/:filename?token=...`

[[API-ai]]:
- (Edición de bloques de tasación pasa por landings actualmente, pero IA podría extenderse)

## Frontend

- `/tasaciones` — lista
- `/tasaciones/nueva`
- `/tasaciones/[id]` (preview)
- `/tasaciones/[id]/editar` — editor de bloques + variables + preview en vivo
- `/perfil/tasaciones`
- `/configuracion/tasacion` — gestión de templates de la org
- `/configuracion/tasacion/templates/[id]` — editor de template

Tasación pública: `/t/[slug]`.

Editor: ver [[Frontend-editor-tasaciones]] (estructura `components/tasaciones/{editor,renderer,admin,legacy,shared}`).

## Memoria operativa

Según memoria del proyecto: **creación de tasaciones es desktop-first**, **landing pública mobile-first** (contradice la regla genérica). Ver [[Reglas-criticas]].

## Relacionados

- [[Dominio-Leads]] — `appraisals.lead_id`
- [[Dominio-Propiedades]] — la tasación puede convertirse en captación
- [[Dominio-Usuarios-Org]] — `org_variables` se usan en templates
- [[Frontend-editor-tasaciones]]
