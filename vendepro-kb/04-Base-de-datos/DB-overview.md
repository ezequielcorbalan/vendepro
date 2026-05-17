# 💾 Base de datos D1 — `vendepro-db`

SQLite gestionado por Cloudflare D1. 51 tablas en 24 migrations (`migrations_v2/`).

- **ID D1**: `45d18f94-807b-466f-8742-32bbc61fc7fb`
- **Apply**: workflow `migrate.yml` automático al pushear `migrations_v2/**` a main
- ⚠️ NO renombrar. Ver [[Reglas-criticas]].

## Convenciones

- **IDs**: TEXT, generados con `crypto.randomBytes` (excepto catálogos AUTOINCREMENT)
- **Fechas**: TEXT ISO en UTC (`datetime('now')`)
- **Multi-tenancy**: toda tabla tiene `org_id` excepto catálogos
- **Booleans**: `INTEGER` (0|1)
- **Enums**: TEXT con CHECK o validación app-side
- **JSON**: TEXT (parsear en app)
- **D1 limitations**: no hay ENUM nativo; algunos DROP TABLE complicados → usar RENAME + ADD + DROP

## Tablas por dominio

### 🔐 Auth & Users (5 tablas) — [[Dominio-Usuarios-Org]]
- `organizations` — orgs multi-tenant (multi-tenant root)
- `users` — agentes y admins
- `roles` — catálogo (owner|admin|supervisor|agent)
- `password_reset_tokens` — TTL 1h
- `org_variables` — variables configurables por org (para templates de tasación)

### 👤 CRM — Leads & Contacts (5 tablas) — [[Dominio-Leads]] [[Dominio-Contactos]] [[Dominio-Tags]]
- `leads` (24 columnas, índices por stage + assigned + created)
- `contacts` (prefijo `ct_`)
- `tags`, `lead_tags` (M:N)
- `stage_history` (audit trail de transiciones)

### 📅 CRM — Actividades & Calendario (2 tablas) — [[Dominio-Actividades]] [[Dominio-Calendario]]
- `activities` — log append-only
- `calendar_events` — eventos con links a varias entidades

### 🏠 Properties & Catálogos (8 tablas) — [[Dominio-Propiedades]]
- `properties` (40+ columnas)
- `property_photos` (galería con R2 keys)
- `price_history` (legacy) + `property_price_history` (mig 013)
- `operation_types`, `commercial_stages`, `property_statuses` (catálogos normalizados, mig 005)
- `property_visit_forms` (ficha post-visita) — [[Dominio-Visit-forms]]
- `visit_forms`, `visit_form_responses` (formularios dinámicos)
- `competitor_links`

### 📐 Tasaciones & Prefactibilidades (7 tablas) — [[Dominio-Tasaciones]] [[Dominio-Prefactibilidades]]
- `appraisals`
- `appraisal_comparables`
- `appraisal_templates` (sistema nuevo, mig 017+018)
- `appraisal_pdfs` (cache de PDFs por content_hash)
- `fichas_tasacion` (~40 campos de inspección)
- `tasacion_template_blocks` (sistema legacy)
- `prefactibilidades` (~50 campos)

### 🎨 Landings (4 tablas) — [[Dominio-Landings]]
- `landing_templates` (con 3 seeds globales)
- `landings`
- `landing_versions` (audit + rollback)
- `landing_events` (pageview, cta_click, form_start, form_submit)

### 📣 Marketing (3 tablas) — [[Dominio-Marketing]]
- `meta_integration` (PK = org_id, 1 row por org)
- `stage_event_mappings`
- `meta_event_log` (provider: meta | ga4, status: pending | sent | failed)

### 📈 Reports (5 tablas) — [[Dominio-Reportes]]
- `reports`
- `report_metrics` (un row por fuente: zonaprop/argenprop/mercadolibre/manual)
- `report_content` (secciones de texto)
- `report_photos`
- `competitor_links` (también vinculado a properties)

### 💼 Reservas (1 tabla) — [[Dominio-Reservas]]
- `reservations`

### 🎯 Objetivos (1 tabla) — [[Dominio-Objetivos]]
- `agent_objectives`

### 🔔 Notificaciones (1 tabla) — [[Dominio-Notificaciones]]
- `notifications` (kind CHECK: lead_assigned|task_overdue|reservation_update|system)

## Migrations en orden

| # | Nombre | Resumen |
|---|---|---|
| 000 | initial | orgs, users, leads, contacts, properties, appraisals, fichas, prefact, reports, tags |
| 001 | appraisals_extra_cols | contact_name/phone/email, lead_id, public_slug |
| 002 | org_brand_accent_color | brand_accent_color |
| 002 | password_reset_tokens | tabla password_reset_tokens |
| 003 | leads_contact_id | contact_id + api_key + backfill contacts desde leads |
| 003 | appraisal_blocks | proposal_json + market_situation_json + work_conditions_json + video_links_json + unique slug |
| 004 | properties_add_columns | lead_id, operation_type, *_id, last_external_report_at |
| 005 | property_catalog_tables | operation_types + commercial_stages + property_statuses + backfill |
| 006 | reports_add_org_id | org_id en reports (multi-tenant scoping) |
| 007 | roles_and_notifications | roles + notifications |
| 008 | visit_forms | visit_forms + visit_form_responses |
| 009 | property_photos | formaliza property_photos |
| 010 | landings | landing_templates + landings + landing_versions + landing_events |
| 011 | landings_seed_templates | 3 templates globales |
| 012 | property_visit_forms | property_visit_forms |
| 013 | property_auth | auth_start_date + auth_duration_days + property_price_history |
| 014 | property_doc_status | doc_status_json |
| 015 | landing_templates | template_type en landings + template_landing_id en appraisals |
| 016 | marketing_meta | meta_integration + stage_event_mappings + meta_event_log |
| 017 | appraisal_templates_v1 | appraisal_templates + org_variables + appraisal_pdfs + cols en appraisals |
| 017 | marketing_ga4 | extiende meta_* con GA4 (provider, ga4 fields) |
| 018 | appraisal_templates_seed | 4 system templates (casa, depto, terreno, corp) |
| 018 | users_extend_roles | expande CHECK role (owner, admin, supervisor, agent) |
| 019 | reports_public_slug | public_slug en reports + unique index |
| 020 | reports_backfill_public_slug | backfill slugs |

> **Nota**: hay números duplicados (002, 003, 017, 018) por trabajo paralelo. El workflow `migrate.yml` aplica las que falten en orden alfabético.

## Casos especiales

- **Columnas legacy pendientes de DROP**: `users.canva_template_id`, `users.canva_report_template_id`, `appraisals.canva_design_id`, `appraisals.canva_edit_url`. Quedaron del sistema anterior.
- **Dos tablas de historial de precio**: `price_history` (mig 000) y `property_price_history` (mig 013). Las queries usan la segunda; la primera quedó por compatibilidad.
- **Dos sistemas de templates de tasación**: `tasacion_template_blocks` (plano, mig 000) y `appraisal_templates` (estructurado, mig 017). Tasaciones nuevas usan el segundo.
- **Dos sistemas de visit forms**: `visit_forms` (dinámico) y `property_visit_forms` (fijo). Conviven por casos de uso distintos.
- **Numeración duplicada** en migrations: workflow aplica orden alfabético, no conflictúa.
