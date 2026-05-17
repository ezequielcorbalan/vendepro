# 📚 `lib/` — utilidades del frontend

Todos los helpers, types y config en `src/lib/`.

## `api.ts` — Cliente HTTP

```typescript
import { apiFetch, serverFetch, APIS, setToken, getToken, clearToken } from '@/lib/api'

type ApiName = 'auth' | 'crm' | 'properties' | 'transactions'
               | 'analytics' | 'ai' | 'admin' | 'public'

// Client (lee token de localStorage)
const res = await apiFetch('crm', '/leads', { method: 'GET' })

// Server (recibe cookie)
const res = await serverFetch('crm', '/leads', cookieHeader)
```

- `APIS` — map de URLs base por nombre (también lee de `process.env.NEXT_PUBLIC_API_X_URL` con fallback hardcoded)
- `apiFetch(api, path, options?)` — agrega `Authorization: Bearer <token>` automáticamente desde `localStorage.vendepro_token`
- `setToken(token)` / `getToken()` / `clearToken()` — token management

## `auth.ts` — Sesión client-side

```typescript
import { getCurrentUser, setCurrentUser, logout, type CurrentUser } from '@/lib/auth'
```

- `CurrentUser` type: `{ id, email, full_name, role, org_id, photo_url? }`
- `localStorage.vendepro_user` para data, `localStorage.vendepro_token` para JWT
- Helpers de onboarding: `isOnboardingDone(userId)`, `markOnboardingDone(userId)`, `resetOnboarding(userId)`

## `auth-server.ts` — Sesión SSR

- `getCurrentUserServer()` — lee cookie `vendepro_token`, decodifica payload JWT (sin verificar firma — eso lo hacen las APIs), valida `exp`. Retorna `CurrentUser | null`.
- Usado por `(dashboard)/layout.tsx` para redirigir si no hay sesión.

## `types.ts` — Tipos compartidos (~260 líneas)

Categorías de tipos exportados:

### User
- `Profile`, `CurrentUser`

### Propiedad
- `Property`, `PropertyStatus`, `PropertyType`, `PropertyStage`

### Reportes
- `Report`, `ReportMetric`, `ReportContent`, `ReportPhoto`

### Tasaciones
- `Appraisal`, `AppraisalStatus`, `TemplateBlock`

### Leads
- `Lead`, `LeadStage` (re-export de crm-config), `LeadTag`, `LeadUrgency`, `LeadActivity`

### Contactos
- `Contact`, `ContactLead`, `ContactProperty`

## `crm-config.ts` — Fuente única de verdad CRM (~290 líneas)

| Constante | Contenido |
|---|---|
| `LEAD_STAGES` | 9 stages: nuevo, asignado, contactado, calificado, en_tasacion, presentada, seguimiento, captado, perdido |
| `PROPERTY_STAGES` | 8 stages: captada, publicada, reservada, suspendida, vendida, vencida, archivada, documentacion |
| `ACTIVITY_TYPES` | 11 tipos (llamada, whatsapp, reunion, etc.) |
| `EVENT_TYPES` | 9 tipos para calendario (con color, icon, label) |
| `LEAD_SOURCES` | 11 (zonaprop, argenprop, mercadolibre, instagram, facebook, google, referido, cartel, telefono, manual, otro) |
| `OPERATION_TYPES` | 4 (venta, alquiler, tasacion, otro) |
| `DEFAULT_TAGS` | 4 (propietario, comprador, inversor, aliado) |
| `OBJECTIVE_METRICS` | 16 métricas |
| `OBJECTIVE_TEMPLATES` | 3 (keller, magnin, agenda) |
| `USER_ROLES` | 4 (owner, admin, supervisor, agent) con levels 4 → 1 |

Helpers:
- `getPipelineForTag(tagName)` — filtra stages según tipo de lead
- `scaleMetrics(template, factor)` — escala objetivos
- `getObjectiveSemaforo(progress)` — color por progreso
- `getPeriodProgressPct(start, end, now)`
- `getLeadChecklist(lead)` — checklist score
- `getLeadUrgency(lead)` — ok/warning/danger/lost

## `property-config.ts` — Catálogos dinámicos (backend)

```typescript
import { fetchPropertyConfig, getStage, getStatus, getOpType } from '@/lib/property-config'

const config = await fetchPropertyConfig()  // cacheado
const stage = getStage(config, opTypeId, slug)
```

- `OperationType`, `CommercialStage`, `PropertyStatus`, `PropertyConfig` interfaces
- `COLOR_CLASS`, `DOT_CLASS` — Tailwind class maps (10 colores hardcoded)
- Helpers: `stagesForType()`, `statusesForType()`, etc.

## `nav-config.ts` — Menú del sidebar

- `menuSections` — 3 secciones (Principal, CRM, Comercial) con 13 links
- `adminSection` — sección admin (2 links)
- `adminMobileLinks`, `agentMobileLinks` — variantes mobile

## `utils.ts`

- `slugify(text)` — URL slug
- `formatDate(date)` — es-AR
- `formatCurrency(amount, currency)` — USD o ARS
- `cn(...classes)` — className builder

## `semaforo.ts` — Health de publicaciones

- `HealthStatus` type: `red | orange | yellow | light_green | green`
- `HEALTH_COLORS` — map a colores Tailwind
- `healthStatusFromViewsPerDay(viewsPerDay)` — clasificación

## `landings/`

Submódulo específico para gestión de landings:

- **`api.ts`** — `landingsApi.{list, get, create, updateMetadata, updateBlocks, addBlock, removeBlock, reorderBlocks, toggleVisibility, listVersions, rollback, requestPublish, publish, rejectPublish, archive, unarchive, analytics}` + `templatesApi.list()` + `aiApi.editBlock()`
- **`types.ts`** — tipos de bloques con `BlockDataMap` (mapeo type → shape)
- **`slug.ts`** — helpers de slug
- **`tracker.ts`** — tracker analytics
- **`public-api.ts`** — API calls para landing pública (sin auth)

## Stack frontend (de `package.json`)

| Lib | Versión | Uso |
|---|---|---|
| next | ^15.5.14 | App Router |
| react | ^18.3.1 | |
| tailwindcss | ^4 | |
| lucide-react | ^0.577 | iconos (sin barrel imports) |
| recharts | ^3.8 | charts |
| @dnd-kit/core, sortable, utilities | ^6/^10/^3 | drag-drop kanban + builder |
| xlsx | ^0.18 | export Excel |
| vitest, @testing-library/react, jsdom | latest | tests |
| @opennextjs/cloudflare | latest | adapter Cloudflare Pages |
