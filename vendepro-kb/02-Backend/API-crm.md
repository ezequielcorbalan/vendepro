# 🤝 API-crm

Worker más grande: gestión completa de leads, contactos, calendario, actividades, tags, marketing, landings y API keys.

| Campo | Valor |
|---|---|
| Path | `packages/api-crm/` |
| Subdominio | `crm.api.vendepro.com.ar` |
| Bindings | D1 (`DB`) |
| Secrets | `JWT_SECRET` |
| Middleware | cors, error-handler, **auth (todas las rutas)** |

## Endpoints

### Leads — [[Dominio-Leads]]

| Método | Path | Use case |
|---|---|---|
| GET | `/leads` | GetLeadsUseCase (filters: `?stage`, `?agent_id`, `?search`) |
| POST | `/leads` | CreateLeadWithContactUseCase + marketing event `lead_created` |
| PUT | `/leads` | UpdateLeadUseCase |
| DELETE | `/leads` | DeleteLeadUseCase (`?id`) |
| POST | `/leads/stage` | AdvanceLeadStageUseCase + marketing event |

### Contactos — [[Dominio-Contactos]]

| Método | Path | Use case |
|---|---|---|
| GET | `/contacts` | GetContactsUseCase (`?search`, `?agent_id`) |
| GET | `/contacts/:id` | GetContactDetailUseCase (incluye leads + properties asociados) |
| POST | `/contacts` | CreateContactUseCase |
| DELETE | `/contacts` | DeleteContactUseCase (`?id`) |

### Calendario — [[Dominio-Calendario]]

| Método | Path | Use case |
|---|---|---|
| GET | `/calendar` | GetCalendarEventsUseCase (`?agent_id`, `?start`, `?end`, `?event_type`) |
| POST | `/calendar` | CreateCalendarEventUseCase |
| PUT | `/calendar/complete` | ToggleEventCompleteUseCase (`?id`) |
| PUT | `/calendar/reschedule` | RescheduleEventUseCase (`{id, start_at, end_at}`) |
| DELETE | `/calendar` | (`?id`) |

### Actividades — [[Dominio-Actividades]]

| Método | Path | Descripción |
|---|---|---|
| GET | `/activities` | Lista actividades (`?agent_id`, `?lead_id`, `?contact_id`, `?property_id`) |

### Tags — [[Dominio-Tags]]

| Método | Path | Descripción |
|---|---|---|
| GET | `/tags` | Lista tags de la org |
| POST | `/tags` | CreateTagUseCase |
| DELETE | `/tags` | (`?id`) |
| GET | `/lead-tags` | Tags de un lead (`?lead_id`) |
| POST | `/lead-tags` | Agrega tag a lead (`{lead_id, tag_id}`) |
| DELETE | `/lead-tags` | Remueve tag (`?lead_id, ?tag_id`) |

### API Key (para captura pública)

| Método | Path | Use case |
|---|---|---|
| POST | `/api-key` | GenerateOrgApiKeyUseCase |
| GET | `/api-key` | GetOrgApiKeyUseCase |

### Stage History

| Método | Path | Descripción |
|---|---|---|
| GET | `/stage-history` | Historial de cambios (`?entity_type, ?entity_id`) |

### Marketing — [[Dominio-Marketing]]

| Método | Path | Use case |
|---|---|---|
| GET | `/marketing/integration` | GetMetaIntegrationUseCase |
| PUT | `/marketing/integration` | SaveMetaIntegrationUseCase (admin) |
| GET | `/marketing/mappings` | ListStageMappingsUseCase |
| POST | `/marketing/mappings` | SaveStageMappingUseCase (admin) |
| DELETE | `/marketing/mappings/:id` | DeleteStageMappingUseCase (admin) |
| POST | `/marketing/test-event` | Envía test event a Meta (admin) |
| GET | `/marketing/event-log` | ListMetaEventLogUseCase |

### Landings — [[Dominio-Landings]]

| Método | Path | Use case |
|---|---|---|
| GET | `/landings` | ListLandingsUseCase (`?scope=mine, ?kind, ?status`) |
| GET | `/landings/:id` | GetLandingUseCase |
| POST | `/landings` | CreateLandingFromTemplateUseCase |
| PATCH | `/landings/:id` | UpdateLandingMetadataUseCase |
| PATCH | `/landings/:id/blocks` | UpdateLandingBlocksUseCase |
| POST | `/landings/:id/blocks` | AddBlockUseCase |
| DELETE | `/landings/:id/blocks/:blockId` | RemoveBlockUseCase |
| POST | `/landings/:id/blocks/reorder` | ReorderBlocksUseCase |
| PATCH | `/landings/:id/blocks/:blockId/visibility` | ToggleBlockVisibilityUseCase |
| GET | `/landings/:id/versions` | Lista versiones |
| POST | `/landings/:id/rollback/:versionId` | RollbackLandingUseCase |
| POST | `/landings/:id/request-publish` | RequestPublishUseCase (agente) |
| POST | `/landings/:id/publish` | PublishLandingUseCase (admin) |
| POST | `/landings/:id/reject-publish` | RejectPublishRequestUseCase (admin) |
| POST | `/landings/:id/archive` | ArchiveLandingUseCase |
| POST | `/landings/:id/unarchive` | UnarchiveLandingUseCase |
| GET | `/landings/:id/analytics` | GetLandingAnalyticsUseCase (`?rangeDays=7/14/30`) |

### Landing Templates

| Método | Path | Use case |
|---|---|---|
| GET | `/landing-templates` | ListTemplatesUseCase (`?kind`) |
| POST | `/landing-templates` | CreateTemplateUseCase |
| PATCH | `/landing-templates/:id` | UpdateTemplateUseCase |

## Total de endpoints

~45 (es el worker con más superficie HTTP).
