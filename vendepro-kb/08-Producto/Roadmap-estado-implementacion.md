# 📊 Roadmap — estado de implementación en el código

> Análisis del código real (2026-08-29) cruzado contra [[Roadmap-producto]]. Rutas relativas a la raíz del repo (`vendepro-backend/`, `vendepro-frontend/`).
> **Escala de instancia**: 🟢 en producción · 🟡 parcial · 🟠 solo base (tablas/piezas sueltas, sin flujo) · 🔴 no existe.

## Vista rápida

| Feature | Instancia | Resumen en una línea |
|---|---|---|
| 00a · CRM operacional | 🟢 | Leads, contactos, calendario, actividades, tags, objetivos en producción. Notificaciones y detalle de prefactibilidad rotos. |
| 00b · Meta CAPI + GA4 (Stape) | 🟡 | Enviando eventos en producción; custom_data pobre, retry muerto, UTM incompleta, bug org/agente. |
| 00c · Tasaciones + cierres manuales | 🟢 | Sistema completo con PDF; faltan pulidos (agente en página pública, thumbnails, lightbox). |
| 01 · Dashboard atribución + creativos | 🟡 | Campañas Meta live con CPL y match a leads; creativos y tablas `ad_*` no existen. |
| 02 · UTM multi-touch | 🟠 | Solo `landing_events` + cookie visitor; sin `lead_touches`, la UTM se pierde al crear el lead. |
| 03 · Reportes mensuales por mail | 🔴 | Nada. El stack de PDF (tasaciones) y el template de email son reusables. |
| 04 · Conversiones custom Google Ads | 🔴 | Cero código Google Ads; `stage_event_mappings` no es multi-provider. |
| 05 · CAPI depurado + Tokko | 🟡 | `leads.pipeline` vendedor/comprador existe (manual); sin clasificador, sin `lead_sources`, sin Tokko. KiteProp sí está en producción. |
| 06 · Red compartida de cierres | 🟠 | `sold_properties.shared_with_network` existe pero es un flag muerto: sin UI, sin query cross-org, sin karma. |
| 07 · Landings por agente | 🔴 | No existe el kind `agent_profile`; el stack de landings donde apoyarse está 🟢. |
| 08 · Landings por propiedad | 🔴 | El kind `property` es solo un estilo; `landings` no tiene `property_id`, sin UTM builder ni QR. |
| 09 · Automatizaciones de email | 🟡 | Motor v2 en producción (bienvenida y nurture andan); **follow-up por inactividad no corre** — falta el barrido cron. |
| 10 · Agente conversacional IA | 🔴 | Cero código de WhatsApp/IG/Messenger, sin tablas conversations/messages. |
| 11 · Asistente IA interno | 🟠 | IA de extracción/generación 🟢, pero no hay chat, ni `ai_conversations`, ni function calling. |
| 12 · Marketplace de servicios | 🔴 | Nada. |
| 13 · Academia | 🔴 | Nada. |
| — · Planes y billing (pregunta 1) | 🟡 | Gating `plan`+`modules` con UI completa; **solo frontend**, sin enforcement en API y sin cobro (MP/Stripe: 0). |
| — · Feed XML portales | 🟡 | Backend sirve XML real; sin UI, opt-in solo por SQL, tags sin validar contra spec Navent. |

---

## 00 · Base

### 00a — CRM operacional 🟢

Todo el núcleo está en producción con backend + UI:

- **Leads**: 6 use cases (`core/src/application/use-cases/leads/`), etapas (`LEAD_STAGES` 10 etapas + `TAG_PIPELINES` en `core/src/shared/crm-config.ts`), historial en `stage_history`, pipelines separados vendedor/comprador (`leads.pipeline`, migración 039).
- **Contactos, calendario, actividades, tags, objetivos, visit forms**: en producción (`api-crm`, `api-properties`, `api-admin`).
- **Google Calendar** 🟢: espejo unidireccional VendéPro→Google + lectura solo-visualización (`use-cases/integrations/`, `api-crm/src/index.ts:725-900`). Pendiente operativo: secrets `GOOGLE_CLIENT_ID/SECRET` y publicar el consent screen.
- **KiteProp** 🟢: sync manual + cron `*/15` + backfill + enrich + mapeo de agentes + UI (`configuracion/conexiones`). Habla MCP JSON-RPC (`infrastructure/src/services/kiteprop-mcp-client.ts`).

