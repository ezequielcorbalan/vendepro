# Diseño: Recuperar Contraseña + Link Registrar en Login

**Fecha:** 2026-04-15  
**Estado:** Aprobado

---

## Resumen

Implementar el flujo completo de recuperación de contraseña usando emBlue como proveedor de email transaccional (API v2.3), y asegurarse de que el login tenga el link a registro visible.

---

## Alcance

### Frontend
1. **Login page** — agregar link "¿Olvidaste tu contraseña?" entre el botón Ingresar y el link de registro existente
2. **Nueva página `/forgot-password`** — formulario de solicitud de reset
3. **Nueva página `/reset-password`** — formulario para ingresar nueva contraseña (recibe `?token=xxx`)

### Backend (`api-auth` Worker)
1. **`POST /forgot-password`** — genera token, envía email via emBlue
2. **`POST /reset-password`** — valida token, actualiza contraseña

### Base de datos
- Nueva tabla `password_reset_tokens` (migración SQL)

### Infraestructura
- Nuevo secret `EMBLUE_API_KEY` en el Worker `api-auth`

---

## Base de datos

```sql
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token     TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used      INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

No hay FK explícita a `users` (D1/SQLite, consistencia manejada a nivel app).

---

## Backend

### `POST /forgot-password`

**Request:**
```json
{ "email": "user@example.com" }
```

**Lógica:**
1. Buscar usuario por email con `D1UserRepository.findByEmail(email)`
2. Si no existe el usuario → igual responder `{ success: true }` (no revelar si el email está registrado)
3. Si existe:
   a. Generar token: `crypto.randomBytes(32)` como hex string (64 chars)
   b. `expires_at` = ahora + 1 hora (UTC)
   c. Insertar en `password_reset_tokens`
   d. Llamar a emBlue API para enviar el email
4. Responder siempre `200 { success: true }`

**Email via emBlue:**
```
POST https://api.embluemail.com/v2.3/send
Authorization: Bearer <EMBLUE_API_KEY>
Content-Type: application/json

{
  "from": { "email": "noreply@vendepro.com.ar", "name": "VendéPro CRM" },
  "to": [{ "email": "<user_email>", "name": "<user_name>" }],
  "subject": "Recuperá tu contraseña — VendéPro",
  "html": "<p>Hola <b>{name}</b>,...</p><a href='{link}'>Recuperar contraseña</a>",
  "text": "Hola {name}, ingresá al siguiente link para recuperar tu contraseña: {link}"
}
```

> Nota: el body exacto de emBlue puede necesitar ajuste menor al probar. Está en un solo lugar (`api-auth/src/index.ts`) y es fácil de actualizar.

**Reset link:** `https://app.vendepro.com.ar/reset-password?token=<token>`

**Error handling:** Si emBlue falla, loguear el error pero igual responder `{ success: true }` al frontend (no bloquear al usuario por un fallo de email).

---

### `POST /reset-password`

**Request:**
```json
{ "token": "abc123...", "password": "nuevaContraseña123" }
```

**Lógica:**
1. Buscar token en `password_reset_tokens` por valor exacto
2. Validar:
   - Token existe → si no: `400 { error: 'Token inválido' }`
   - `used = 0` → si no: `400 { error: 'Token ya utilizado' }`
   - `expires_at > now` → si no: `400 { error: 'Token expirado' }`
3. Validar `password.length >= 8` → si no: `400 { error: 'La contraseña debe tener al menos 8 caracteres' }`
4. Hashear nueva contraseña con `JwtAuthService.hashPassword()` (o equivalente en `JwtAuthService`)
5. Actualizar `password_hash` del usuario directamente en D1
6. Marcar token como `used = 1`
7. Responder `200 { success: true }`

> Nota: `ChangePasswordUseCase` actual requiere `currentPassword`. Se actualiza el password directamente en D1 o se agrega un método `resetPassword` al `UserRepository`.

---

## Frontend

### Login page (`/login`) — cambio mínimo

Agregar entre el botón y el footer existente:

```tsx
<div className="text-right">
  <Link href="/forgot-password" className="text-sm text-gray-500 hover:text-[#ff007c]">
    ¿Olvidaste tu contraseña?
  </Link>
</div>
```

---

### `/forgot-password` page

**Estado `idle`:**
- Form con campo email
- Botón "Enviar instrucciones" (pink, full-width)
- Link "Volver al inicio de sesión" abajo

**Estado `loading`:**
- Botón deshabilitado + spinner

**Estado `sent`** (tras respuesta exitosa):
- Mensaje: "Si el email está registrado, vas a recibir un mensaje con las instrucciones para recuperar tu contraseña."
- Link "Volver al inicio de sesión"
- No se vuelve al form (evitar spam)

**Llama a:** `POST /api-auth/forgot-password` via `apiFetch('auth', '/forgot-password', ...)`

---

### `/reset-password?token=xxx` page

**Estado `validating`** (al montar, `useEffect` con token del query param):
- Spinner / "Verificando..."
- Llama a `GET /reset-password/validate?token=xxx` en el backend (o directamente el POST al intentar guardar)

> Decisión: **validar en el submit** (no al montar) para simplificar. Si el token es inválido, el backend devuelve error al guardar.

**Estado `form`:**
- Campo "Nueva contraseña" (min 8 chars)
- Campo "Repetir contraseña"
- Validación client-side: las dos contraseñas deben coincidir
- Botón "Guardar contraseña"

**Estado `loading`:** botón deshabilitado + spinner

**Estado `error`** (token inválido/expirado del backend):
- Mensaje de error del servidor
- Link "Solicitar un nuevo link" → `/forgot-password`

**Estado `success`:**
- "¡Contraseña actualizada! Ya podés ingresar con tu nueva contraseña."
- Link/botón "Ir al login"

**Llama a:** `POST /api-auth/reset-password` via `apiFetch('auth', '/reset-password', ...)`

---

## Archivos a crear/modificar

| Acción | Archivo |
|--------|---------|
| MODIFICAR | `vendepro-frontend/src/app/(auth)/login/page.tsx` |
| CREAR | `vendepro-frontend/src/app/(auth)/forgot-password/page.tsx` |
| CREAR | `vendepro-frontend/src/app/(auth)/reset-password/page.tsx` |
| MODIFICAR | `vendepro-backend/packages/api-auth/src/index.ts` |
| CREAR | `vendepro-backend/migrations_v2/002_password_reset_tokens.sql` |

---

## Seguridad

- El endpoint `/forgot-password` siempre responde `200` independientemente de si el email existe
- Tokens de 64 chars hex (32 bytes de entropía)
- Expiración de 1 hora
- Tokens de un solo uso (`used = 1` tras resetear)
- La API key de emBlue se guarda exclusivamente como Cloudflare Worker secret (`EMBLUE_API_KEY`), nunca en código ni en `.dev.vars` commiteado
- `EMBLUE_API_KEY` se agrega a `.dev.vars` local (no commiteado) para desarrollo

---

## Out of scope

- Reenvío de email (el usuario puede pedir un nuevo link desde `/forgot-password`)
- Rate limiting en `/forgot-password` (mejora futura)
- Template visual pre-configurado en emBlue (se usa HTML inline por ahora)
