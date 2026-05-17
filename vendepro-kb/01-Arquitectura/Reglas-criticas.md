# ⚠️ Reglas críticas

Reglas que vienen de `CLAUDE.md` + `.claude/rules/` + convenciones observadas. **No cambiar sin avisar.**

## Recursos Cloudflare protegidos

- ❌ Nunca renombrar `vendepro-db` (D1, ID `45d18f94-807b-466f-8742-32bbc61fc7fb`)
- ❌ Nunca tocar `reportes-mg-db` (D1 legacy, deprecada)
- ❌ Nunca rotar el JWT salt `reportes-mg-salt-2026` (invalida todas las passwords)
- ❌ Nunca borrar bucket R2 `reportes-mg-assets` (legacy) ni `vendepro-assets`

## Deploys

- ❌ **NUNCA hacer deploys desde la terminal**. Todos los deploys van por:
  - **Backend (workers)**: GitHub Actions (un workflow por API)
  - **Frontend**: Cloudflare Pages (push a `vendepro-frontend/` en main)
  - **Migrations**: workflow `migrate.yml` al pushear `migrations_v2/**` a main
  - **Casos especiales**: Cloudflare Dashboard
- Tests SIEMPRE deben pasar antes de mergear a main
- Ver [[Deploy]] para flujo completo

## Auth & seguridad

- Custom auth: SHA-256 + salt + JWT (cookie `vendepro_token` + localStorage)
- Toda API route checa Bearer JWT vía middleware (excepto api-public y `/api-public/photo/*`)
- Filtrar por `org_id` en TODA query D1
- Roles: `owner > admin > supervisor > agent`
- Nunca confiar en role del cliente — siempre validar contra DB

## Reglas de negocio del CRM

- Lead debe asignarse **el mismo día**
- Lead debe contactarse en **24h**
- Lead sin respuesta **7 días** → perdido (regla automática `lead-rules.ts`)
- Tasación no termina en "presentada" → seguir hasta `captado` o `perdido`
- Propiedad no se publica sin documentos críticos
- Eventos de calendario deben linkearse a entidades CRM (lead/contact/property/appraisal/reservation)
- Cambios de stage SIEMPRE se loguean en `stage_history`

## Ingeniería — Backend

- Capas internas no importan de externas (hexagonal estricto)
- IDs en TEXT con `crypto.randomBytes` hex
- Fechas en UTC, display Argentina (UTC-3)
- Use case ≠ route. Route parsea HTTP, use case orquesta dominio.
- Errores de dominio extienden `DomainError` con `code` + `httpStatus`

## Ingeniería — Frontend

- Server Components por defecto. `'use client'` solo si hay hooks/interactividad.
- **TODO `await res.json()` debe castearse**: `(await res.json()) as any`
- Nunca `fetch('/api/...')` — siempre `apiFetch(apiName, path)` (ver [[Frontend-lib]])
- Sin barrel imports. Imports nombrados específicos (especialmente `lucide-react`)
- Colores hardcoded inline: `[#ff007c]`, `[#ff8017]`
- Toda página maneja loading / empty / error states
- Tamaño preferido: **<300 líneas por archivo**
- Naming: kebab-case para rutas, PascalCase para componentes

## Responsive (custom para VendéPro)

- **Mobile-first**: leads, actividades, calendario, contactos, **landing pública de tasaciones**
- **Desktop-first**: dashboards, reportes, admin, **creación de tasaciones**
- Diferencia importante: tasaciones se CREAN en desktop pero se MUESTRAN en mobile

## Convenciones de commits/PRs

- 1 PR = 1 feature acotado, no mezclar refactors con hotfixes
- Tests deben pasar antes de mergear
- En scopes chicos (<5 archivos con diseño ya alineado en chat) se va directo a editar sin spec previo
