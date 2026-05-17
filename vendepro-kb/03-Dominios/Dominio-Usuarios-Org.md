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

Ver [[DB-overview]].

## Use cases

- Auth: `Login`, `CreateUser`, `RegisterWithOrg`, `ChangePassword`, `RequestPasswordReset`, `CompletePasswordReset`
- Agentes: `GetAgents`, `CreateAgent`, `UpdateAgentRole`
- Roles: `GetRoles`
- Perfil: `GetUserProfile`, `UpdateUserProfile`
- Org: `GetOrgSettings`, `UpdateOrgSettings`
- API key: `GenerateOrgApiKey`, `GetOrgApiKey`
- Org variables: `CreateOrgVariable`, `ListOrgVariables`, `UpdateOrgVariable`, `DeleteOrgVariable`

## Endpoints

[[API-auth]]: auth y reset
[[API-admin]]: agentes, roles, profile, org-settings, org-variables, notifications

## Frontend

- `/login`, `/register`, `/forgot-password`, `/reset-password`
- `/perfil`
- `/configuracion`
- `/admin/agentes`, `/admin/agentes/nuevo`
- `/admin/auditoria`
- `/admin/objetivos`

## Relacionados

- [[Auth-flow]]
- [[Dominio-Objetivos]]
- [[Dominio-Tasaciones]] (org_variables se usan en bloques)
