# 🔐 Auth flow — Frontend

Cómo se autentica el usuario y cómo se propaga la sesión.

Ver también [[Auth-flow]] (visión general backend + frontend).

## Storage

| Key | Donde | Contenido | Vida |
|---|---|---|---|
| `vendepro_token` | localStorage | JWT firmado | hasta que se borre |
| `vendepro_token` | cookie | mismo JWT | 30 días |
| `vendepro_user` | localStorage | JSON `{id, email, full_name, role, org_id, photo_url}` | hasta logout |

## Login

```typescript
// /login (page.tsx — client)
const res = await apiFetch('auth', '/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
})
const { token, user } = (await res.json()) as any

setToken(token)         // localStorage + cookie
setCurrentUser(user)    // localStorage
router.push(redirect || '/dashboard')
```

## Protección de rutas

### Middleware Next (`src/middleware.ts`)

Corre antes del SSR. Solo chequea **presencia** de cookie:
- Si la ruta está en allowlist público → pasa
- Si no hay cookie → redirige a `/login?redirect=<path>`
- No verifica firma del JWT (eso lo hacen las APIs cuando se hacen requests)

Rutas siempre públicas:
```
/login, /register, /forgot-password, /reset-password, /terminos
/r/*, /t/*, /v/*, /p/*, /l/*
/_next, /api/, /favicon.ico, etc.
```

### Layout `(dashboard)/`

Server Component que llama `getCurrentUserServer()` (lee cookie, decodifica payload):
- Si el JWT está expirado → redirige a `/login`
- Si está vivo → renderiza el shell con sidebar

### Páginas client

Llaman `getCurrentUser()` desde localStorage para mostrar nombre del agente, role-aware UI, etc.

## Auth en requests

`apiFetch(api, path, options)`:
1. Lee `localStorage.vendepro_token`
2. Setea `Authorization: Bearer <token>` (a menos que sea api `public`)
3. Hace fetch
4. Si la respuesta es 401 → asume expirado, llama `clearToken()` y `router.push('/login?redirect=...')`

## Logout

```typescript
import { logout } from '@/lib/auth'
logout()  // borra localStorage + cookie, redirige a /login
```

No invalida el JWT en backend (no hay blacklist).

## Reset de password

1. `/forgot-password` → email → POST `apiFetch('auth', '/forgot-password', {email})`
2. Usuario recibe email vía emBlue con link `/reset-password?token=<token>`
3. `/reset-password` → POST `apiFetch('auth', '/reset-password', {token, new_password})`
4. Si éxito → redirect a `/login`

Memoria del proyecto: hay un commit reciente que mejora el manejo de token expirado (`6e4705c feat(auth): redirect según sesión y manejo de token expirado`).

## SSR vs CSR

| Caso | Helper |
|---|---|
| Server Component leyendo sesión | `getCurrentUserServer()` (`lib/auth-server.ts`) |
| Client Component leyendo sesión | `getCurrentUser()` (`lib/auth.ts`) |
| Server Component fetcheando API | `serverFetch(api, path, cookieHeader)` |
| Client Component fetcheando API | `apiFetch(api, path)` |
