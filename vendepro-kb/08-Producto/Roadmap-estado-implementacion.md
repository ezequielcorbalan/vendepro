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
| 07 · Landings por agente | 🟢 | Perfil + landing `/a/<org>/<agente>` con binding vivo en producción; propiedades activas, testimonios y descargables quedan fuera del MVP. |
| 08 · Landings por propiedad | 🔴 | El kind `property` es solo un estilo; `landings` no tiene `property_id`, sin UTM builder ni QR. |
| 09 · Automatizaciones de email | 🟡 | Motor v2 en producción; barrido cron time-based + los 9 triggers con emisor (api-public, api-crm, api-properties) implementados el 10-sep (falta deploy). Quedan 6 acciones sin executor y el open/click tracking. |
| 10 · Agente conversacional IA | 🔴 | Cero código de WhatsApp/IG/Messenger, sin tablas conversations/messages. |
| 11 · Asistente IA interno | 🟠 | IA de extracción/generación 🟢, pero no hay chat, ni `ai_conversations`, ni function calling. |
| 12 · Marketplace de servicios | 🔴 | Nada. |
| 13 · Academia | 🔴 | Nada. |
| — · Planes y billing (pregunta 1) | 🟡 | Gating `plan`+`modules` con UI completa; **solo frontend**, sin enforcement en API y sin cobro (MP/Stripe: 0). |
| — · Feed XML portales | 🟡 | Backend sirve XML real; sin UI, opt-in solo por SQL, tags sin validar contra spec Navent. |
| — · Design system (fase 6) | 🟡 | 50 componentes, 31 reglas y 9 ratchets en CI; quedan 19 `ds-todo` y las páginas públicas sin decidir. |

---

## 00 · Base

### 00a — CRM operacional 🟢

Todo el núcleo está en producción con backend + UI:

- **Leads**: 6 use cases (`core/src/application/use-cases/leads/`), etapas (`LEAD_STAGES` 10 etapas + `TAG_PIPELINES` en `core/src/shared/crm-config.ts`), historial en `stage_history`, pipelines separados vendedor/comprador (`leads.pipeline`, migración 039).
- **Cierre de leads 🟢 (03-sep-2026)**: los cerrados salen del pipeline también en la vista Lista (antes solo del kanban), con toggle "Cerrados (N)". `perdido` se muestra como **"No captado"** y `finalizado` como **"Vendido"** — labels, las claves no cambian (ver [[Estados]] §1). Cerrar un no captado abre `MarkNotCapturedModal` (motivo + cuándo recontactar → `next_step_date`) y dispara la automatización `recontacto_no_captado`, que agenda tareas a 30 y 120 días (migración **050**, activa por org). Pendiente operativo: aplicar la migración 050 y deployar el frontend.
- **Contactos, calendario, actividades, tags, objetivos, visit forms**: en producción (`api-crm`, `api-properties`, `api-admin`).
- **Google Calendar** 🟢: espejo unidireccional VendéPro→Google + lectura solo-visualización (`use-cases/integrations/`, `api-crm/src/index.ts:725-900`). Pendiente operativo: secrets `GOOGLE_CLIENT_ID/SECRET` y publicar el consent screen.
- **KiteProp** 🟢: sync manual + cron `*/15` + backfill + enrich + mapeo de agentes + UI (`configuracion/conexiones`). Habla MCP JSON-RPC (`infrastructure/src/services/kiteprop-mcp-client.ts`).