**Bugs encontrados en el análisis** (deuda del CRM base):
1. 🐛 **NotificationBell nunca muestra nada** — `vendepro-frontend/src/components/layout/NotificationBell.tsx:24` llama `apiFetch('crm', '/notifications')` pero el endpoint vive en **api-admin** (`api-admin/src/index.ts:251`), y además espera `{notifications}` cuando el backend devuelve un array plano. Doble desalineación, `.catch` silencioso → campana siempre vacía.
2. 🐛 **Detalle de prefactibilidad → 404** — `prefactibilidades/page.tsx:77` linkea a `/prefactibilidades/${id}` pero no existe `[id]/page.tsx` (el backend sí tiene `GET /prefactibilidades/:id`).
3. 🐛 **Endpoints IA fantasma** — `propiedades/[id]/reportes/nuevo/page.tsx:131,188` llama `POST ai /extract-kiteprop` y `/extract-zonaprop`, que no existen en `api-ai`. Botones que siempre fallan.
4. 🐛 **Actividades salta la capa de aplicación** — `api-crm:1025-1062` va directo a `D1ActivityRepository` sin use cases (funciona, pero rompe el patrón hexagonal).

### 00b — Meta CAPI + GA4 server-side (Stape) 🟡

**Lo que anda** (en producción):
- Use case central `core/src/application/use-cases/marketing/send-marketing-event.ts` (383 líneas) + ports/adapters Meta CAPI y GA4 MP + `fireMarketingEvent` fire-and-forget (`infrastructure/src/services/marketing-sender-factory.ts:43`).
- Dedup correcto: `event_id = sha256(orgId:entityType:entityId:eventKey:YYYYMMDD)` compartido con el Pixel vía dataLayer (`vendepro-frontend/src/components/marketing/dataLayer.ts:42`); Stape como override de endpoint en ambos providers.
- 8 hooks vivos: lead_created, stage del lead, appraisal_created, reservation_created/stage, visit_form, ficha pública, landing lead/pageview.
- Config **por agente** desde la migración 040 (la PK de `meta_integration` pasó de `org_id` a `agent_id`).
- UI completa en `configuracion/marketing/page.tsx` (tabs config/mappings/log/email).

**La deuda que el roadmap llama "requiere pulir"** (confirmada en código):
1. `custom_data` hardcodeado: `currency: 'USD'` fijo, sin `content_type/content_ids` ni datos de propiedad (`send-marketing-event.ts:173-180`).
2. `source` es un literal por call-site (`'ficha_web'`, `'integration_api'`, `'public_api'` en `api-public/src/index.ts:311-508`), **no** el portal real (`leads.source` nunca llega a custom_data).
3. UTM solo en 2 de 10 call-sites, y **nunca** `utm_content`/`utm_term`.
4. `ga4ClientId` sintético cuando no hay visitor_id → rompe la sesión GA4 (`send-marketing-event.ts:220`).
5. Mappings default viven solo en el frontend (`configuracion/marketing/page.tsx:64-69`); sin seed en DB → eventos `noop`.
6. `RetryFailedMetaEventsUseCase` es **código muerto**: existe con tests pero nadie lo invoca (ni endpoint ni cron).
7. 🐛 Bug residual de la migración 040: `api-analytics/src/index.ts:254` sigue consultando `meta_integration WHERE org_id = ?` (PK ahora es `agent_id`) → el badge "Meta activo" del dashboard puede mostrar la config de otro agente.

### 00c — Tasaciones + landings públicas + carga manual de cierres 🟢

- **Tasaciones**: sistema completo — 17 tipos de bloque de template + 7 libres (24 renderizables, Zod en `appraisal-block-schemas.ts`), 4 templates de sistema seedeados, wizard 6 pasos, editor WYSIWYG con autosave, página pública `/t/[slug]`, **PDF en producción** (`generate-appraisal-pdf.ts`: cache por SHA-256, cuota 50/mes, R2 TTL 30 días, `CfBrowserRenderingService` con binding `BROWSER`).
- **Lo "pendiente" del roadmap, localizado**:
  1. `data.agent` llega `null` en la página pública — `GetPublicAppraisalUseCase` no hace JOIN a `users` (NOTE explícito en `src/app/t/[slug]/page.tsx:20-30`); `agent_contact_card` y `cover` degradan a vacío.
  2. `appraisal_templates.preview_image_url` se lee pero **no hay UI para setearlo** (`TemplateEditor.tsx` sin el campo) → templates sin thumbnail.
  3. Sin lightbox/zoom en `GalleryBlock` / `ExtraMediaBlock`.
  4. `zone_map` es una imagen subida a mano, no un mapa real.
