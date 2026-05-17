# Spec: Cambio de Rol de Agentes

**Fecha:** 2026-04-16  
**Estado:** Aprobado

## Contexto

La sección `/admin/agentes` permite crear y eliminar agentes, pero no modificar su rol. El rol está almacenado como `TEXT` en `users.role` con valores string (`'agent'`, `'admin'`, etc.). Esta feature convierte los roles en entidades con ID numérico para soportar permisos personalizados en el futuro.

## Objetivo

Permitir que un administrador cambie el rol de cualquier agente desde la UI, con los roles como entidades en base de datos.

## Roles del sistema

| id | name       | label          |
|----|------------|----------------|
| 1  | owner      | Dueño          |
| 2  | admin      | Administrador  |
| 3  | supervisor | Supervisor     |
| 4  | agent      | Agente         |

## Cambios de base de datos

### Nueva tabla `roles`

```sql
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  permissions TEXT NOT NULL DEFAULT '{}',
  org_id TEXT NULL
);

INSERT OR IGNORE INTO roles (id, name, label) VALUES
  (1, 'owner',      'Dueño'),
  (2, 'admin',      'Administrador'),
  (3, 'supervisor', 'Supervisor'),
  (4, 'agent',      'Agente');
```

`org_id NULL` = rol del sistema. Roles con `org_id` = rol personalizado de esa organización (reservado para el futuro).

### Migración de `users.role`

Agregar columna `role_id INTEGER` (FK a `roles.id`) y migrar los valores existentes:

```sql
ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id);

UPDATE users SET role_id = (SELECT id FROM roles WHERE name = users.role);
```

La columna `role` (TEXT) se mantiene durante la transición para no romper código existente; se puede limpiar en una migración posterior una vez que todo el código use `role_id`.

## Backend — `api-admin`

### `GET /roles`

Devuelve todos los roles del sistema.

```json
[
  { "id": 1, "name": "owner",      "label": "Dueño" },
  { "id": 2, "name": "admin",      "label": "Administrador" },
  { "id": 3, "name": "supervisor", "label": "Supervisor" },
  { "id": 4, "name": "agent",      "label": "Agente" }
]
```

Requiere auth (admin/owner). No filtra ningún rol.

### `PATCH /agents/:id/role`

Recibe `{ role_id: number }`. Busca el rol en la tabla `roles` por `id`. Actualiza `users.role_id` y sincroniza `users.role` (TEXT) con el `name` del rol encontrado.

**Reglas de negocio:**
- Solo `owner` puede asignar el rol `owner` (id=1)
- `admin` puede asignar `admin`, `supervisor`, `agent`
- No se puede cambiar el propio rol
- El usuario destino debe pertenecer a la misma `org_id`

Responde `{ success: true, role: { id, name, label } }` o error 403/404.

## Core — `D1UserRepository`

Agregar método `updateRole(userId: string, orgId: string, roleId: number, roleName: string): Promise<void>` que ejecuta:

```sql
UPDATE users SET role_id = ?, role = ? WHERE id = ? AND org_id = ?
```

## Frontend — `admin/agentes/page.tsx`

### Carga inicial

Al montar: fetch paralelo a `/agents` y `/roles`. El estado local incluye `roles: Role[]`.

### Badge clickeable

El badge de rol de cada agente (excepto el propio usuario) se vuelve clickeable. Al hacer click abre un popover posicionado bajo el badge con la lista de roles disponibles.

Cada opción muestra el label y un check si es el rol actual. Al seleccionar:

1. Cierra el popover
2. Actualiza optimistamente el estado local
3. Hace `PATCH /agents/:id/role` con `{ role_id: number }`
4. Si falla: revierte el estado y muestra toast de error
5. Si éxito: toast "Rol actualizado"

### Restricciones UI

- El propio usuario: badge no clickeable (igual que hoy)
- Un `admin` no puede asignar `owner` — si el servidor responde 403, se muestra toast de error y se revierte
- El popover se cierra con click fuera (listener en `document`)

## Seguridad

- El endpoint `PATCH /agents/:id/role` verifica `canManageAgents(requestingUserRole)` antes de proceder
- La restricción owner→owner se verifica contra `requestingUserRole === 'owner'`
- Nunca se confía en el rol del cliente para aplicar restricciones

## Lo que NO se implementa ahora

- Permisos personalizados por rol (columna `permissions` queda vacía `{}`)
- Roles custom por organización (`org_id` en roles queda NULL)
- UI para crear/editar roles