**Bugs encontrados en el análisis** (deuda del CRM base):
1. 🐛 **NotificationBell nunca muestra nada** — `vendepro-frontend/src/components/layout/NotificationBell.tsx:24` llama `apiFetch('crm', '/notifications')` pero el endpoint vive en **api-admin** (`api-admin/src/index.ts:251`), y además espera `{notifications}` cuando el backend devuelve un array plano. Doble desalineación, `.catch` silencioso → campana siempre vacía.
2. 🐛 **Detalle de prefactibilidad → 404** — `prefactibilidades/page.tsx:77` linkea a `/prefactibilidades/${id}` pero no existe `[id]/page.tsx` (el backend sí tiene `GET /prefactibilidades/:id`).
3. ~~🐛 **Endpoints IA fantasma**~~ — **resuelto 2026-09-08**: `/extract-kiteprop` ahora existe en api-ai (PDF de KiteProp por Gemini nativo) y el screenshot de competencia reusa `/extract-comparable`; además hay `/extract-comparable-url` para pegar el link del aviso (con lista blanca de portales y degradación explícita a captura cuando el anti-bot bloquea).
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

### Feature 07 — Landings por agente 🟢

El **stack de landings donde apoyarse está 🟢 en producción**: tablas (010), editor completo (bloques, IA edit-block, versiones, flujo draft→review→published), `RecordLandingEventUseCase` + `SubmitLeadFromLandingUseCase` públicos con Meta/GA4 wired, analytics. Gateado por módulo `landings` del plan PRO.

**Implementado** (23 commits, rama `feat/landings-agente`):
- Kind `agent_profile` (`core/src/domain/entities/landing.ts:7`), con invariante de lead-form relajada a 0..1 (`landing-rules.ts:71-79`) — los otros kinds siguen exigiendo exactamente 1.
- Tabla `agent_profiles` 1:1 con `users` (migración 048) + template de sistema `tpl_agent_profile_v1` (migración 049, 9 bloques) → landing_templates pasa de 3 a 4 seeds globales.
- 4 bloques nuevos (`agent-hero`, `agent-credentials`, `faq`, `cta-whatsapp`) — de 8 a 12 tipos de bloque totales.
- **Binding vivo**: los bloques marcados `binding: 'agent_profile'` se rellenan con los datos del perfil en la lectura pública (no al crear la landing) — a diferencia del `binding_mode` de tasaciones, que snapshotea. El agente edita `/perfil` una vez y la landing se actualiza sola.
- `GetPublicAgentLandingUseCase` sirve `GET /a/:orgSlug/:agentSlug` con 5 puertas (org → perfil público → usuario activo y de la misma org → landing publicada → bindings resueltos).
- Frontend: ruta pública `/a/[org]/[slug]` (revalidate 60), sección "Perfil público" en `/perfil`, campos bindeados read-only en el editor de landings.
- Detalle completo: [[Dominio-Landings]] § Perfil de agente, [[Dominio-Usuarios-Org]] § AgentProfile.

**Fuera del MVP a propósito** (Fase 2): propiedades activas del agente en vivo (sync con `properties`), testimonios, descargables. El template las deja como huecos de contenido editorial manual (`features-grid`/`benefits-list`/`gallery` genéricos), no como bloques dedicados.

### Feature 08 — Landings por propiedad 🔴

El kind `property` es solo un **estilo**: `landings` no tiene `property_id` — sin vínculo a propiedad real, sin sync de datos ni fotos (se eligen a mano), sin UTM builder, sin QR, sin bloques lightbox/tour-360/mapa. No tocado por el trabajo de Feature 07.

### Feature 09 — Automatizaciones de email 🟡

**Más avanzado de lo que el roadmap sugiere** — hubo dos generaciones:
- v1 (`email_automations`, migración 039) fue **absorbida y retirada** (migración 045).
- v2 🟢: motor genérico (`automations`, `automation_actions`, `automation_runs`, `automation_jobs` con cola durable, migraciones 043-046), **12** recetas de sistema seedeadas —11 en la 044 más `recontacto_no_captado` en la 050—, UI completa (`configuracion/automatizaciones/` con editor + generación de secuencia por IA), dry-run `:id/test`.
- Galería de recetas agrupada por momento del negocio (`RECIPE_CATEGORIES` en `automation-catalog.ts` → `meta.recipe_categories` + `category` en cada `CatalogItem`): 5 secciones (entrada de leads, alertas y SLA, tasación, captación, propiedades), buscador por nombre/disparador/acción, filtro por categoría, y las ya activadas ocultas detrás de un switch. La categoría es metadata de presentación: vive en el catálogo declarativo, no en la base.

