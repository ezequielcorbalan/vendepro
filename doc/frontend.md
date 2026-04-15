# Frontend — Guía de navegación

## Estructura de `vendepro-frontend/`

```
vendepro-frontend/
├── src/
│   ├── app/
│   │   ├── (auth)/login/          # Login page
│   │   ├── (dashboard)/           # Todas las páginas autenticadas
│   │   │   ├── layout.tsx         # Shell: Sidebar + MobileHeader + auth check
│   │   │   ├── dashboard/         # KPIs + funnel + charts
│   │   │   ├── leads/             # Lista + detalle de leads
│   │   │   ├── contactos/         # Contactos
│   │   │   ├── actividades/       # Feed de actividades
│   │   │   ├── calendario/        # Calendario operacional
│   │   │   ├── tasaciones/        # Lista + nueva + detalle + editar
│   │   │   ├── propiedades/       # Lista + nueva + detalle + pipeline
│   │   │   ├── reservas/          # Reservas
│   │   │   ├── vendidas/          # Propiedades vendidas
│   │   │   ├── prefactibilidades/ # Nueva prefactibilidad
│   │   │   ├── perfil/            # Perfil + objetivos propios + config tasaciones
│   │   │   ├── configuracion/     # Config general + objetivos + tasación
│   │   │   └── admin/             # Agentes + auditoría + objetivos (solo admin)
│   │   ├── r/[slug]/              # Reporte público de propiedad
│   │   ├── t/[slug]/              # Tasación pública
│   │   ├── v/[slug]/              # Formulario visita público
│   │   ├── p/[slug]/              # Prefactibilidad pública
│   │   ├── terminos/              # Términos y condiciones
│   │   ├── globals.css            # Poppins + brand vars (#ff007c, #ff8017)
│   │   └── layout.tsx             # Root layout
│   ├── components/
│   │   ├── layout/                # Sidebar, MobileHeader, GlobalSearch, NotificationBell
│   │   ├── auth/                  # AuthProvider
│   │   └── ui/                    # Toast
│   ├── lib/
│   │   ├── api.ts                 # apiFetch(apiName, path, options) — cliente HTTP
│   │   ├── auth.ts                # getCurrentUser(), setCurrentUser(), logout()
│   │   ├── types.ts               # Tipos TypeScript compartidos
│   │   ├── crm-config.ts          # LEAD_STAGES, EVENT_TYPES, PROPERTY_STAGES, ROLES
│   │   └── utils.ts               # cn(), formatDate(), formatMoney()
│   └── middleware.ts              # Protección de rutas + redirección a /login
├── package.json                   # Next.js 15, React 18, TailwindCSS 4, Recharts
└── next.config.ts

```

## Cómo hacer fetch a las APIs

```typescript
import { apiFetch } from '@/lib/api'

// En un Client Component:
const res = await apiFetch('crm', '/leads', { method: 'GET' })
const data = (await res.json()) as any

// Con body:
const res = await apiFetch('crm', '/leads', {
  method: 'POST',
  body: JSON.stringify({ name, phone, source }),
})
```

Las 8 APIs disponibles: `auth`, `crm`, `properties`, `transactions`, `analytics`, `ai`, `admin`, `public`

## Reglas del frontend

- Todas las páginas interactivas: `'use client'` al principio
- Todo `await res.json()` debe castearse: `(await res.json()) as any`
- Nunca `fetch('/api/...')` — siempre `apiFetch(apiName, path)`
- Colores: `[#ff007c]` (pink), `[#ff8017]` (orange) — Tailwind inline
- Siempre manejar loading, empty y error states
- Mobile-first: leads, actividades, calendario, tasaciones, contactos
- Desktop-first: dashboard, reportes, admin

## Auth flow

1. Login → POST `apiFetch('auth', '/login')` → recibe `token` + `user`
2. Guarda token en `localStorage` (`vendepro_token`) y cookie (`vendepro_token`)
3. Middleware lee la cookie para proteger rutas SSR
4. `getCurrentUser()` lee desde `localStorage` en client components
5. Logout → `clearToken()` + borra cookie + redirect `/login`

## Variables de entorno (Cloudflare Pages)

```
NEXT_PUBLIC_API_AUTH_URL         = https://auth.api.vendepro.com.ar
NEXT_PUBLIC_API_CRM_URL          = https://crm.api.vendepro.com.ar
NEXT_PUBLIC_API_PROPERTIES_URL   = https://properties.api.vendepro.com.ar
NEXT_PUBLIC_API_TRANSACTIONS_URL = https://transactions.api.vendepro.com.ar
NEXT_PUBLIC_API_ANALYTICS_URL    = https://analytics.api.vendepro.com.ar
NEXT_PUBLIC_API_AI_URL           = https://ai.api.vendepro.com.ar
NEXT_PUBLIC_API_ADMIN_URL        = https://admin.api.vendepro.com.ar
NEXT_PUBLIC_API_PUBLIC_URL       = https://public.api.vendepro.com.ar
NODE_VERSION                     = 20
```

Ya tienen defaults hardcodeados en `lib/api.ts`, pero conviene setearlos en CF Pages para poder cambiarlos sin redeploy.