- **Cierres manuales** 🟢: `sold_properties` (migración 018) con CRUD completo, UI en `/tasaciones/vendidas` (form completo + fotos + agente propio/colega externo), picker para comparables `kind='venta'`. Ojo: no está en el sidebar (se entra por `/tasaciones`); `/vendidas` del sidebar es otra cosa (propiedades CRM en etapa vendida).
- **Reportes por propiedad + `/r/` público** 🟢: métricas por portal, contenido narrativo, fotos, devoluciones de visitas, competidores, navegación entre períodos. Con extracción IA de métricas desde screenshot. Sin PDF ni envío automático (eso es Feature 03).

---

## 01 · Prio 1

### Feature 01 — Dashboard de atribución + creativos 🟡

**Ya existe más de lo que el roadmap asume**:
- Meta Marketing API implementada: port `meta-ads-insights.ts`, adapter `meta-ads-insights-http.ts`, endpoint `GET /marketing/campaigns` (`api-analytics/src/index.ts:290-362`, cache CF 900s).
- Dashboard `/marketing` en producción (`vendepro-frontend/src/app/(dashboard)/marketing/page.tsx`, 482 líneas): tabla de campañas con gasto, impresiones, clicks, leads CRM, calificados y CPL, más funnel y leads por fuente.

**Lo que falta para el feature completo**:
- Tablas `ad_campaigns` / `ad_creatives` / `ad_daily_metrics` y cron de pull: **no existen** — todo es fetch live, sin histórico.
- Nivel creativo: el adapter pide `level=campaign` hardcodeado (`meta-ads-insights-http.ts:34`), no trae `ad_id`/`creative_id`/thumbnails → ranking de creativos y "modo grabar" imposibles hoy.
- Google Ads API: no existe. ROI hasta reserva/venta, comparación multi-canal y export PDF: no existen.
- Atribución frágil: matchea `lower(leads.source_detail)` contra `lower(campaign_name)` por string exacto (`api-analytics/src/index.ts:315-331`). El match robusto necesita Feature 02.

### Feature 02 — UTM tracking multi-touch 🟠

- `lead_touches`: **no existe** (0 ocurrencias). `leads` no tiene columnas UTM.
- Lo único que hay: `landing_events` (migración 010) con `visitor_id`, `session_id` y `utm_source/medium/campaign` — **sin `utm_content`/`utm_term`**, justo lo que necesita el match con creativos.
- SDK mínimo scoped a landings: `src/lib/landings/tracker.ts` (cookie `vendepro_lvid` 30 días) — **no persiste first-touch**: relee la URL en cada pageview, una visita posterior sin UTM pisa la atribución.
- **La UTM se pierde al crear el lead**: `submit-lead-from-landing.ts:42-68` guarda `source: 'landing:slug'` y la campaña estática de la landing, no la UTM real del click. No hay join `visitor_id → lead_id` ni hook en `POST /leads`.
- Modelo de atribución (first/last/linear): no existe. UI: solo "Top UTM sources" por landing.

### Feature 03 — Reportes automáticos mensuales 🔴

- No hay cron mensual (los únicos crons del monorepo son `*/15` y `*/5` de api-crm), ni generador, ni envío.
- **Piezas reusables listas**: `CfBrowserRenderingService` + R2 + tokens firmados (hoy solo tasaciones), template base de email (`core/src/domain/rules/email-template.ts`, envuelve todo lo que sale), y `api-analytics/src/reports-queries.ts` ya tiene agregación mensual read-only. El camino natural: tercer cron en api-crm + template HTML del reporte.

### Feature 04 — Conversiones custom Google Ads 🔴

- Cero código: grep de `GoogleAds|conversion_action|gclid` no da nada fuera del roadmap del KB.
- `stage_event_mappings` **no es multi-provider**: columnas fijas `meta_event_name` (NOT NULL) + `ga4_event_name` (nullable); Meta es obligatorio y siempre va primero (`send-marketing-event.ts:183-204`). Sumar Google Ads = migración + refactor del use case + nuevo port/adapter.
- Único punto ya genérico: `meta_event_log.provider` es campo libre.

### Feature 05 — CAPI depurado + Tokko 🟡