**Los 3 casos del roadmap**:
| Caso | Estado |
|---|---|
| Bienvenida | 🟢 receta `lead_bienvenida`, trigger `lead.created`, se dispara de verdad |
| Nurture por etapa | 🟢 `lead.stage_changed` se dispara |
| Follow-up por inactividad | 🟡 **Implementado 10-sep-2026, falta deploy**: `SweepTimeBasedAutomationsUseCase` (core) + `D1AutomationSweepRepository` (queries de candidatos con filtro anti-re-disparo sobre `automation_runs`) + `sweepTimeBasedAutomations()` en la factory, enganchado al cron `*/15` de api-crm. Cubre los 3 triggers por tiempo (`lead.sin_contacto_24h`, `lead.sin_respuesta_7d`, `property.publicacion_vencida` — vencimiento = `auth_start_date` + `auth_duration_days`). Dedup doble: pre-filtro SQL por scope + `claim()` del motor; tope de 50 candidatos por automatización por tick. |

**Emisores (10-sep-2026)** — los 9 triggers del catálogo ya tienen emisor:
- **api-public** dispara `lead.created` en `/v1/leads` (por lead creado, no duplicado), `/public/leads` (legacy) y `/l/:slug/submit` (landings). Se dispara **sin drenar** (el worker no tiene `RESEND_API_KEY` y drenar sin executor marcaría los emails `skipped: not_implemented`); los jobs los ejecuta el cron `*/5` de api-crm, así que la bienvenida puede tardar hasta 5 min. Los leads que crea el **sync de KiteProp** siguen sin disparar (pendiente).
- **api-crm** dispara `contact.created` (`POST /contacts`, solo alta explícita — el contacto de `CreateLeadWithContact` ya disparó `lead.created`) y `lead.assigned` (`PUT /leads` cuando el update cambió `assigned_to`; `UpdateLeadUseCase` ahora devuelve `assignedChanged`).
- **api-properties** dispara `appraisal.created` (`POST /appraisals`) y `property.stage_changed` (`PUT /properties/:id/stage`, con from/to; si el sync engine también movió el lead vinculado, dispara además `lead.stage_changed` para ese lead). Igual que api-public: dispara sin drenar.
- `BuildAutomationContextUseCase` ahora arma el scope `appraisal` (id, address, neighborhood, status, suggested_price, `public_url` `/t/<slug>`; agente = el de la tasación; lead/contact colgados de `lead_id`) — antes un evento de tasación renderizaba ese scope en blanco.

**Otros gaps**: solo 3 de 9 acciones implementadas (`send_email`, `notify_agent`, `create_calendar_event`; el resto se marca `skipped`); **open/click tracking no existe** (columnas `opened_at`/`clicked_at` declaradas y nunca escritas, sin pixel, sin redirect, sin webhook de Resend — la UI promete "métricas de apertura" que no llegan).

**Provider**: el roadmap dice "Emblue ya está en stack" — **desactualizado**: Emblue es legacy muerto (cero código vivo); todo sale por **Resend** (campañas, automatizaciones, test, reset de password), con template base unificado. Campañas de email 🟢: wizard completo, segmentos dinámicos, cola con cron `*/5` + batches de 100 + 3 reintentos, suppressions, unsubscribe público HMAC, borrador con IA.

### Feature 10 — Agente conversacional IA 🔴

Confirmado con grep exhaustivo: cero adapters/ports/webhooks de WhatsApp Business, Instagram o Messenger; sin tablas `conversations`/`messages`/`agent_actions`. Lo único con "whatsapp" es cosmético (links `wa.me`, bloque `cta_whatsapp`, acción genérica `http_post` documentada "para WhatsApp vía n8n").

