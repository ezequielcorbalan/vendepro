# Diseño: Registro público de organizaciones

**Fecha:** 2026-04-15  
**Estado:** Aprobado  
**Autor:** Ezequiel Corbalan

---

## Resumen

Cualquier inmobiliaria puede registrarse en VendéPro de forma autónoma. Al registrarse, se crea una organización y el usuario registrante queda como `admin` de esa org. Luego puede crear usuarios adicionales desde el panel de administración existente (`/admin/agentes`).

---

## Arquitectura

### Enfoque elegido
Un único endpoint atómico `POST /register-org` que crea org + admin en una sola transacción D1. El wizard de 3 pasos es puramente UX — el POST ocurre al final del paso 2. El paso 3 (personalización) es opcional y usa el endpoint existente `PATCH /admin/org-settings` post-login.

### Flujo completo
```
/register (paso 1: org) 
  → (paso 2: cuenta) 
  → POST /register-org 
  → login automático (guarda token)
  → (paso 3: personalización, opcional)
  → PATCH /admin/org-settings (si completó paso 3)
  → /dashboard
```

---

## Backend

### Endpoint nuevo

**`POST /register-org`** en `api-auth` (sin autenticación)

Request body:
```json
{
  "org_name": "Marcela Genta Inmobiliaria",
  "org_slug": "marcela-genta",
  "admin_name": "Marcela Genta",
  "email": "marcela@example.com",
  "password": "minimo8chars",
  "logo_url": null,
  "brand_color": "#ff007c"
}
```

Response (201):
```json
{
  "token": "jwt...",
  "user": { "id": "...", "email": "...", "role": "admin", "org_id": "org_..." },
  "org": { "id": "org_...", "name": "...", "slug": "..." }
}
```

**`GET /check-slug?slug=marcela-genta`** en `api-auth` (sin autenticación)

Response: `{ "available": true }`

### Use case nuevo

**`RegisterWithOrgUseCase`** en `core/src/application/use-cases/auth/register-with-org.ts`

Pasos internos:
1. Validar que `org_slug` no exista → `ConflictError` si existe
2. Validar que `email` no exista → `ConflictError` si existe
3. Sanitizar slug (solo `a-z`, `0-9`, `-`)
4. Generar `org_id` (prefijo `org_`) y `user_id`
5. Hash de contraseña
6. Insertar `organizations` + `users` en transacción D1
7. Generar JWT
8. Retornar `{ token, user, org }`

### Repositorio nuevo

**Port:** `OrganizationRepository` en `core/src/application/ports/repositories/organization-repository.ts`

Métodos:
- `findBySlug(slug: string): Promise<Organization | null>`
- `save(org: Organization): Promise<void>`

**Infra:** `D1OrganizationRepository` en `infrastructure/src/repositories/d1-organization-repository.ts`

---

## Frontend

### Página nueva

**`/register`** → `vendepro-frontend/src/app/(auth)/register/page.tsx`

Wizard de 3 pasos con barra de progreso:

**Paso 1 — Tu inmobiliaria**
- Nombre de la inmobiliaria (requerido)
- Slug (auto-generado desde el nombre, editable, validación de disponibilidad en tiempo real con debounce 500ms)
- Indicador inline: ✓ disponible / ✗ no disponible

**Paso 2 — Tu cuenta**
- Nombre completo (requerido)
- Email (requerido)
- Contraseña (requerido, mínimo 8 caracteres)
- Botón "Crear cuenta" → dispara `POST /register-org`

**Paso 3 — Personalización (opcional)**
- Logo URL
- Color de marca (color picker, default `#ff007c`)
- Botón "Guardar y entrar" → `PUT /admin/org-settings` → redirige a `/dashboard`
- Botón "Saltar por ahora" → redirige directo a `/dashboard`

### Cambios en páginas existentes

**`/login/page.tsx`:** Agregar link "¿No tenés cuenta? Registrá tu inmobiliaria →" debajo del formulario.

**`/configuracion`:** Agregar campo slug con validación de disponibilidad en tiempo real (reutiliza lógica del paso 1).

---

## Base de datos

**Migración `008_register_org_indexes.sql`:**
```sql
-- Asegurar índice único en slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- Índice para búsquedas de usuarios por org
CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);
```

No hay cambios destructivos. La org `org_mg` existente no se modifica.

**Generación de IDs:**
- `org_id`: `org_` + hex 16 bytes → ej: `org_a1b2c3d4e5f67890`
- `user_id`: hex 16 bytes (igual que hoy)

---

## Manejo de errores

| Situación | Comportamiento |
|-----------|---------------|
| Slug ya tomado (paso 1) | Indicador rojo inline, no bloquea hasta intentar continuar |
| Slug tomado en submit (race condition) | Error inline, vuelve al paso 1 |
| Email ya registrado | Error inline en paso 2 |
| Contraseña < 8 caracteres | Validación client-side antes del submit |
| Error de red | Toast "Error de conexión, intentá de nuevo" |
| Falla PUT org-settings (paso 3) | Toast de error, usuario ya está logueado, puede reintentar o saltar |
| Falla transacción D1 | Rollback completo, no quedan orgs huérfanas |

---

## Archivos a crear/modificar

### Crear
- `vendepro-backend/packages/core/src/application/ports/repositories/organization-repository.ts`
- `vendepro-backend/packages/core/src/application/use-cases/auth/register-with-org.ts`
- `vendepro-backend/packages/infrastructure/src/repositories/d1-organization-repository.ts`
- `vendepro-backend/migrations/008_register_org_indexes.sql`
- `vendepro-frontend/src/app/(auth)/register/page.tsx`

### Modificar
- `vendepro-backend/packages/api-auth/src/index.ts` — agregar `POST /register-org` y `GET /check-slug`
- `vendepro-backend/packages/core/src/domain/entities/index.ts` — exportar `Organization`
- `vendepro-backend/packages/infrastructure/src/index.ts` — exportar `D1OrganizationRepository`
- `vendepro-frontend/src/app/(auth)/login/page.tsx` — agregar link a `/register`
- `vendepro-frontend/src/app/(dashboard)/configuracion/page.tsx` — agregar campo slug
