# 👥 Dominio: Usuarios, Organizaciones y Roles

Soporte multi-tenant + RBAC. Cada usuario pertenece a una org y tiene un rol.

## Entidades

### `Organization` (`domain/entities/organization.ts`)
La org es la unidad de tenancy. Toda entidad referencia su `org_id`.

Campos:
- `id`, `name`, `slug`, `owner_id`
- Branding: `logo_url`, `brand_color` (default `#ff007c`), `brand_accent_color` (default `#ff8017`)
- Legacy Canva: `canva_template_id`, `canva_report_template_id` (no se usa más)
- `api_key` (para captura pública vía [[API-public]])
- `created_at`

Hoy hay una org real: `org_mg` (Marcela Genta).

### `User` (`domain/entities/user.ts`)
Cuenta del agente o admin.

Campos:
- `id`, `email`, `password_hash`, `full_name`, `phone`, `photo_url`
- `role` (owner | admin | supervisor | agent)
- `org_id`, `active` (0|1)
- `created_at`

Métodos: `isAdmin()`, `updatePassword(newHash)`, `deactivate()`.

### `Role` (`domain/entities/role.ts`)
Catálogo (4 roles fijos en `roles` table):

| id | name | label |
|---|---|---|
| 1 | owner | Propietario de cuenta |
| 2 | admin | Administrador |
| 3 | supervisor | Supervisor |
| 4 | agent | Agente |

### `AgentProfile` (`domain/entities/agent-profile.ts`)
Perfil público del agente para su landing personal (Feature 07, ver [[Dominio-Landings]] § Perfil de agente). Tabla `agent_profiles`, **1:1 con `users`** (PK = `user_id`, no un id propio).

Campos (20 columnas, migración `048_agent_profiles.sql`):
- `user_id` (PK, FK a `users.id` ON DELETE CASCADE), `org_id`, `slug` (`UNIQUE (org_id, slug)`)
- `headline`, `bio`, `license` (matrícula), `years_experience`
- `zones` / `specialties` (arrays, persistidos como `zones_json`/`specialties_json` TEXT)
- `whatsapp`, `instagram`, `tiktok`, `youtube`, `linkedin`, `website`
- `cover_image_url`, `stats` (array `{label, value}`, `stats_json`)
- **`is_public`** `INTEGER DEFAULT 0` — **kill-switch**: la landing pública (`GetPublicAgentLandingUseCase`) devuelve 404 mientras esté en 0, aunque el perfil ya tenga datos cargados y la landing esté publicada.
- `created_at`, `updated_at`

**No duplica** `photo_url`, `phone` ni `email` — esos siguen viniendo de `users` (evita desincronización entre el perfil de auth y el de marketing; el binding vivo los lee con prefijo `user.` desde `agent-bindings.ts`).

`update()` (`AgentProfile.update`) filtra las keys con valor `undefined` antes del spread: `null` en el patch borra el campo, `undefined` lo deja como está — necesario para que `PUT /profile/public` pueda mandar un patch parcial sin pisar lo no enviado.

Repo: puerto `AgentProfileRepository` (`findByUserId`/`findByOrgAndSlug`/`existsSlug`/`save`) + adapter `D1AgentProfileRepository` (upsert de las 20 columnas; el `ON CONFLICT DO UPDATE` omite `user_id`, `created_at` y `org_id` — esos no cambian tras el insert inicial).

**Deuda**: la validación de `years_experience` (entero 0-70) vive en `UpdateAgentProfileUseCase`, no en el dominio (`AgentProfile.create`/`.update()` no la revalidan) — solo protege ese entry point. Si mañana aparece otro caller de la entidad, no la hereda.

### `PasswordResetToken`
Token temporal de reset (TTL 1h). Ver [[Auth-flow]].

### `OrgVariable` (`domain/entities/org-variable.ts`)
Variables configurables por org para usar en templates de tasación.

Campos:
- `id`, `org_id`
- `key` (formato `namespace.sub_key`, regex validado): ej `market.properties_on_sale`
- `value` (string), `value_type` (number | percent | text | date | image_url)
- `label`, `namespace` (market | notary | custom)
- `is_system` (0|1)

Permite que cada org tenga sus propios datos de mercado, costos notariales, etc. que aparecen automáticamente en las tasaciones (binding mode `org-variable`).

## Reglas (`domain/rules/role-rules.ts`)

| Función | Roles permitidos |
|---|---|
| `isAdmin(role)` | owner, admin |
| `canSeeAll(role)` | owner, admin, supervisor |
| `canManageOrg(role)` | owner, admin |
| `canManageAgents(role)` | owner, admin |
| `canSetObjectives(role)` | owner, admin, supervisor |

## Tablas D1

- `organizations`
- `users`
- `roles` (catálogo, 4 rows)
- `password_reset_tokens`
- `org_variables`
- `agent_profiles` (mig 048) — 1:1 con `users`, ver arriba

Ver [[DB-overview]].

## Use cases

- Auth: `Login`, `CreateUser`, `RegisterWithOrg`, `ChangePassword`, `RequestPasswordReset`, `CompletePasswordReset`
- Agentes: `GetAgents`, `CreateAgent`, `UpdateAgentRole`
- Roles: `GetRoles`
- Perfil: `GetUserProfile`, `UpdateUserProfile`
- Perfil público (agente): `GetAgentProfile`, `UpdateAgentProfile`
- Org: `GetOrgSettings`, `UpdateOrgSettings`
- API key: `GenerateOrgApiKey`, `GetOrgApiKey`
- Org variables: `CreateOrgVariable`, `ListOrgVariables`, `UpdateOrgVariable`, `DeleteOrgVariable`

## Endpoints

[[API-auth]]: auth y reset
[[API-admin]]: agentes, roles, profile, `profile/public` (perfil de agente), org-settings, org-variables, notifications

El *consumo* público del perfil (`GET /a/:orgSlug/:agentSlug`) vive en [[API-public]] y está documentado en [[Dominio-Landings]] — el perfil en sí es de este dominio, la landing que lo muestra es del dominio Landings.

## Frontend

- `/login`, `/register`, `/forgot-password`, `/reset-password`
- `/perfil` (incluye la sección "Perfil público" — `PerfilPublicoForm.tsx`, ver [[Dominio-Landings]])
- `/configuracion`
- `/admin/agentes`, `/admin/agentes/nuevo`
- `/admin/auditoria`
- `/admin/objetivos`

## Relacionados

- [[Auth-flow]]
- [[Dominio-Objetivos]]
- [[Dominio-Tasaciones]] (org_variables se usan en bloques)
- [[Dominio-Landings]] (`agent_profiles` alimenta la landing pública `/a/<org>/<agente>` vía binding vivo)
