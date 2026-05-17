# 🏛️ Arquitectura

VendéPro es un sistema **multi-tenant** con arquitectura **hexagonal** (Ports & Adapters) en el backend y un frontend desacoplado que consume las APIs por HTTP.

## Diagrama de alto nivel

```
Browser / Mobile
      │
      ▼
vendepro-frontend (Next.js 15 / Cloudflare Pages)
      │  fetch con JWT Bearer
      ├── auth.api.vendepro.com.ar         [[API-auth]]
      ├── crm.api.vendepro.com.ar          [[API-crm]]
      ├── properties.api.vendepro.com.ar   [[API-properties]]
      ├── transactions.api.vendepro.com.ar [[API-transactions]]
      ├── analytics.api.vendepro.com.ar    [[API-analytics]]
      ├── ai.api.vendepro.com.ar           [[API-ai]]
      ├── admin.api.vendepro.com.ar        [[API-admin]]
      └── public.api.vendepro.com.ar       [[API-public]] (sin auth)
              │
              ▼
    Cloudflare D1   (vendepro-db, 51 tablas)
    Cloudflare R2   (vendepro-assets — fotos, PDFs, logos)
    Servicios externos: Anthropic, Groq, Meta CAPI, GA4 MP
```

## Capas hexagonales del backend

```
PRESENTATION    Hono routes        → parsean HTTP, llaman use cases
APPLICATION     Use cases (~200)   → orquestan dominio + repos
                Ports (33 repos + 10 services) → interfaces (contratos)
DOMAIN          Entities (~38)     → lógica de negocio pura
                Value Objects (12) → LeadStage, Money, Email, etc.
                Rules (6)          → reglas de negocio agrupadas
INFRASTRUCTURE  D1 repos (32)      → adaptadores de repositorios
                Services (14)      → JWT, Groq, Anthropic, R2, CF Browser, GA4, Meta
                Middleware (3)     → auth, cors, error-handler
```

**Regla de oro**: capas internas NUNCA importan de externas. El dominio no sabe que existe D1 ni Hono ni Cloudflare.

## Packages compartidos del backend

| Package | Contenido |
|---------|-----------|
| `@vendepro/core` | Domain + Application (entities, use cases, ports) |
| `@vendepro/infrastructure` | D1 repos, JWT, R2, AI services, middleware Hono |

Cada uno de los 8 workers API depende de ambos. Ver [[Backend-overview]].

## Pipeline comercial (resumido)

```
lead → asignado → contactado → calificado → en_tasacion → presentada → captado
                                                                       ↘ perdido
```

Cada cambio de etapa se loguea en `stage_history`. Detalles en [[Dominio-Leads]] y [[Dominio-Tasaciones]].

```
property: captada → documentacion → publicada → reservada → vendida
                                              ↘ suspendida ↘ vencida
```

```
reservation: reservada → boleto → escritura → entregada
                       ↘ cancelada ↘ rechazada
```

## Multi-tenancy

- Toda entidad tiene `org_id` que apunta a `organizations`
- Toda consulta D1 filtra por `org_id` (excepto rutas públicas)
- El JWT incluye `org_id` y el middleware de auth lo setea en `c.set('orgId', ...)`
- Por ahora hay una org real: `org_mg` (Marcela Genta), pero el sistema está preparado para white-label

## Convenciones de IDs

- IDs en TEXT (no AUTOINCREMENT, salvo catálogos)
- Generados con `crypto.randomBytes` hex (port: `IdGeneratorPort`)
- Convención de prefijos: `ct_` para contacts, etc. (no estricto)

## Convenciones de fechas

- Storage: TEXT ISO en UTC (SQLite `datetime('now')`)
- Display: hora local Argentina (UTC-3)
