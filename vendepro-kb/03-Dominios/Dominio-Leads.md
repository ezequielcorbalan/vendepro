# 🎯 Dominio: Leads

El **lead** es el prospecto que entra al pipeline comercial. Es la entidad más importante del CRM.

## Pipeline

```
nuevo → asignado → contactado → calificado → en_tasacion → presentada → seguimiento → captado
                                                                                      ↘ perdido
```

(9 stages, definidos en `domain/value-objects/lead-stage.ts` con transiciones validadas.)

> La etapa `perdido` se muestra en la UI del pipeline vendedor como
> **"No captado"**, y `finalizado` como **"Vendido"**. Las claves no cambian.
> Un no captado sale del pipeline pero queda con recontacto agendado a los 30 y
> 120 días. Detalle completo en [[Estados]] §1 y §1.1.

## Entidad

- **`Lead`** (`packages/core/src/domain/entities/lead.ts`)

Campos principales:
- Identificación: `id`, `org_id`, `full_name`, `phone`, `email`
- Origen: `source` (otro|zonaprop|argenprop|mercadolibre|instagram|facebook|google|referido|cartel|telefono|manual), `source_detail`
- Interés: `property_address`, `neighborhood`, `property_type`, `operation` (venta|alquiler|alquiler_temporal|tasacion|otro)
- Estado: `stage`, `assigned_to`, `contact_id`
- Negocio: `notes`, `estimated_value`, `budget`, `timing`, `personas_trabajo`, `mascotas`
- Workflow: `next_step`, `next_step_date`, `lost_reason`, `first_contact_at`
- Timestamps: `created_at`, `updated_at`

Métodos: `advanceStage(newStage)`, `update(data)`, `getUrgency()`, `getChecklistScore()`, `getChecklist()`, `needsFollowupEvent()`.

## Reglas de negocio (`domain/rules/lead-rules.ts`)

- `getLeadUrgency(lead)` → ok | warning | danger | lost
  - Lead nuevo sin contactar en **24h** → `danger`
  - Sin updates en **7 días** → `danger`
  - Sin updates en **3 días** → `warning`
- `getLeadChecklist(lead)` → estado de {contacto, necesidad, operacion, presupuesto, zona, proxima_accion}
- `getLeadChecklistScore(lead)` → 0-100
- `computeLeadFunnel(stageBreakdown, totalLeads)` → estadísticas para dashboard
- `computeConversionRate(...)` → % captados

## Tabla D1

`leads` (ver [[DB-overview]]):
- 24 columnas
- Índices: `(org_id, stage)`, `assigned_to`, `created_at`
- FKs: `assigned_to → users(id)`, `contact_id → contacts(id)`
- M:N con tags vía `lead_tags`
- `meta_lead_id` (migración 065): ID de Meta Lead Ads si el lead entró por un formulario de Facebook/Instagram. Índice único parcial `(org_id, meta_lead_id)`.

## Use cases

En `packages/core/src/application/use-cases/leads/`:
- `CreateLeadUseCase` — sin contacto
- `CreateLeadWithContactUseCase` — crea Lead + Contact en una transacción (usado por POST /leads y por captura pública)
- `GetLeadsUseCase` — filtros stage / agent / search
- `UpdateLeadUseCase`
- `DeleteLeadUseCase`
- `AdvanceLeadStageUseCase` — valida transición + loguea en `stage_history` + dispara marketing event

## Delegación a un agente (22-sep-2026)

`POST /leads/assign` (`AssignLeadUseCase`) — delegar es distinto de editar
`assigned_to` con el `PUT /leads` genérico: tiene permisos propios, avisa y
deja constancia.

- **Permisos**: admin/owner/supervisor reparten cualquier lead; un agente sólo
  puede pasar uno que ya tenga asignado (`canSeeAll` de `role-rules`).
- **Ver y editar** (15-oct-2026): el agente sólo ve y toca sus leads, en el
  servidor; el `PUT /leads` le ignora `assigned_to`. Ver [[Dominio-Usuarios-Org]].
- **Aviso**: notificación in-app `kind='lead_assigned'` (la tabla ya tenía ese
  kind desde la migración 007) + email al agente con el link al lead, si la org
  tiene remitente configurado y el worker tiene `RESEND_API_KEY`. Los dos avisos
  son best-effort: si fallan, el lead queda delegado igual y la respuesta lo
  dice (`notified`, `emailed`, `emailSkipped`).
