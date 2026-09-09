# 📣 Dominio: Marketing (Meta CAPI + GA4 + sGTM)

Integración server-side de tracking para enviar conversiones a Meta y GA4 desde el backend (independiente del browser).

## Entidades

- **`MetaIntegration`** (`domain/entities/meta-integration.ts`) — config **por agente** (desde migración `040_meta_integration_por_agente.sql`; antes era por org)
  - `agent_id` (PK) + `org_id`
  - Meta: `pixel_id`, `access_token_encrypted`, `test_event_code`, `enabled`, `ad_account_id` (migración 036, para Meta Ads Insights)
  - GA4: `ga4_measurement_id`, `ga4_api_secret_encrypted`, `ga4_enabled`
  - Extra: `stape_endpoint`, `gtm_container_id`
  - Métodos: `update(patch)`, `toPublicView()` (sin tokens)

- **`StageEventMapping`** — mapeo de transiciones del CRM → eventos de conversión
  - `org_id`, `stage_key` (ej: `lead_calificado`), `meta_event_name` (ej: `Lead`), `ga4_event_name` (opcional)

- **`PortalSpend`** (`domain/entities/portal-spend.ts`) — gasto mensual en un portal, cargado a mano (migración `050_portal_spend.sql`)
  - `provider` guarda **el mismo valor que `leads.source`**: es la única forma de cruzar el gasto contra los leads que trajo. Si no matchea con una fuente real, el gasto queda huérfano.
  - `period_month` (`YYYY-MM`), `amount`, `currency` (ARS|USD)
  - `usd_rate` = unidades de `currency` por 1 USD, **congelada con la fila** (`usd_rate_source`, `usd_rate_at`). Recalcularla después haría que el gasto de julio valga lo de hoy. `null` = no se pudo resolver y hay que completarla a mano; nunca se inventa.
  - Reglas de cruce en `domain/rules/portal-cost-rules.ts`

- **`CampaignGoal`** (`domain/value-objects/campaign-goal.ts`) — objetivo comercial de una campaña: `captacion` o `demanda` (migración `051_campaign_goals.sql`)
  - Meta NO lo sabe: su `objective` dice cómo optimiza, no para qué la usa la inmobiliaria. Lo etiqueta el usuario.
  - Se guarda contra el **`campaign_id`** del proveedor y nunca contra el nombre: renombrar en Ads Manager no rompe la etiqueta.
  - Granularidad campaña. Si algún día hace falta ad set, se agrega `ad_set_id` con default NULL.
  - Una campaña sin etiqueta queda **sin clasificar** y no cuenta en ninguna sección: repartirla en las dos duplicaría el gasto y dejaría el costo por captación a la mitad (`splitCampaignsByGoal`).

- **`MetaEventLog`** — log de cada envío
  - `provider` (meta | ga4), `event_id`, `event_name`, `entity_type`, `entity_id`
  - `status` (pending | sent | failed), `response_code`, `response_body`, `attempts`, `last_error`

## Tablas D1

- `meta_integration` (1 row **por agente** — PK `agent_id` desde la migración 040; si el agente no configuró, el evento es noop)
- `stage_event_mappings`
- `meta_event_log` (índices por provider + entity)
- `portal_spend` (único por org + **dueño** + portal + mes desde la migración 054: dos agentes pueden cargar su propio gasto de ZonaProp el mismo mes sin pisarse)
- `campaign_goals` (migración 051 — PK org + provider + campaign_id)
- `properties.commission_*` + `income_at` (migración 052) — el ingreso de la operación cerrada, con su cotización congelada

## Flujo

```
Cambio de stage / submit landing
    ↓
Use case (ej. AdvanceLeadStageUseCase)
    ↓
MarketingSenderFactory.execute({ org_id, stage_key, entity_id, ... })
    ↓
1. Busca StageEventMapping
2. Genera event_id determinístico: sha256(orgId:entityType:entityId:eventKey:YYYYMMDD)
   (compartido con el Pixel vía dataLayer para dedup)
3. Para cada provider habilitado en MetaIntegration:
   - Meta CAPI → MetaConversionApiHttp.sendEvent(...)
   - GA4 MP → Ga4MeasurementProtocolHttp.sendEvent(...)
   (si hay stape_endpoint, ambos providers lo usan como override del
    endpoint destino — NO es un tercer envío separado)
4. Loguea cada intento en meta_event_log
```

Ver `infrastructure/src/services/marketing-sender-factory.ts` y [[Servicios-externos]].

## Eventos típicos mapeables

- `lead_created`, `lead_calificado`, `lead_perdido`
- `appraisal_created`, `appraisal_presentada`
- `reservation_created`, `reservation_reservada`, `reservation_escriturada`
- `landing_lead_submitted`

