# 🔐 Auth Flow

Autenticación custom basada en JWT (no usa Cloudflare Access ni Auth0).

## Componentes

- **Hash de password**: SHA-256 + salt fijo `reportes-mg-salt-2026` (⚠️ ver [[Reglas-criticas]])
- **Token**: JWT firmado con `JWT_SECRET` (`jose` library, en `infrastructure/services/jwt-auth-service.ts`)
- **Storage cliente**: `localStorage.vendepro_token` + cookie `vendepro_token` (30 días)
- **Storage user data**: `localStorage.vendepro_user` (JSON con id, email, full_name, role, org_id)

## Flujo login

```
1. Usuario POST /login a [[API-auth]] con {email, password}
2. LoginUseCase valida hash, genera JWT con payload {userId, email, role, orgId}
3. Frontend recibe {token, user}
4. Guarda token en localStorage + cookie (30 días)
5. Guarda user en localStorage
6. Redirige a /dashboard (o ?redirect=)
```

## Flujo request autenticado

```
Frontend:
  apiFetch(api, path) lee token de localStorage
  Setea header `Authorization: Bearer <token>`

Backend (Worker API):
  corsMiddleware →
  errorHandler →
  createAuthMiddleware:
    - lee Bearer token
    - jose.jwtVerify(token, JWT_SECRET)
    - c.set('userId', ...), c.set('userEmail', ...),
      c.set('userRole', ...), c.set('orgId', ...)
    - rechaza con 401 si inválido/expirado
  Route handler accede via c.get('orgId') etc.
```

## SSR (Server Components)

- Server Components leen cookie con `getCurrentUserServer()` (`lib/auth-server.ts`)
- Decodifica JWT payload sin verificar firma (eso lo hacen las APIs)
- Solo valida `exp`
- Middleware Next (`src/middleware.ts`) protege rutas chequeando solo la presencia de la cookie, no validez

## Roles

`UserRole = owner | admin | supervisor | agent`

Reglas (en `domain/rules/role-rules.ts`):
- `isAdmin()` = owner|admin
- `canSeeAll()` = owner|admin|supervisor
- `canManageOrg()` = owner|admin
- `canManageAgents()` = owner|admin
- `canSetObjectives()` = owner|admin|supervisor

Las APIs validan estos roles dentro de cada use case según corresponda (ej. `UpdateAgentRoleUseCase` solo permite admin).

## Reset de password

```
1. POST /forgot-password → RequestPasswordResetUseCase
   - busca user por email (siempre retorna success aunque no exista, anti-enum)
   - genera token random, guarda en password_reset_tokens (expira en 1h)
   - envía email vía emBlue Email Service con link a /reset-password?token=...
2. POST /reset-password con {token, new_password} → CompletePasswordResetUseCase
   - valida token (no usado, no expirado)
   - hashea nueva password, actualiza users
   - marca token como `used=1`
```

## Change password (autenticado)

`POST /password` en [[API-auth]] con Bearer válido + body `{current, new}` → `ChangePasswordUseCase`.

## Logout

Frontend-only: `clearToken()` borra localStorage + cookie + redirige a `/login`. No hay revocación de JWT en backend (los tokens viven sus 30 días pase lo que pase).

## Multi-tenancy

El `org_id` del JWT define el scope. Toda query D1 filtra por `org_id` (ver [[Reglas-criticas]]). Las rutas públicas de [[API-public]] resuelven `org_id` desde el slug del recurso (ej. `appraisal.org_id`).
