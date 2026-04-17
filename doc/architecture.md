# Arquitectura — VendéPro

## Visión general

```
Browser / Mobile
      │
      ▼
vendepro-frontend/          Next.js 15 en Cloudflare Pages (vendepro.com.ar)
      │  fetch con JWT Bearer
      ├── auth.api.vendepro.com.ar        vendepro-api-auth
      ├── crm.api.vendepro.com.ar         vendepro-api-crm
      ├── properties.api.vendepro.com.ar  vendepro-api-properties
      ├── transactions.api.vendepro.com.ar vendepro-api-transactions
      ├── analytics.api.vendepro.com.ar   vendepro-api-analytics
      ├── ai.api.vendepro.com.ar          vendepro-api-ai
      ├── admin.api.vendepro.com.ar       vendepro-api-admin
      └── public.api.vendepro.com.ar      vendepro-api-public (sin auth)
              │
              ▼
    Cloudflare D1 (vendepro-db)      ← todos comparten la misma DB
    Cloudflare R2 (reportes-mg-assets) ← todos comparten el mismo bucket
```

## Arquitectura hexagonal (backend)

```
PRESENTATION   Hono routes  →  parsean HTTP, llaman use cases
APPLICATION    Use cases    →  orquestan dominio + repos
               Ports        →  interfaces (contratos) de repos y servicios
DOMAIN         Entities     →  lógica de negocio pura, sin dependencias
               Value Objects →  LeadStage, PropertyStage, Money, Email
               Rules        →  lead-rules, property-rules, role-rules
INFRASTRUCTURE D1 repos     →  implementan los ports con SQLite
               Services     →  JWT, Groq, Anthropic, R2, Google Calendar
```

**Regla de oro**: capas internas NUNCA importan de externas. El dominio no sabe que existe D1 ni Hono.

## Packages compartidos

| Package | Descripción |
|---------|-------------|
| `@vendepro/core` | Domain + Application (entities, use cases, ports) |
| `@vendepro/infrastructure` | D1 repos, JWT service, R2, middleware Hono |

## APIs y responsabilidades

| API | Puerto local | Responsabilidad |
|-----|-------------|-----------------|
| `api-auth` | 8701 | Login, logout, cambio de contraseña, Google OAuth |
| `api-crm` | 8702 | Leads, contactos, actividades, calendario, tags |
| `api-properties` | 8703 | Propiedades, reportes, tasaciones, fichas, prefact, media |
| `api-transactions` | 8704 | Reservas, ventas |
| `api-analytics` | 8705 | Dashboard, stats, search, export |
| `api-ai` | 8706 | Groq (transcripción), Anthropic (extracción) |
| `api-admin` | 8707 | Agentes, objetivos, branding, template blocks, auditoría |
| `api-public` | 8708 | Rutas públicas sin auth (reportes, tasaciones, fichas, prefact) |

## Pipeline comercial

```
lead → asignado → contactado → calificado → en_tasacion → presentada → captado
                                                                      ↘ perdido
```

Cada cambio de etapa se loguea en `stage_history`.

## Deploy

- Push a `main` con cambios en un package → dispara solo ese workflow
- Push a `main` con cambios en `core/` o `infrastructure/` → disparan los 8 en paralelo
- Los tests siempre corren antes del deploy
