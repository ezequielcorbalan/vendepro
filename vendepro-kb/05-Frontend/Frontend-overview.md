# 🎨 Frontend Overview

Next.js 15 (App Router) con TypeScript, TailwindCSS 4, deploy en Cloudflare Pages vía `@opennextjs/cloudflare`.

## Path

`vendepro-frontend/`

## Estructura

```
vendepro-frontend/
├── src/
│   ├── app/
│   │   ├── (auth)/                # rutas de login, register, reset (sin sidebar)
│   │   ├── (dashboard)/           # rutas autenticadas (con sidebar)
│   │   ├── l/[slug]/              # landings públicas
│   │   ├── r/[slug]/              # reportes públicos
│   │   ├── t/[slug]/              # tasaciones públicas
│   │   ├── v/[slug]/              # formularios de visita públicos
│   │   ├── p/[slug]/              # prefactibilidades públicas
│   │   ├── terminos/
│   │   ├── layout.tsx             # root layout
│   │   ├── page.tsx               # redirect a /dashboard o /login
│   │   └── globals.css
│   ├── components/
│   │   ├── auth/                  # AuthProvider
│   │   ├── layout/                # Sidebar, MobileHeader, GlobalSearch, NotificationBell
│   │   ├── ui/                    # Toast, PhotoGallery, ContactSelector, PropertySelector
│   │   ├── ai/                    # AIChatPanel, AIFloatingButton
│   │   ├── properties/            # widgets de detail (autorización, docs, price-history, etc.)
│   │   ├── reports/               # tablas, badges, diagnosis card
│   │   ├── marketing/             # GtmScript, dataLayer
│   │   ├── landings/              # editor + renderer + admin + public
│   │   ├── tasaciones/            # editor + renderer + admin + legacy
│   │   └── onboarding/            # wizard inicial
│   ├── lib/
│   │   ├── api.ts                 # apiFetch + serverFetch + APIS
│   │   ├── auth.ts                # currentUser localStorage
│   │   ├── auth-server.ts         # cookie reader SSR
│   │   ├── types.ts               # tipos compartidos
│   │   ├── crm-config.ts          # LEAD_STAGES, EVENT_TYPES, etc.
│   │   ├── property-config.ts     # catálogos dinámicos
│   │   ├── nav-config.ts          # menú del sidebar
│   │   ├── utils.ts               # slugify, formatDate, formatCurrency, cn
│   │   ├── semaforo.ts            # health status
│   │   └── landings/              # api.ts + types.ts + slug.ts + tracker.ts + public-api.ts
│   └── middleware.ts              # auth + subdomain routing
├── package.json
└── next.config.ts
```

## Patrón general

- **Server Components por default**. `'use client'` solo si hay hooks/interactividad.
- **Casi todas las páginas son client** porque hacen `apiFetch` y usan state.
- **Sin store global**: `useState` + lifting + Context (Toast, Auth).
- **Sin React Query**: fetch directo con `apiFetch`.

## Patrón de fetch

```typescript
'use client'
import { apiFetch } from '@/lib/api'

const res = await apiFetch('crm', '/leads', { method: 'GET' })
const data = (await res.json()) as any  // SIEMPRE cast as any
```

`apiName` ∈ `auth | crm | properties | transactions | analytics | ai | admin | public`. Ver [[Frontend-lib]].

## Rutas (resumen)

Ver mapa completo en [[Frontend-rutas]]. Resumen:

- 4 rutas `(auth)`: login, register, forgot/reset
- ~40 rutas `(dashboard)`: dashboard, leads, contactos, actividades, calendario, tasaciones, propiedades, reportes, reservas, vendidas, alquiladas, fichas, landings, prefactibilidades, marketing, configuración, perfil, admin
- 5 rutas públicas dinámicas: `/l`, `/r`, `/t`, `/v`, `/p`
- 1 pública estática: `/terminos`

## Componentes destacados

Ver [[Frontend-componentes]]. Áreas grandes:
- `components/landings/` — builder visual (50+ archivos)
- `components/tasaciones/` — editor + renderer + admin de templates (40+ archivos)
- `components/onboarding/` — wizard 8 pasos
- `components/reports/` — tablas y badges
- `components/ai/` — chat panel + floating button

## Auth flow (resumido)

Ver [[Frontend-auth-flow]].

1. `/login` → POST `apiFetch('auth', '/login')`
2. localStorage `vendepro_token` + cookie `vendepro_token` (30 días)
3. Middleware Next protege rutas via cookie
4. `getCurrentUser()` para client, `getCurrentUserServer()` para SSR

## Tooling

- Tests: Vitest + `@testing-library/react` + jsdom
- Build: `next build` → `opennextjs-cloudflare build` (genera `.open-next/`)
- Deploy: push a `vendepro-frontend/**` en main → Cloudflare Pages auto-build (ver [[Deploy]])

## Convenciones críticas

Ver [[Reglas-criticas]]:
- `(await res.json()) as any` siempre
- Nunca `fetch('/api/...')` — siempre `apiFetch`
- Colors inline `[#ff007c]`, `[#ff8017]`
- Loading/empty/error states siempre
- Imports específicos, no barrel