- **Vendedor/comprador ya existe, manual**: `leads.pipeline` (`'vendedor'|'comprador'`, migración 039), validación por dominio, pipelines separados en UI con toggle. Pero es **inmutable post-creación** (`lead.ts:160` lo borra del patch) — un clasificador necesitaría un método de dominio nuevo.
- Clasificador automático (reglas + IA), módulo `lead_sources`, detección de portal por UTM/referrer/header: **no existen**. `leads.source` es TEXT libre con catálogo estático duplicado en `core/src/shared/crm-config.ts:110` y `frontend/src/lib/crm-config.ts:234`.
- `custom_data` no diferencia por tipo de lead (ver deuda 00b).
- **Tokko: no existe.** Lo más cercano: KiteProp 🟢.
- **Extensibilidad parcial**: las tablas `org_integrations`/`integration_links`/`integration_sync_log` (migración 034) son multi-provider por diseño, pero el dominio está hardcodeado a KiteProp (`KitepropGateway` con DTOs propios, rutas `/integrations/kiteprop/...`). El framework `ExternalCrmSource` del roadmap no existe — agregar Tokko hoy duplica sync/dedup/atribución.

### Feature 06 — Red compartida de cierres 🟠

- Base confirmada: `sold_properties.shared_with_network` existe desde la migración 018 (con índice parcial y comentario "Preparada para Fase 3").
- **Pero es un flag muerto**: `SoldPropertyForm.tsx` no tiene ningún control para setearlo, y no existe nada de consumo — ni query cross-org, ni anonimización/geohash, ni `network_contributions`/`network_access_grants`, ni karma. Cero hits en todo el repo fuera de la migración y los textos legales de la landing.

---

## 02 · Prio 2

### Feature 07 — Landings por agente 🔴 · Feature 08 — Landings por propiedad 🔴

El **stack de landings donde apoyarse está 🟢 en producción**: tablas (010), 3 templates seedeados, editor completo (bloques, IA edit-block, versiones, flujo draft→review→published), `RecordLandingEventUseCase` + `SubmitLeadFromLandingUseCase` públicos con Meta/GA4 wired, analytics. Gateado por módulo `landings` del plan PRO.

Lo que falta es exactamente lo que dice el roadmap:
- Kinds hoy: solo `'lead_capture' | 'property'` (`core/src/domain/entities/landing.ts:6`). Ni `agent_profile` ni `property_landing`.
- El kind `property` es solo un **estilo**: `landings` no tiene `property_id` — sin vínculo a propiedad real, sin sync de datos ni fotos (se eligen a mano), sin UTM builder, sin QR, sin bloques lightbox/tour-360/mapa.
- Para agente: `landings.agent_id` existe y atribuye eventos/leads, pero no hay template de perfil, slug por agente ni sync de sus propiedades.

### Feature 09 — Automatizaciones de email 🟡

**Más avanzado de lo que el roadmap sugiere** — hubo dos generaciones:
- v1 (`email_automations`, migración 039) fue **absorbida y retirada** (migración 045).
- v2 🟢: motor genérico (`automations`, `automation_actions`, `automation_runs`, `automation_jobs` con cola durable, migraciones 043-046), 9 recetas de sistema seedeadas, UI completa (`configuracion/automatizaciones/` con editor + generación de secuencia por IA), dry-run `:id/test`.

**Los 3 casos del roadmap**:
| Caso | Estado |
|---|---|
| Bienvenida | 🟢 receta `lead_bienvenida`, trigger `lead.created`, se dispara de verdad |
| Nurture por etapa | 🟢 `lead.stage_changed` se dispara |
| Follow-up por inactividad | 🟠 **NO corre**: recetas `sla_contacto_24h`/`lead_frio_7d` y `findActiveTimeBased()` (`d1-automation-repository.ts:61`) existen, pero **nadie las llama** — el cron `*/15` solo hace KiteProp. El comentario "lo evalúa el sistema cada 15 minutos" es aspiracional. |

**Otros gaps**: solo 3 de 9 acciones implementadas (`send_email`, `notify_agent`, `create_calendar_event`; el resto se marca `skipped`); los triggers `appraisal.created` / `property.stage_changed` / `contact.created` / `lead.assigned` están en catálogo y recetas pero **ningún worker los emite** (tampoco los leads creados desde api-public disparan automatizaciones); **open/click tracking no existe** (columnas `opened_at`/`clicked_at` declaradas y nunca escritas, sin pixel, sin redirect, sin webhook de Resend — la UI promete "métricas de apertura" que no llegan).

**Provider**: el roadmap dice "Emblue ya está en stack" — **desactualizado**: Emblue es legacy muerto (cero código vivo); todo sale por **Resend** (campañas, automatizaciones, test, reset de password), con template base unificado. Campañas de email 🟢: wizard completo, segmentos dinámicos, cola con cron `*/5` + batches de 100 + 3 reintentos, suppressions, unsubscribe público HMAC, borrador con IA.

### Feature 10 — Agente conversacional IA 🔴

