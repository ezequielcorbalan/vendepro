# Mejoras a la API de integración — migración emBlue → VendéPro

> Preparado el 02-jul-2026. Contexto: los flujos de n8n que hoy apuntan a emBlue pasan a
> VendéPro (leads) y Resend (emails). KiteProp y OneTalk siguen operativos.

## Resumen ejecutivo

La API actual (`POST /v1/leads` con Bearer JWT) ya permite importar leads y dispara el evento
de marketing `lead_created` a Meta CAPI / GA4. Para reemplazar completamente a emBlue faltan
**4 capacidades**, en este orden de prioridad:

| # | Mejora | Prioridad | Por qué |
|---|--------|-----------|---------|
| 1 | Sistema de tags | **P1 — Bloqueante** | emBlue segmentaba con tags (origen + seguimiento). Sin esto, los leads importados llegan sin clasificar. |
| 2 | Deduplicación en import | **P1 — Bloqueante** | Hoy cada consulta repetida crea lead y contacto duplicados. emBlue deduplicaba por email. |
| 3 | Webhooks salientes | **P2 — Alta** | n8n necesita enterarse de eventos (lead nuevo, cambio de etapa) para mandar emails por Resend y avisos por OneTalk. |
| 4 | Campos extendidos en `/v1/leads` | **P3 — Deseable** | Las consultas de ZonaProp traen datos de la propiedad que hoy solo entran como texto en `notes`. |

---

## 1. Sistema de tags (P1)

**Uso real:** tags de *origen* (`zonaprop`, `tasacion-web`, `meta-ads`, `referido`) asignados
automáticamente por n8n al importar, y tags de *seguimiento* (`contactado`, `no-responde`,
`interesado`) asignados a mano por el equipo en el CRM.

### Modelo de datos

```sql
-- migrations_v2/0XX_tags.sql
CREATE TABLE tags (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL,
  name       TEXT NOT NULL,           -- slug normalizado: "zonaprop"
  label      TEXT,                    -- display: "ZonaProp"
  color      TEXT,                    -- hex opcional para el chip
  created_at TEXT, updated_at TEXT,
  UNIQUE(org_id, name)
);

CREATE TABLE lead_tags (
  lead_id    TEXT NOT NULL,
  tag_id     TEXT NOT NULL,
  created_at TEXT,
  PRIMARY KEY (lead_id, tag_id)
);
```

### Cambios en la API pública (`/v1/leads`)

- Aceptar campo opcional `tags: string[]` por lead.
- Normalizar cada tag a slug (minúsculas, sin acentos, espacios → guiones).
- **Auto-crear** el tag si no existe en la org (upsert por `UNIQUE(org_id, name)`) —
  n8n no debe fallar por un tag nuevo.
- Un tag inválido no aborta el lead ni el lote (misma filosofía por-item del import actual).

