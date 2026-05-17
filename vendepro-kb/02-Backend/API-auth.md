# 🔑 API-auth

Worker de autenticación: login, registro, recuperación de password.

| Campo | Valor |
|---|---|
| Path | `packages/api-auth/` |
| Subdominio | `auth.api.vendepro.com.ar` |
| Bindings | D1 (`DB`) |
| Secrets | `JWT_SECRET` |
| Middleware | `corsMiddleware`, `errorHandler` (**sin** auth — son rutas públicas) |

## Endpoints

| Método | Path | Use case | Descripción |
|---|---|---|---|
| POST | `/login` | LoginUseCase | Email + password → JWT + user |
| POST | `/register` | CreateUserUseCase | Crea user en `org_mg` por default → JWT |
| POST | `/register-org` | RegisterWithOrgUseCase | Crea org nueva + usuario admin → JWT |
| GET | `/check-slug` | — | Valida disponibilidad de slug org (`?slug=`) |
| POST | `/password` | ChangePasswordUseCase | Bearer JWT + `{current, new}` |
| POST | `/forgot-password` | RequestPasswordResetUseCase | `{email}` — siempre 200 (anti-enum) |
| POST | `/reset-password` | CompletePasswordResetUseCase | `{token, new_password}` |
| POST | `/logout` | — | Stub, retorna `{success: true}` |

## Notas

- El logout es client-side (borra localStorage + cookie). No invalida el JWT en server porque no hay blacklist.
- El reset password genera un token random, lo guarda en `password_reset_tokens` (TTL 1h) y manda email vía [[Servicios-externos|emBlue]].
- `register-org` crea simultáneamente la org y el primer user con rol `owner`.

Ver [[Auth-flow]] para el flujo completo y [[Dominio-Usuarios-Org]] para entidades.
