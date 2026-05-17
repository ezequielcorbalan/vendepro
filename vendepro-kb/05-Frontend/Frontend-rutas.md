# 🗺️ Mapa de rutas — Frontend

Todas las rutas de `src/app/`. Convenciones:
- **C** = Client component (`'use client'`)
- **S** = Server component
- Layouts mostrados solo si son destacados.

## `(auth)/` — sin sidebar

| URL | Archivo | Tipo | Propósito |
|---|---|---|---|
| `/login` | `(auth)/login/page.tsx` | C | Login email+password → `apiFetch('auth', '/login')` |
| `/register` | `(auth)/register/page.tsx` | C | Registro |
| `/forgot-password` | `(auth)/forgot-password/page.tsx` | C | Solicitar reset |
| `/reset-password` | `(auth)/reset-password/page.tsx` | C | Completar reset con token |

Layout: `(auth)/layout.tsx` (sin sidebar).

## `(dashboard)/` — autenticadas

Layout: `(dashboard)/layout.tsx` (Server, valida cookie con `getCurrentUserServer`, monta `Sidebar` + `MobileHeader` + `AIFloatingButton` + `ToastProvider`).

### Dashboard / Performance

| URL | Archivo | Tipo | API |
|---|---|---|---|
| `/dashboard` | `dashboard/page.tsx` | C | crm, analytics |
| `/dashboard/mi-performance` | `dashboard/mi-performance/page.tsx` | C | analytics |
| `/mi-performance` | `mi-performance/page.tsx` | C | analytics (alias) |

### [[Dominio-Leads|Leads]]

| URL | Archivo | Tipo |
|---|---|---|
| `/leads` | `leads/page.tsx` | C — kanban + tabla |
| `/leads/[id]` | `leads/[id]/page.tsx` | C — detalle |

### [[Dominio-Contactos|Contactos]]

| URL | Archivo | Tipo |
|---|---|---|
| `/contactos` | `contactos/page.tsx` | C |
| `/contactos/[id]` | `contactos/[id]/page.tsx` | C |

### [[Dominio-Actividades|Actividades]] / [[Dominio-Calendario|Calendario]]

| URL | Archivo | Tipo |
|---|---|---|
| `/actividades` | `actividades/page.tsx` | C |
| `/calendario` | `calendario/page.tsx` | C |

### [[Dominio-Tasaciones|Tasaciones]]

| URL | Archivo | Tipo |
|---|---|---|
| `/tasaciones` | `tasaciones/page.tsx` | C |
| `/tasaciones/nueva` | `tasaciones/nueva/page.tsx` | C — wizard |
| `/tasaciones/[id]` | `tasaciones/[id]/page.tsx` | C — preview |
| `/tasaciones/[id]/editar` | `tasaciones/[id]/editar/page.tsx` | C — editor de bloques |

### [[Dominio-Propiedades|Propiedades]]

| URL | Archivo | Tipo |
|---|---|---|
| `/propiedades` | `propiedades/page.tsx` | C |
| `/propiedades/nueva` | `propiedades/nueva/page.tsx` | C |
| `/propiedades/[id]` | `propiedades/[id]/page.tsx` | C |
| `/propiedades/[id]/editar` | `propiedades/[id]/editar/page.tsx` | C |
| `/propiedades/[id]/reportes` | `propiedades/[id]/reportes/page.tsx` | C |
| `/propiedades/[id]/reportes/nuevo` | `propiedades/[id]/reportes/nuevo/page.tsx` | C |
| `/propiedades/pipeline` | `propiedades/pipeline/page.tsx` | C — kanban |

### [[Dominio-Reportes|Reportes]]

| URL | Archivo | Tipo |
|---|---|---|
| `/reportes` | `reportes/page.tsx` | C — hub |
| `/reportes/listado` | `reportes/listado/page.tsx` | C — tabla ordenable |
| `/reportes/performance` | `reportes/performance/page.tsx` | C — performance de agentes |