### Feature 11 — Asistente IA interno 🟠

- **IA de extracción/generación 🟢 en producción**: api-ai expone 9 endpoints (extract-metrics/entity/image/comparable/comparable-url/kiteprop, generate-email-campaign/sequence, edit-block), todos sobre Gemini `3.5-flash-lite` (ver [[API-ai]]).
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
- **Design system 🟡 (fase 6, al 08-sep-2026)** — no es un feature de producto,
  pero condiciona todo lo que se construya encima, así que va acá.

  **Qué hay**: 50 componentes en `vendepro-frontend/src/components/ui`, galería
  viva y pública en `/design-system`, 31 reglas con ❌/✅ en
  `doc/ds-visual-rules.md` y **9 ratchets con baseline** en
  `scripts/.ds-*-baseline` que corren en CI (`npm run lint:ds`). El ratchet no
  falla por lo que ya existe: falla si un cambio *sube* el número, así que el
  retroceso queda trabado sin tener que migrar todo primero.

  **Cerrado**: overlays armados a mano **18 → 0** (y ahí se queda: cualquier
  `inset-0` translúcido nuevo hace fallar el lint); diálogos nativos
  `confirm/alert/prompt` **24 → 3**; `Switch`/`Checkbox`/`ChoicePills` se pueden
  nombrar sin dibujar la etiqueta (`aria-label`); `ConfirmDialog` migrado a
  `Modal`, con lo que hereda Portal, scroll-lock, focus-trap y Esc.

  **Qué falta**, y por qué no es solo trabajo mecánico:
  - **19 `ds-todo`** — son decisiones de diseño pendientes, no deuda. Las tres
    grandes: `FileInput` y `ColorInput` (el DS no tiene control de archivo ni de
    color) y qué hacer con las **páginas públicas** (`/f/`, `/v/`): DS o
    identidad propia. Esa última desbloquea 11 controles nativos.
  - **Error de hidratación en 8 lugares** — `getCurrentUser()` lee
    `localStorage`, así que devuelve `null` en el servidor y el usuario real en
    el cliente; las pantallas que eligen qué mostrar según el rol pintan cosas
    distintas y React re-renderiza todo el árbol. El hook que lo arregla está en
    `src/lib/use-current-user.ts`; aplicarlo cambia el primer render de esas 8.
  - Los 30 controles nativos que quedan en archivos de la tanda de Ezequiel
    quedaron **fuera de alcance** a propósito, para no pisarnos.

  Ver `doc/ds-plan.md`, `doc/ds-review.md` y `doc/ds-plan-fase6.md`.

## KB desactualizado detectado

- [[Dominio-Marketing]] dice `meta_integration` "1 row por org" y describe un envío sGTM separado — ambos obsoletos tras la migración 040 (config por agente) y el diseño actual (Stape es override de endpoint, no tercer envío).
- `doc/backend.md:85` lista `EMBLUE_API_KEY` para api-auth — legacy retirado, hoy es `RESEND_API_KEY`.
- [[Frontend-componentes]] decía "el design system (46 archivos)" y le faltaban
  5 componentes (`ActionGroup`, `AgentSelector`, `DetailHeader`, `StepCard`,
  `WhatsAppTemplatePicker`), además de marcar `ConfirmDialog` como "legacy a
  reemplazar por Modal" cuando ya se migró. **Corregido el 08-sep-2026.**
- [[DB-overview]] § "Migrations en orden": la tabla se corta en la migración 020 y dice "51 tablas en 24 migrations", pero `migrations_v2/` tiene hoy 58 archivos hasta la 049 (confirmado al documentar Feature 07). El gap 021-047 no está listado — quedó así desde antes de este feature, backfillarlo es trabajo aparte.

## Relacionado

- [[Roadmap-producto]] — el roadmap completo
- [[Dominio-Marketing]] · [[Dominio-Tasaciones]] · [[Dominio-Landings]] · [[Dominio-Leads]] · [[Servicios-externos]]
