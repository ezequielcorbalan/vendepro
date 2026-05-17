# 📣 Dominio: Marketing (Meta CAPI + GA4 + sGTM)

Integración server-side de tracking para enviar conversiones a Meta y GA4 desde el backend (independiente del browser).

## Entidades

- **`MetaIntegration`** (`domain/entities/meta-integration.ts`) — config por org
  - `org_id` (PK)
  - Meta: `pixel_id`, `access_token_encrypted`, `test_event_code`, `enabled`
  - GA4: `ga4_measurement_id`, `ga4_api_secret_encrypted`, `ga4_enabled`
  - Extra: `stape_endpoint`, `gtm_container_id`
  - Métodos: `update(patch)`, `toPublicView()` (sin tokens)

- **`StageEventMapping`** — mapeo de transiciones del CRM → eventos de conversión
  - `org_id`, `stage_key` (ej: `lead_calificado`), `meta_event_name` (ej: `Lead`), `ga4_event_name` (opcional)

- **`MetaEventLog`** — log de cada envío
  - `provider` (meta | ga4), `event_id`, `event_name`, `entity_type`, `entity_id`
  - `status` (pending | sent | failed), `response_code`, `response_body`, `attempts`, `last_error`

## Tablas D1

- `meta_integration` (1 row por org)
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
2. Para cada provider habilitado en MetaIntegration:
   - Meta CAPI → MetaConversionApiHttp.sendEvent(...)
   - GA4 MP → Ga4MeasurementProtocolHttp.sendEvent(...)
   - Stape sGTM (si tiene endpoint) → HTTP POST a stape_endpoint
3. Loguea cada intento en meta_event_log
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
- `SendMetaConversionEvent`
- `RetryFailedMetaEvents`

## Endpoints

[[API-crm]]:
- `GET/PUT /marketing/integration`
- `GET/POST /marketing/mappings`, `DELETE /marketing/mappings/:id`
- `POST /marketing/test-event`
- `GET /marketing/event-log`

[[API-analytics]]:
- `GET /marketing` (dashboard de marketing — leads por fuente, eventos enviados)

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