### [[Dominio-Reservas|Reservas]] / Status

| URL | Archivo |
|---|---|
| `/reservas` | `reservas/page.tsx` |
| `/vendidas` | `vendidas/page.tsx` |
| `/alquiladas` | `alquiladas/page.tsx` |

### Fichas (legacy)

| URL | Archivo |
|---|---|
| `/fichas/nueva` | `fichas/nueva/page.tsx` |
| `/fichas/[id]` | `fichas/[id]/page.tsx` |

### [[Dominio-Landings|Landings]]

| URL | Archivo | Tipo |
|---|---|---|
| `/landings` | `landings/page.tsx` | C — lista |
| `/landings/[id]` | `landings/[id]/page.tsx` | C — editor |
| `/landings/[id]/preview` | `landings/[id]/preview/page.tsx` | C — preview pública |

### [[Dominio-Prefactibilidades|Prefactibilidades]]

| URL | Archivo |
|---|---|
| `/prefactibilidades` | `prefactibilidades/page.tsx` |
| `/prefactibilidades/nueva` | `prefactibilidades/nueva/page.tsx` |

### [[Dominio-Marketing|Marketing]]

| URL | Archivo |
|---|---|
| `/marketing` | `marketing/page.tsx` |
| `/configuracion/marketing` | `configuracion/marketing/page.tsx` |

### Configuración / Perfil

| URL | Archivo |
|---|---|
| `/configuracion` | `configuracion/page.tsx` |
| `/configuracion/objetivos` | `configuracion/objetivos/page.tsx` |
| `/configuracion/tasacion` | `configuracion/tasacion/page.tsx` |
| `/configuracion/tasacion/templates/[id]` | `configuracion/tasacion/templates/[id]/page.tsx` |
| `/perfil` | `perfil/page.tsx` |
| `/perfil/tasaciones` | `perfil/tasaciones/page.tsx` |
| `/perfil/objetivos` | `perfil/objetivos/page.tsx` |

### Admin

| URL | Archivo | Acceso |
|---|---|---|
| `/admin/agentes` | `admin/agentes/page.tsx` | owner/admin |
| `/admin/agentes/nuevo` | `admin/agentes/nuevo/page.tsx` | owner/admin |
| `/admin/auditoria` | `admin/auditoria/page.tsx` | owner/admin |
| `/admin/objetivos` | `admin/objetivos/page.tsx` | owner/admin/supervisor |

## Rutas públicas (sin auth)

| URL | Archivo | Consume | Propósito |
|---|---|---|---|
| `/l/[slug]` | `l/[slug]/page.tsx` | [[API-public]] | Landing pública |
| `/r/[slug]` | `r/[slug]/page.tsx` | [[API-public]] | Reporte de propiedad |
| `/t/[slug]` | `t/[slug]/page.tsx` | [[API-public]] | Tasación |
| `/v/[slug]` | `v/[slug]/page.tsx` + `VisitFormClient.tsx` | [[API-public]] | Formulario visita |
| `/p/[slug]` | `p/[slug]/page.tsx` | [[API-public]] | Prefactibilidad |
| `/terminos` | `terminos/page.tsx` | — | Estática |

Soporte: `l/[slug]/loading.tsx`, `not-found.tsx`.

## Middleware (`src/middleware.ts`)

- Rewriting de subdominios `*.landings.vendepro.com.ar` → `/l/[slug]`
- Rutas siempre públicas (no chequea cookie): `/login`, `/register`, `/terminos`, `/r/*`, `/t/*`, `/v/*`, `/p/*`, `/l/*`, `/_next`, `/api/`
- Sin cookie `vendepro_token` → redirect a `/login?redirect=<path>`

## Root

| URL | Archivo |
|---|---|
| `/` | `app/page.tsx` (Client, redirige según session) |

## Total

- **4** auth
- **~35** dashboard
- **5** públicas dinámicas
- **1** públicas estáticas
- = **~45 rutas**