## Use cases

- `GetMetaIntegration`, `SaveMetaIntegration` (admin)
- `ListStageMappings`, `SaveStageMapping`, `DeleteStageMapping` (admin)
- `ListMetaEventLog`
- `GetPublicTagConfig` — contenedor de GTM del agente para las páginas públicas (sin auth)
- `SendMarketingEvent` (genérico, lo invocan los otros use cases)
- `SendMetaConversionEvent` (legacy Meta-only)
- `RetryFailedMetaEvents` — ⚠️ código muerto: existe con tests pero ningún endpoint ni cron lo invoca

## Endpoints

[[API-crm]]:
- `GET/PUT /marketing/integration`
- `GET/POST /marketing/mappings`, `DELETE /marketing/mappings/:id`
- `POST /marketing/test-event`
- `GET /marketing/event-log`
- Gasto de portales (**marketing por usuario**: cada agente carga y ve el suyo; admin/owner ven el de toda la inmobiliaria):
  `GET /marketing/portal-spend?from_month=&to_month=` ·
  `PUT /marketing/portal-spend` (upsert por org + portal + mes) ·
  `DELETE /marketing/portal-spend/:id`
- `PUT /marketing/campaign-goal` — objetivo comercial de una campaña; `goal: null` la devuelve a "sin clasificar". No es admin-only: la campaña vive en la cuenta publicitaria del usuario

[[API-analytics]]:
- `GET /marketing?period=&pipeline=` (dashboard de marketing). Con `pipeline=comprador` incluye `portalCosts`: costo por lead y por visita de cada portal, con el gasto mensual prorrateado por los días del rango. `pipeline` es `vendedor` (default) o `comprador` y **filtra todas las series** — embudo, fuentes y serie diaria. Devuelve `totals` / `previous` / `deltas` contra el mismo tramo del período anterior, más `range` con las dos ventanas.
- `GET /marketing/campaigns?period=&pipeline=` (Meta Ads Insights live con cache 900s + match a leads por `source_detail` ≈ `campaign_name`). El CPL viene partido en `cpl_crm` y `cpl_meta`: son dos números distintos y la UI declara cuál es cuál.
- Los tres períodos (`month`/`quarter`/`year`) son **de calendario hasta hoy**, y el período anterior tiene la misma cantidad de días transcurridos (`domain/value-objects/marketing-period.ts`).

[[API-public]] — tagging de páginas públicas:
- `/l/:slug`, `/public/property-visit-form/:slug` y `/public/appraisal/:slug` devuelven `tag: { gtm_container_id, stape_endpoint }` del agente dueño de la página (`GetPublicTagConfigUseCase`). Es lo único de `meta_integration` que sale sin auth: el ID de contenedor termina igual en el HTML, los tokens nunca salen.

## Frontend

- `/marketing` (hub) — **por usuario**: cada agente ve su presupuesto contra sus leads y sus captaciones; admin/owner ven la inmobiliaria entera (mismo criterio que el log de eventos). **Dos secciones**: Captación (pipeline vendedor) y Demanda (comprador). Son dos objetivos de pauta distintos y no se suman: los portales (ZonaProp/ArgenProp/MercadoLibre) son inventario de demanda y viven en Demanda, no compitiendo contra Meta en el gráfico de captación.
- `/configuracion/marketing` (config)

Componentes adicionales: `GtmScript.tsx` (inserta script GTM en client), `dataLayer.ts` (helper push), `PortalCosts.tsx` (tabla de costo por portal + ABM del gasto mensual, en Demanda), `Campaigns.tsx` (tabla de campañas + selector de objetivo + bandeja de sin clasificar) y `HowItWorks.tsx` (explicación al pie de de dónde sale cada número, distinta por sección).

`GtmScript` se monta en las tres páginas públicas — `/l/[slug]` (destino de los anuncios), `/t/[slug]` y `/v/[slug]` — con el `tag` que devuelve la API pública. Sin eso, los `pushMarketingEvent` del front empujan a un `dataLayer` que no lee nadie.

## Seguridad

- Tokens (Meta access_token, GA4 api_secret) se almacenan **encriptados** con AES-GCM derivado de `JWT_SECRET` (ver [[Servicios-externos|TokenEncryption]]).
- Las APIs nunca devuelven los tokens en plain text — usan `toPublicView()`.

## Relacionados

- [[Dominio-Leads]] (lead created/stage advance dispara eventos)
- [[Dominio-Reservas]] (cambios de stage)
- [[Dominio-Tasaciones]]
- [[Dominio-Landings]] (lead from landing dispara evento)
