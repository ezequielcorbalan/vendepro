# 🛡️ API-admin

Worker para gestión administrativa: agentes, objetivos, perfil, configuración org, templates, variables.

| Campo | Valor |
|---|---|
| Path | `packages/api-admin/` |
| Subdominio | `admin.api.vendepro.com.ar` |
| Bindings | D1, R2 |
| Secrets | `JWT_SECRET` |
| Middleware | cors, error-handler, auth |

## Endpoints

### Agentes — [[Dominio-Usuarios-Org]]

| Método | Path | Use case |
|---|---|---|
| GET | `/agents` | GetAgentsUseCase (role-aware) |
| POST | `/create-agent` | CreateAgentUseCase (admin) |
| DELETE | `/agents` | (`?id`) |

### Roles

| Método | Path | Use case |
|---|---|---|
| GET | `/roles` | GetRolesUseCase |
| PATCH | `/agents/role` | UpdateAgentRoleUseCase (admin, `{id, role_id}`) |

### Objectives — [[Dominio-Objetivos]]

| Método | Path | Use case |
|---|---|---|
| GET | `/objectives` | (`?agent_id, ?period_type`) |
| POST | `/objectives` | SetObjectivesUseCase (admin) |
| DELETE | `/objectives` | (`?id`) |

### Tasacion Template Blocks (legacy) — [[Dominio-Tasaciones]]

| Método | Path | Descripción |
|---|---|---|
| GET | `/tasacion-blocks` | Lista template blocks (sistema viejo) |
| POST | `/tasacion-blocks` | Crea |
| PUT | `/tasacion-blocks/:id` | Actualiza |
| DELETE | `/tasacion-blocks/:id` | Borra |
| POST | `/tasacion-blocks/reorder` | Reordena |

### Appraisal Templates (sistema nuevo) — [[Dominio-Tasaciones]]

| Método | Path | Use case |
|---|---|---|
| GET | `/appraisal-templates` | ListAppraisalTemplatesUseCase (`?kind, ?active`) |
| GET | `/appraisal-templates/:id` | GetAppraisalTemplateUseCase |
| POST | `/appraisal-templates` | CreateAppraisalTemplateUseCase |
| PUT | `/appraisal-templates/:id` | UpdateAppraisalTemplateUseCase |
| POST | `/appraisal-templates/:id/duplicate` | DuplicateAppraisalTemplateUseCase |
| DELETE | `/appraisal-templates/:id` | ArchiveAppraisalTemplateUseCase |

### Org Settings — [[Dominio-Usuarios-Org]]

| Método | Path | Use case |
|---|---|---|
| GET | `/org-settings` | GetOrgSettingsUseCase |
| PUT | `/org-settings` | UpdateOrgSettingsUseCase (`{name, slug, logo_url, brand_color, ...}`) |

### Org Variables

| Método | Path | Use case |
|---|---|---|
| GET | `/org-variables` | ListOrgVariablesUseCase (`?namespace`) |
| POST | `/org-variables` | CreateOrgVariableUseCase |
| PUT | `/org-variables/:id` | UpdateOrgVariableUseCase |
| DELETE | `/org-variables/:id` | DeleteOrgVariableUseCase |

### Perfil

| Método | Path | Use case |
|---|---|---|
| GET | `/profile` | GetUserProfileUseCase |
| PUT | `/profile` | UpdateUserProfileUseCase (`{full_name, phone, photo_url}`) |

### Perfil público de agente — [[Dominio-Landings]] · [[Dominio-Usuarios-Org]]

Alimenta la landing pública `/a/:orgSlug/:agentSlug` (`api-public`).

| Método | Path | Use case |
|---|---|---|
| GET | `/profile/public` | GetAgentProfileUseCase — si el agente no tiene fila en `agent_profiles` todavía, devuelve un `AgentProfile` vacío sin persistir (slug propuesto con `slugifyName(full_name)`), para que la UI tenga qué mostrar. Se persiste recién en el primer PUT |
| PUT | `/profile/public` | UpdateAgentProfileUseCase — el frontend (`PerfilPublicoForm.tsx`) manda el set completo de campos editables, no un patch parcial. `years_experience` se valida entero 0..70 acá (no en el dominio) |

### Notifications — [[Dominio-Notificaciones]]

| Método | Path | Use case |
|---|---|---|
| GET | `/notifications` | GetUserNotificationsUseCase |

## Notas

- **Dos sistemas de templates de tasación coexisten**: `/tasacion-blocks` (legacy, plano) y `/appraisal-templates` (nuevo, con bloques estructurados Zod + variables `org_variables`). Las tasaciones nuevas usan el sistema nuevo (`appraisals.template_id`).
- `org_variables` permite a cada org definir valores reutilizables en templates: ej. `market.properties_on_sale = 1247`, `notary.escrituración_cost = 8500`. Ver [[Frontend-editor-tasaciones]].
