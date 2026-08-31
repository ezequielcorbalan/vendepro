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

- **`MetaEventLog`** — log de cada envío
  - `provider` (meta | ga4), `event_id`, `event_name`, `entity_type`, `entity_id`
  - `status` (pending | sent | failed), `response_code`, `response_body`, `attempts`, `last_error`

## Tablas D1

- `meta_integration` (1 row **por agente** — PK `agent_id` desde la migración 040; si el agente no configuró, el evento es noop)
- `stage_event_mappings`
- `meta_event_log` (índices por provider + entity)

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
- `SendMarketingEvent` (genérico, lo invocan los otros use cases)
- `SendMetaConversionEvent` (legacy Meta-only)
- `RetryFailedMetaEvents` — ⚠️ código muerto: existe con tests pero ningún endpoint ni cron lo invoca

## Endpoints

[[API-crm]]:
- `GET/PUT /marketing/integration`
- `GET/POST /marketing/mappings`, `DELETE /marketing/mappings/:id`
- `POST /marketing/test-event`
- `GET /marketing/event-log`

[[API-analytics]]:
- `GET /marketing` (dashboard de marketing — leads por fuente, eventos enviados)
- `GET /marketing/campaigns` (Meta Ads Insights live con cache 900s + match a leads por `source_detail` ≈ `campaign_name`)
  - ⚠️ bug conocido: `api-analytics/src/index.ts:254` consulta `meta_integration WHERE org_id = ?` pero la PK es `agent_id` (migración 040) → puede mostrar la config de otro agente

## Frontend

- `/marketing` (hub)
- `/configuracion/marketing` (config)

Componentes adicionales: `GtmScript.tsx` (inserta script GTM en client), `dataLayer.ts` (helper push).

## Seguridad

- Tokens (Meta access_token, GA4 api_secret) se almacenan **encriptados** con AES-GCM derivado de `JWT_SECRET` (ver [[Servicios-externos|TokenEncryption]]).
- Las APIs nunca devuelven los tokens en plain text — usan `toPublicView()`.

## Relacionados

- [[Dominio-Leads]] (lead created/stage advance dispara eventos)
- [[Dominio-Reservas]] (cambios de stage)
- [[Dominio-Tasaciones]]
- [[Dominio-Landings]] (lead from landing dispara evento)