### Endpoints CRM (sesión de usuario)

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/tags` | GET | Lista tags de la org con conteo de uso |
| `/tags` | POST | Crear tag (name, label, color) |
| `/tags/:id` | DELETE | Eliminar tag (y sus vínculos) |
| `/leads/:id/tags` | PUT | Reemplaza el set de tags del lead |
| `/leads?tag=X` | GET | Filtro por tag en el listado existente |

### UI mínima

- Chips de tags en la card y el detalle del lead, con agregar/quitar inline.
- Filtro por tag en el listado y kanban de leads.

---

## 2. Deduplicación en el import (P1)

**Problema hoy:** `ImportLeadsUseCase` llama siempre a `CreateLeadWithContactUseCase` con
`contact_data`, que crea un contacto nuevo en cada import. La misma persona consultando dos
propiedades genera dos contactos.

### Comportamiento propuesto

- Antes de crear el contacto, buscar en la org por **email normalizado** (lowercase/trim) y
  si no hay match, por **teléfono normalizado** (solo dígitos, comparar por sufijo de 10 para
  tolerar +54 9).
- Si hay match: **reutilizar el contacto** (pasar `contact_id` en vez de `contact_data`) y
  crear el lead nuevo vinculado a él. El historial de la persona queda unificado.
- Si además el contacto ya tiene un lead *abierto* (etapa no terminal) con el mismo
  `source_detail`, no duplicar el lead: agregar la consulta como nota y devolver
  `duplicate: true` con el id existente.
- Respuesta por item extendida:
  `{ index, ok, id, contact_id, deduped: boolean, duplicate: boolean }`.

---

## 3. Webhooks salientes (P2) — ✅ IMPLEMENTADO (03-jul-2026)

**Para qué:** n8n manda el email de bienvenida por Resend y el aviso al equipo por OneTalk
cuando entra un lead, y reacciona a cambios de etapa (ej. tasación agendada). Hoy VendéPro no
tiene forma de avisar hacia afuera; es el reemplazo del rol "disparador" que cumplía emBlue.

> Implementación: migración `032_webhooks.sql` (tablas `webhooks` + `webhook_deliveries`),
> ABM en api-crm (`/webhooks`, sólo admin) + `POST /webhooks/:id/test` + log de entregas,
> dispatcher `fireWebhookEvent` en infrastructure (HMAC-SHA256, 1 retry ante 5xx/timeout).
> Eventos cableados: `lead.created` (api-crm manual, api-public `/v1/leads` y `/public/leads`),
> `lead.stage_changed` (api-crm) y `appraisal.created` (api-properties).
> UI: Configuración → Configuración de API → pestaña Webhooks.

### Modelo de datos

```sql
CREATE TABLE webhooks (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL,
  url        TEXT NOT NULL,
  secret     TEXT NOT NULL,           -- para firma HMAC
  events     TEXT NOT NULL,           -- CSV: "lead.created,lead.stage_changed"
  is_active  INTEGER DEFAULT 1,
  created_at TEXT, updated_at TEXT
);
```

### Eventos iniciales

| Evento | Cuándo dispara | Payload clave |
|--------|----------------|---------------|
| `lead.created` | Alta de lead (API, web pública o manual) | lead completo + tags + contact |
| `lead.stage_changed` | Cambio de etapa (ya se registra en stage_history) | lead, from_stage, to_stage |
| `appraisal.created` | Alta de tasación | appraisal + contact |

### Requisitos de entrega

- POST JSON con header `X-VendePro-Signature: sha256=HMAC(secret, body)`.
- Disparo no bloqueante (mismo patrón `Promise.allSettled` que el hook de marketing actual —
  se puede reutilizar la infraestructura de `fireMarketingEvent`).
- Reintento simple: 1 retry ante 5xx/timeout. Log de entregas (como el event-log de marketing).
- ABM de webhooks en Configuración (admin), igual que los tokens de API.

---

## 4. Campos extendidos en `/v1/leads` (P3)

El dominio ya soporta estos campos (`CreateLeadWithContactInput`); solo hay que exponerlos en
el endpoint público y pasarlos al use case:

| Campo | Tipo | Ejemplo (consulta ZonaProp) |
|-------|------|------------------------------|
| `property_address` | string | "Av. Cabildo 2345, 3ºB" |
| `neighborhood` | string | "Belgrano" |
| `property_type` | string | "departamento" |
| `budget` | number | 185000 |
| `estimated_value` | number | 190000 |
| `timing` | string | "inmediato" |

---

## Ejemplo del request final (n8n → VendéPro)

```http
POST https://public.api.vendepro.com.ar/v1/leads
Authorization: Bearer <token de integración>
Content-Type: application/json

{
  "full_name": "Juan Pérez",
  "email": "juan@gmail.com",
  "phone": "+54 9 11 5555-1234",
  "operation": "venta",
  "source_detail": "zonaprop",
  "tags": ["zonaprop", "consulta-propiedad"],
  "property_address": "Av. Cabildo 2345, 3ºB",
  "neighborhood": "Belgrano",
  "notes": "Consultó por la publicación #12345678"
}
```

Respuesta esperada:

```json
{
  "ok": true, "created": 1, "failed": 0,
  "results": [{ "index": 0, "ok": true, "id": "…", "contact_id": "…", "deduped": false }]
}
```

## Criterios de aceptación

- [ ] Importar el mismo lead dos veces (mismo email) reutiliza el contacto y no crea duplicados.
- [ ] Un import con `tags: ["nuevo-portal"]` crea el tag automáticamente y queda visible y
      filtrable en el CRM.
- [ ] Al crear un lead por API, el webhook `lead.created` llega a la URL configurada con firma
      HMAC válida, sin demorar la respuesta del import.
- [ ] Un lead inválido dentro de un lote sigue sin abortar el resto (comportamiento actual preservado).
- [ ] Los tokens existentes siguen funcionando sin cambios (los campos nuevos son opcionales).
- [ ] Tests de smoke actualizados (`api-tokens.smoke.test.ts`) cubriendo tags y dedup.

## Fuera de alcance (lo resuelve n8n)

- Envío de emails (Resend) — n8n los dispara al recibir el webhook.
- Mensajería OneTalk — ídem.
- Parseo de los emails de ZonaProp — sigue siendo el nodo Code de n8n.
- Conversiones Meta CAPI — ya cubierto por la integración de marketing existente.

## Referencias de código

- `vendepro-backend/packages/api-public/src/index.ts` — endpoint `/v1/leads`
- `vendepro-backend/packages/core/src/application/use-cases/api-tokens/import-leads.ts` — import
- `vendepro-backend/packages/core/src/application/use-cases/leads/create-lead-with-contact.ts` — creación
- `vendepro-backend/migrations_v2/031_api_tokens.sql` — patrón de migración