Confirmado con grep exhaustivo: cero adapters/ports/webhooks de WhatsApp Business, Instagram o Messenger; sin tablas `conversations`/`messages`/`agent_actions`. Lo único con "whatsapp" es cosmético (links `wa.me`, bloque `cta_whatsapp`, acción genérica `http_post` documentada "para WhatsApp vía n8n").

### Feature 11 — Asistente IA interno 🟠

- **IA de extracción/generación 🟢 en producción**: api-ai expone 7 endpoints (extract-metrics/entity/image/comparable, generate-email-campaign/sequence, edit-block) sobre Anthropic (haiku/sonnet) y Groq (llama, whisper implementado sin endpoint).
- Pero **el asistente del roadmap no existe**: `AIChatPanel.tsx` no es un chat — es un wizard de 3 pasos para crear leads. Sin tabla `ai_conversations`, sin turnos/historial, y **cero function calling** en ningún adapter (todo one-shot JSON extraction). Sin rate limits ni cost tracking por org.

---

## 03 · Prio 3

### Feature 12 — Marketplace 🔴 · Feature 13 — Academia 🔴

Nada en el código (esperado: el roadmap dice "se planifican, no se codean todavía").

---

## Preguntas transversales — qué dice el código hoy

| # | Pregunta | Estado en código |
|---|---|---|
| 1 | Planes y billing | 🟡 Gating listo, cobro 🔴. `organizations.plan` (`basic`/`pro`) + `modules` JSON (migración 047), 4 módulos (`publicidad`, `emails`, `landings`, `automatizaciones`), regla en `org-modules.ts`, `ModuleGate`/candados en sidebar. **Solo frontend** ("barrera de producto, no de seguridad"): sin middleware de plan en workers, fallback ante error = abrir todo, activación por SQL a mano, CTA de contratación sin destino (`ModuleGate.tsx:64`). Cero MP/Stripe (lo de api-rentals es cobro de alquileres, otro dominio). |
| 2 | Provider de email | **Resuelta de facto: Resend.** Emblue muerto. Falta decidir si Resend aguanta reportes mensuales + verificación de dominio (columnas `resend_domain_id`/`domain_status` modeladas, nunca escritas — `save-email-settings.ts:44` fuerza null). |
| 3 | OAuth Meta/Google Ads | Sin resolver. Hoy Meta es token pegado a mano por agente; no hay flujo OAuth de Ads. Sí existe el precedente de OAuth Google (Calendar) por usuario. |
| 4 | Aprobaciones Meta messaging | Sin empezar (Feature 10 🔴). |
| 5 | Costos IA por org | Sin resolver: hoy no hay tracking de costo ni rate limit global (solo `AI_EDITS_PER_MINUTE` para landings). |
| 6 | Multi-tenancy red compartida | Sin resolver; solo existe la columna flag (Feature 06 🟠). |
| 7 | API de Tokko | Sin investigar en código; el modelo de `org_integrations` está listo para un segundo provider, el dominio no. |
| 8 | Video hosting | Sin empezar (Feature 13 🔴). |
| 9 | Fee de marketplace | Sin empezar (Feature 12 🔴). |

---

## Extra: piezas fuera del roadmap que aparecieron en el análisis

- **Feed XML de portales (ZonaProp/Argenprop)** 🟡 — backend en producción (`portal_feeds`, mapper con TAGS provisionales pendientes de la spec de Navent, endpoint `GET /feed/:token` sin auth con telemetría), pero **cero UI**: `publish_portals` solo se marca por SQL y el feed se provisiona con script manual (`scripts/portal-feed.mjs`). Ver [[portales-feed-xml]] en memoria.
- **Webhooks salientes + API tokens** 🟢 (`032_webhooks.sql`, `POST /v1/leads`) — el reemplazo del rol disparador de Emblue; consumidores externos vía n8n.
- **api-rentals** — dominio completo aparte (18 rutas, pagos de alquileres).

## KB desactualizado detectado

- [[Dominio-Marketing]] dice `meta_integration` "1 row por org" y describe un envío sGTM separado — ambos obsoletos tras la migración 040 (config por agente) y el diseño actual (Stape es override de endpoint, no tercer envío).
- `doc/backend.md:85` lista `EMBLUE_API_KEY` para api-auth — legacy retirado, hoy es `RESEND_API_KEY`.

## Relacionado

- [[Roadmap-producto]] — el roadmap completo
- [[Dominio-Marketing]] · [[Dominio-Tasaciones]] · [[Dominio-Landings]] · [[Dominio-Leads]] · [[Servicios-externos]]