- **Constancia**: una `activity` de tipo `admin` sobre el lead ("Delegó el lead
  a X"), para que la ficha muestre por qué cambió de dueño. No hay tabla de
  auditoría: se eligió no sumar migración.
- **Automatizaciones**: la ruta emite el trigger `lead.assigned`, que estaba en
  el catálogo desde la migración 043 sin que ningún worker lo disparara.
- UI: botón "Delegar" en `/leads/[id]` → `components/leads/DelegateLeadModal`
  (agente + instrucción opcional que viaja en el aviso).
- Se arregló de paso la campana (`NotificationBell`): pegaba a `api-crm` cuando
  el endpoint vive en `api-admin` y esperaba `{notifications}` en vez de un
  array, así que nunca mostró nada.

Sin migración. Hay que deployar **api-crm**.

## Endpoints

[[API-crm]]:
- `GET/POST/PUT/DELETE /leads`
- `POST /leads/assign` — delegar a otro agente (ver arriba)
- `POST /leads/stage`
- `GET /stage-history?entity_type=lead&entity_id=...`

Captura pública: `POST /public/leads` en [[API-public]] (con `X-API-Key`).

## Formularios de Meta Lead Ads (19-oct-2026)

Los leads de los formularios instantáneos de Facebook/Instagram entran solos por el webhook
`leadgen`, en el **mismo** endpoint que la bandeja de Meta (`POST /public/inbox/meta` de [[API-public]],
firma `X-Hub-Signature-256`). Llegan en `entry[].changes[]` con sólo IDs; los datos se piden con
`GET /{leadgen_id}` usando el page access token de la org (`org_integrations`, provider `instagram`).

- Use case `IngestMetaLeadUseCase` (`core/.../use-cases/meta-leads/`), port `MetaLeadAdsGateway`,
  adapter `MetaLeadAdsHttp` (pide campaña y anuncio; si el token no tiene `ads_read`, reintenta sin eso).
- Dedup por `meta_lead_id` (Meta reintenta el webhook).
- Dueño = primer admin de la org, etapa `nuevo` — el reparto sigue siendo manual.
- `source` = `facebook` | `instagram` según `platform`; `source_detail` = nombre de la campaña (la clave con
  la que [[Dominio-Marketing]] cruza gasto y leads); las preguntas propias del formulario van a `notes`.
- Dispara `lead_created` de marketing (con el ID de Meta), webhook `lead.created` y automatizaciones.
- Cada cambio de etapa posterior le informa a Meta el `lead_id` (API de conversiones para CRM): el
  fallback de `SendMarketingEventUseCase` lo lee del lead.
- Los IDs llegan como número en el JSON; `protegerIdsLargosMeta` los pasa a string antes de parsear.
- Mapeo página → org: `config_json.account_id` o el nuevo `config_json.page_id` (cuando `account_id` es la
  cuenta de Instagram).

**Conectar la página** (desde 19-oct-2026): Configuración → Conexiones → **Facebook e Instagram**
(`/configuracion/conexiones/meta`). El admin pega el token de un usuario del sistema del Business Manager;
`ConnectMetaPageUseCase` lista sus páginas (`GET /me/accounts`), toma el **page token** de la elegida, la
suscribe a `leadgen` (`POST /{page}/subscribed_apps`) y guarda el page token cifrado + `page_id`/`page_name`
en `org_integrations` (provider `instagram`, conserva la config de la bandeja). El token pegado no se guarda.
Rutas `GET /integrations/meta` y `POST /integrations/meta/connect` en [[API-crm]] (sólo admin/owner).

**Configuración en Meta (hecha 19-oct-2026 para Marcela)**: app "Asistente IA Inmobiliaria"
(985484797782300) con el caso de uso de clientes potenciales; webhook del objeto Page apuntando a
`/public/inbox/meta` con el campo `leadgen` suscrito. `META_APP_SECRET` y `META_VERIFY_TOKEN` son secrets del
repo que el deploy de api-public sincroniza. La app tiene que estar **publicada** para recibir leads reales
(política en `/privacidad`). Usar un usuario del sistema propio ("VendéPro"), no el del bot de n8n.

## Frontend

- `/leads` (kanban + tabla, drag-drop entre stages)
- `/leads/[id]` (detalle, editar, historial, tags, next step)
- Componentes IA: `AIChatPanel`, `AIFloatingButton` (asociados a leads)

## Relacionados

- [[Dominio-Contactos]] (cada lead crea/usa un contact)
- [[Dominio-Tags]]
- [[Dominio-Actividades]] (actividades pueden linkear lead_id)
- [[Dominio-Calendario]] (eventos pueden linkear lead_id)
- [[Dominio-Tasaciones]] (tasaciones nacen de un lead)
- [[Dominio-Marketing]] (cada cambio de stage puede disparar evento)
