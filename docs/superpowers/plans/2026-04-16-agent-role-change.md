# Agent Role Change Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir a admin/owner cambiar el rol de cualquier agente desde la UI, con roles como entidades en D1.

**Architecture:** Nueva tabla `roles` con ID numérico; `users` gana columna `role_id` (FK) manteniendo `role` TEXT para compatibilidad. La UI muestra un popover al clickear el badge de rol. Un nuevo endpoint `PATCH /agents/role` valida el role_id contra la tabla y aplica la restricción owner-only para asignar owner.

**Tech Stack:** Hono + Cloudflare D1 (backend), Next.js 15 + Tailwind (frontend), Vitest (tests)

---

## Mapa de archivos

| Archivo | Acción |
|---------|--------|
| `vendepro-backend/packages/core/src/application/ports/repositories/user-repository.ts` | Modificar — agregar `updateRole` |
| `vendepro-backend/packages/core/src/application/use-cases/admin/update-agent-role.ts` | Crear |
| `vendepro-backend/packages/core/src/application/index.ts` | Modificar — exportar nuevo use case |
| `vendepro-backend/packages/core/tests/use-cases/admin/update-agent-role.test.ts` | Crear |
| `vendepro-backend/packages/core/tests/use-cases/admin/create-agent.test.ts` | Modificar — agregar `updateRole` al mock |
| `vendepro-backend/packages/core/tests/use-cases/auth/login.test.ts` | Modificar — agregar `updateRole` al mock |
| `vendepro-backend/packages/core/tests/use-cases/auth/register-with-org.test.ts` | Modificar — agregar `updateRole` al mock |
| `vendepro-backend/packages/infrastructure/src/repositories/d1-user-repository.ts` | Modificar — implementar `updateRole` |
| `vendepro-backend/packages/api-admin/src/index.ts` | Modificar — agregar `GET /roles` y `PATCH /agents/role` |
| `vendepro-frontend/src/lib/crm-config.ts` | Modificar — agregar `owner` a `USER_ROLES` |
| `vendepro-frontend/src/app/(dashboard)/admin/agentes/page.tsx` | Modificar — UI de cambio de rol |

---

## Task 1: Migración D1 — tabla `roles` y columna `role_id` en `users`

**Files:**
- No hay archivos de migración en el proyecto — ejecutar SQL directamente

- [ ] **Step 1: Ejecutar SQL de migración via Cloudflare Dashboard**

Ir a Cloudflare Dashboard → D1 → `vendepro-db` → pestaña "Console" → pegar y ejecutar:

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

ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id);

UPDATE users SET role_id = (SELECT id FROM roles WHERE name = users.role);
```

- [ ] **Step 2: Verificar que los datos son correctos**

En el mismo Console de D1:

```sql
SELECT u.id, u.full_name, u.role, u.role_id, r.name AS role_name
FROM users u
LEFT JOIN roles r ON r.id = u.role_id
LIMIT 10;
```

Esperado: cada fila tiene `role_id` numérico y `role_name` coincide con `role` TEXT.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(db): add roles table and role_id to users"
```

---

## Task 2: Core — `updateRole` en UserRepository interface

**Files:**
- Modify: `vendepro-backend/packages/core/src/application/ports/repositories/user-repository.ts`
- Modify: `vendepro-backend/packages/core/tests/use-cases/admin/create-agent.test.ts`
- Modify: `vendepro-backend/packages/core/tests/use-cases/auth/login.test.ts`
- Modify: `vendepro-backend/packages/core/tests/use-cases/auth/register-with-org.test.ts`

- [ ] **Step 1: Agregar `updateRole` a la interfaz**

Reemplazar el contenido de `vendepro-backend/packages/core/src/application/ports/repositories/user-repository.ts`:

```typescript
import type { User } from '../../../domain/entities/user'

export interface UserRepository {
  findById(id: string, orgId: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  findByOrg(orgId: string): Promise<User[]>
  save(user: User): Promise<void>
  delete(id: string, orgId: string): Promise<void>
  updateRole(id: string, orgId: string, roleId: number, roleName: string): Promise<void>
}
```

- [ ] **Step 2: Agregar `updateRole: vi.fn()` a los mocks existentes**

En `vendepro-backend/packages/core/tests/use-cases/admin/create-agent.test.ts`, agregar la línea al objeto `mockUserRepo`:

```typescript
const mockUserRepo = {
  findByEmail: vi.fn(),
  findById: vi.fn(),
  findByOrg: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn(),
  updateRole: vi.fn().mockResolvedValue(undefined),
}
```

En `vendepro-backend/packages/core/tests/use-cases/auth/login.test.ts`, agregar al mock `mockUserRepo`:

```typescript
  updateRole: vi.fn().mockResolvedValue(undefined),
```

En `vendepro-backend/packages/core/tests/use-cases/auth/register-with-org.test.ts`, hacer lo mismo — agregar `updateRole: vi.fn().mockResolvedValue(undefined)` al objeto mock de UserRepository.

- [ ] **Step 3: Verificar que los tests existentes siguen pasando**

```bash
cd vendepro-backend/packages/core && npm run test
```

Esperado: todos los tests pasan (sin errores de tipo ni runtime).

- [ ] **Step 4: Commit**

```bash
git add vendepro-backend/packages/core/src/application/ports/repositories/user-repository.ts
git add vendepro-backend/packages/core/tests/use-cases/admin/create-agent.test.ts
git add vendepro-backend/packages/core/tests/use-cases/auth/login.test.ts
git add vendepro-backend/packages/core/tests/use-cases/auth/register-with-org.test.ts
git commit -m "feat(core): add updateRole to UserRepository interface"
```

---

## Task 3: Core — `UpdateAgentRoleUseCase` con tests

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/admin/update-agent-role.ts`
- Create: `vendepro-backend/packages/core/tests/use-cases/admin/update-agent-role.test.ts`
- Modify: `vendepro-backend/packages/core/src/application/index.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `vendepro-backend/packages/core/tests/use-cases/admin/update-agent-role.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdateAgentRoleUseCase } from '../../../src/application/use-cases/admin/update-agent-role'
import { ForbiddenError } from '../../../src/domain/errors/forbidden'
import { NotFoundError } from '../../../src/domain/errors/not-found'
import { User } from '../../../src/domain/entities/user'

const agentUser = User.create({
  id: 'agent-1',
  email: 'agent@mg.com',
  password_hash: 'hashed',
  full_name: 'Juan Agente',
  phone: null,
  photo_url: null,
  role: 'agent',
  org_id: 'org_mg',
  active: 1,
})

const mockUserRepo = {
  findByEmail: vi.fn(),
  findById: vi.fn(),
  findByOrg: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn(),
  updateRole: vi.fn().mockResolvedValue(undefined),
}

describe('UpdateAgentRoleUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserRepo.updateRole.mockResolvedValue(undefined)
  })

  it('admin can change agent role', async () => {
    mockUserRepo.findById.mockResolvedValue(agentUser)

    const useCase = new UpdateAgentRoleUseCase(mockUserRepo)
    await useCase.execute({
      requestingUserRole: 'admin',
      agentId: 'agent-1',
      orgId: 'org_mg',
      roleId: 3,
      roleName: 'supervisor',
    })

    expect(mockUserRepo.updateRole).toHaveBeenCalledWith('agent-1', 'org_mg', 3, 'supervisor')
  })

  it('agent cannot change roles', async () => {
    const useCase = new UpdateAgentRoleUseCase(mockUserRepo)
    await expect(useCase.execute({
      requestingUserRole: 'agent',
      agentId: 'agent-1',
      orgId: 'org_mg',
      roleId: 2,
      roleName: 'admin',
    })).rejects.toThrow(ForbiddenError)
  })

  it('admin cannot assign owner role', async () => {
    mockUserRepo.findById.mockResolvedValue(agentUser)
    const useCase = new UpdateAgentRoleUseCase(mockUserRepo)
    await expect(useCase.execute({
      requestingUserRole: 'admin',
      agentId: 'agent-1',
      orgId: 'org_mg',
      roleId: 1,
      roleName: 'owner',
    })).rejects.toThrow(ForbiddenError)
  })

  it('owner can assign owner role', async () => {
    mockUserRepo.findById.mockResolvedValue(agentUser)
    const useCase = new UpdateAgentRoleUseCase(mockUserRepo)
    await useCase.execute({
      requestingUserRole: 'owner',
      agentId: 'agent-1',
      orgId: 'org_mg',
      roleId: 1,
      roleName: 'owner',
    })
    expect(mockUserRepo.updateRole).toHaveBeenCalledWith('agent-1', 'org_mg', 1, 'owner')
  })

  it('throws NotFoundError when agent does not exist', async () => {
    mockUserRepo.findById.mockResolvedValue(null)
    const useCase = new UpdateAgentRoleUseCase(mockUserRepo)
    await expect(useCase.execute({
      requestingUserRole: 'admin',
      agentId: 'nonexistent',
      orgId: 'org_mg',
      roleId: 3,
      roleName: 'supervisor',
    })).rejects.toThrow(NotFoundError)
  })
})
```

- [ ] **Step 2: Verificar que el test falla**

```bash
cd vendepro-backend/packages/core && npm run test -- tests/use-cases/admin/update-agent-role.test.ts
```

Esperado: FAIL — "Cannot find module '..../update-agent-role'"

- [ ] **Step 3: Crear el use case**

Crear `vendepro-backend/packages/core/src/application/use-cases/admin/update-agent-role.ts`:

```typescript
import type { UserRepository } from '../../ports/repositories/user-repository'
import { ForbiddenError } from '../../../domain/errors/forbidden'
import { NotFoundError } from '../../../domain/errors/not-found'
import { canManageAgents } from '../../../domain/rules/role-rules'

export interface UpdateAgentRoleInput {
  requestingUserRole: string
  agentId: string
  orgId: string
  roleId: number
  roleName: string
}

export class UpdateAgentRoleUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(input: UpdateAgentRoleInput): Promise<void> {
    if (!canManageAgents(input.requestingUserRole)) {
      throw new ForbiddenError('No tienes permiso para cambiar roles')
    }
    if (input.roleName === 'owner' && input.requestingUserRole !== 'owner') {
      throw new ForbiddenError('Solo el owner puede asignar el rol owner')
    }
    const user = await this.userRepo.findById(input.agentId, input.orgId)
    if (!user) throw new NotFoundError('Agente no encontrado')
    await this.userRepo.updateRole(input.agentId, input.orgId, input.roleId, input.roleName)
  }
}
```

- [ ] **Step 4: Verificar que los tests pasan**

```bash
cd vendepro-backend/packages/core && npm run test -- tests/use-cases/admin/update-agent-role.test.ts
```

Esperado: 5 tests PASS

- [ ] **Step 5: Exportar el use case**

En `vendepro-backend/packages/core/src/application/index.ts`, agregar al bloque `// Admin`:

```typescript
// Admin
export * from './use-cases/admin/create-agent'
export * from './use-cases/admin/get-agents'
export * from './use-cases/admin/set-objectives'
export * from './use-cases/admin/update-agent-role'
```

- [ ] **Step 6: Correr todos los tests del core**

```bash
cd vendepro-backend/packages/core && npm run test
```

Esperado: todos los tests pasan.

- [ ] **Step 7: Commit**

```bash
git add vendepro-backend/packages/core/src/application/use-cases/admin/update-agent-role.ts
git add vendepro-backend/packages/core/src/application/index.ts
git add vendepro-backend/packages/core/tests/use-cases/admin/update-agent-role.test.ts
git commit -m "feat(core): add UpdateAgentRoleUseCase"
```

---

## Task 4: Infrastructure — `D1UserRepository.updateRole`

**Files:**
- Modify: `vendepro-backend/packages/infrastructure/src/repositories/d1-user-repository.ts`

- [ ] **Step 1: Agregar el método `updateRole`**

En `vendepro-backend/packages/infrastructure/src/repositories/d1-user-repository.ts`, agregar después del método `delete`:

```typescript
  async updateRole(id: string, orgId: string, roleId: number, roleName: string): Promise<void> {
    await this.db
      .prepare('UPDATE users SET role_id = ?, role = ? WHERE id = ? AND org_id = ?')
      .bind(roleId, roleName, id, orgId)
      .run()
  }
```

El archivo completo queda:

```typescript
import { User } from '@vendepro/core'
import type { UserRepository } from '@vendepro/core'

export class D1UserRepository implements UserRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string, orgId: string): Promise<User | null> {
    const row = await this.db
      .prepare('SELECT * FROM users WHERE id = ? AND (org_id = ? OR org_id IS NULL)')
      .bind(id, orgId)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(email.toLowerCase().trim())
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async findByOrg(orgId: string): Promise<User[]> {
    const rows = (await this.db
      .prepare('SELECT * FROM users WHERE org_id = ? ORDER BY full_name')
      .bind(orgId)
      .all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async save(user: User): Promise<void> {
    const o = user.toObject()
    await this.db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, phone, photo_url, role, org_id, active, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        email=excluded.email, password_hash=excluded.password_hash, full_name=excluded.full_name,
        phone=excluded.phone, photo_url=excluded.photo_url, role=excluded.role, active=excluded.active
    `).bind(o.id, o.email, o.password_hash, o.full_name, o.phone, o.photo_url, o.role, o.org_id, o.active, o.created_at).run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.prepare('UPDATE users SET active = 0 WHERE id = ? AND org_id = ?').bind(id, orgId).run()
  }

  async updateRole(id: string, orgId: string, roleId: number, roleName: string): Promise<void> {
    await this.db
      .prepare('UPDATE users SET role_id = ?, role = ? WHERE id = ? AND org_id = ?')
      .bind(roleId, roleName, id, orgId)
      .run()
  }

  private toEntity(row: any): User {
    return User.create({
      id: row.id, email: row.email, password_hash: row.password_hash ?? '',
      full_name: row.full_name, phone: row.phone ?? null, photo_url: row.photo_url ?? null,
      role: row.role, org_id: row.org_id ?? null, active: row.active ?? 1,
      created_at: row.created_at,
    })
  }
}
```

- [ ] **Step 2: Verificar typecheck del paquete infrastructure**

```bash
cd vendepro-backend/packages/infrastructure && npx tsc --noEmit
```

Esperado: sin errores de tipo.

- [ ] **Step 3: Commit**

```bash
git add vendepro-backend/packages/infrastructure/src/repositories/d1-user-repository.ts
git commit -m "feat(infra): implement updateRole in D1UserRepository"
```

---

## Task 5: API Admin — `GET /roles` y `PATCH /agents/role`

**Files:**
- Modify: `vendepro-backend/packages/api-admin/src/index.ts`

- [ ] **Step 1: Agregar los dos endpoints al final del bloque AGENTS**

En `vendepro-backend/packages/api-admin/src/index.ts`, agregar la importación `UpdateAgentRoleUseCase` al import de `@vendepro/core`:

```typescript
import { CreateAgentUseCase, GetAgentsUseCase, SetObjectivesUseCase, UpdateAgentRoleUseCase } from '@vendepro/core'
```

Luego agregar los dos endpoints después del `app.delete('/agents', ...)`:

```typescript
app.get('/roles', async (c) => {
  const roles = await c.env.DB
    .prepare('SELECT id, name, label FROM roles ORDER BY id')
    .all()
  return c.json(roles.results)
})

app.patch('/agents/role', async (c) => {
  const body = (await c.req.json()) as any
  const { id, role_id } = body

  if (!id || !role_id) return c.json({ error: 'id y role_id son requeridos' }, 400)

  const role = await c.env.DB
    .prepare('SELECT id, name, label FROM roles WHERE id = ?')
    .bind(role_id)
    .first() as any

  if (!role) return c.json({ error: 'Rol no encontrado' }, 404)

  const repo = new D1UserRepository(c.env.DB)
  const useCase = new UpdateAgentRoleUseCase(repo)

  await useCase.execute({
    requestingUserRole: c.get('userRole'),
    agentId: id,
    orgId: c.get('orgId'),
    roleId: role.id,
    roleName: role.name,
  })

  return c.json({ success: true, role: { id: role.id, name: role.name, label: role.label } })
})
```

- [ ] **Step 2: Verificar typecheck de api-admin**

```bash
cd vendepro-backend/packages/api-admin && npx tsc --noEmit
```

Esperado: sin errores de tipo.

- [ ] **Step 3: Commit**

```bash
git add vendepro-backend/packages/api-admin/src/index.ts
git commit -m "feat(api-admin): add GET /roles and PATCH /agents/role"
```

---

## Task 6: Frontend — Cambio de rol en la página de agentes

**Files:**
- Modify: `vendepro-frontend/src/lib/crm-config.ts`
- Modify: `vendepro-frontend/src/app/(dashboard)/admin/agentes/page.tsx`

- [ ] **Step 1: Agregar `owner` a `USER_ROLES` en crm-config.ts**

En `vendepro-frontend/src/lib/crm-config.ts`, reemplazar `USER_ROLES`:

```typescript
export const USER_ROLES = {
  owner:      { label: 'Dueño',          color: 'bg-yellow-100 text-yellow-700', level: 4 },
  admin:      { label: 'Administrador',  color: 'bg-red-100 text-red-700',       level: 3 },
  supervisor: { label: 'Supervisor',     color: 'bg-purple-100 text-purple-700', level: 2 },
  agent:      { label: 'Agente',         color: 'bg-blue-100 text-blue-700',     level: 1 },
} as const
```

- [ ] **Step 2: Reemplazar el contenido completo de agentes/page.tsx**

```typescript
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Users, Plus, Trash2, Loader2, Mail, Phone, Check, ChevronDown } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { getCurrentUser } from '@/lib/auth'
import { getRoleLabel, getRoleColor } from '@/lib/crm-config'

interface Role {
  id: number
  name: string
  label: string
}

export default function AgentesPage() {
  const { toast } = useToast()
  const [agents, setAgents] = useState<any[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [changingRole, setChangingRole] = useState<string | null>(null)
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'agent', phone: '' })
  const currentUser = getCurrentUser()


  function loadAgents() {
    apiFetch('admin', '/agents')
      .then(r => r.json() as Promise<any>)
      .then(d => { setAgents(Array.isArray(d) ? d : (d.agents || [])); setLoading(false) })
      .catch(() => setLoading(false))
  }

  function loadRoles() {
    apiFetch('admin', '/roles')
      .then(r => r.json() as Promise<any>)
      .then(d => { if (Array.isArray(d)) setRoles(d) })
      .catch(() => {})
  }

  useEffect(() => {
    loadAgents()
    loadRoles()
  }, [])

  useEffect(() => {
    if (!changingRole) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-role-popover]')) setChangingRole(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [changingRole])

  async function handleCreate() {
    if (!form.full_name || !form.email || !form.password) return
    setSaving(true)
    try {
      const res = await apiFetch('admin', '/create-agent', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      const data = (await res.json()) as any
      if (data.id || data.success) {
        toast('Agente creado')
        setShowCreate(false)
        setForm({ full_name: '', email: '', password: '', role: 'agent', phone: '' })
        loadAgents()
      } else {
        toast(data.error || 'Error al crear agente', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
    setSaving(false)
  }

  async function handleDelete(id: string, name: string) {
    if (id === currentUser?.id) { toast('No podés eliminarte a vos mismo', 'warning'); return }
    if (!confirm(`¿Eliminar a "${name}"?`)) return
    try {
      await apiFetch('admin', `/agents?id=${id}`, { method: 'DELETE' })
      toast('Agente eliminado', 'warning')
      loadAgents()
    } catch { toast('Error al eliminar', 'error') }
  }

  async function handleRoleChange(agentId: string, roleId: number, roleName: string) {
    setChangingRole(null)
    const prev = agents.find(a => a.id === agentId)?.role
    setAgents(list => list.map(a => a.id === agentId ? { ...a, role: roleName } : a))
    try {
      const res = await apiFetch('admin', '/agents/role', {
        method: 'PATCH',
        body: JSON.stringify({ id: agentId, role_id: roleId }),
      })
      const data = (await res.json()) as any
      if (!data.success) {
        setAgents(list => list.map(a => a.id === agentId ? { ...a, role: prev } : a))
        toast(data.error || 'Error al cambiar rol', 'error')
      } else {
        toast('Rol actualizado')
      }
    } catch {
      setAgents(list => list.map(a => a.id === agentId ? { ...a, role: prev } : a))
      toast('Error de conexión', 'error')
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Equipo</h1>
          <p className="text-gray-500 text-sm mt-1">{agents.length} agente{agents.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/objetivos" className="border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
            Objetivos
          </Link>
          <button onClick={() => setShowCreate(true)} className="bg-[#ff007c] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nuevo agente
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : agents.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No hay agentes todavía</p>
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map(agent => (
            <div key={agent.id} className="bg-white border rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#ff007c]/20 flex items-center justify-center text-[#ff007c] font-semibold shrink-0">
                {agent.full_name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-gray-800">{agent.full_name}</p>
                  {agent.id === currentUser?.id && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Tú</span>
                  )}

                  {agent.id === currentUser?.id ? (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getRoleColor(agent.role)}`}>
                      {getRoleLabel(agent.role)}
                    </span>
                  ) : (
                    <div className="relative" data-role-popover>
                      <button
                        onClick={() => setChangingRole(changingRole === agent.id ? null : agent.id)}
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5 hover:opacity-80 transition-opacity ${getRoleColor(agent.role)}`}
                      >
                        {getRoleLabel(agent.role)}
                        <ChevronDown className="w-2.5 h-2.5" />
                      </button>
                      {changingRole === agent.id && (
                        <div className="absolute top-6 left-0 z-20 bg-white border rounded-xl shadow-lg py-1 min-w-[160px]">
                          {roles.map(r => (
                            <button
                              key={r.id}
                              onClick={() => handleRoleChange(agent.id, r.id, r.name)}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                                agent.role === r.name ? 'font-medium text-[#ff007c]' : 'text-gray-700'
                              }`}
                            >
                              {agent.role === r.name
                                ? <Check className="w-3 h-3 shrink-0" />
                                : <span className="w-3 h-3 shrink-0" />
                              }
                              {r.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-400">
                  {agent.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{agent.email}</span>}
                  {agent.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{agent.phone}</span>}
                </div>
              </div>
              {agent.id !== currentUser?.id && (
                <button onClick={() => handleDelete(agent.id, agent.full_name)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800 mb-4">Nuevo agente</h3>
            <div className="space-y-3">
              <input placeholder="Nombre completo *" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm w-full" />
              <input placeholder="Email *" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm w-full" />
              <input placeholder="Contraseña *" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm w-full" />
              <input placeholder="Teléfono" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm w-full" />
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm w-full">
                <option value="agent">Agente</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowCreate(false)} className="flex-1 border rounded-lg py-2 text-sm">Cancelar</button>
              <button onClick={handleCreate} disabled={!form.full_name || !form.email || !form.password || saving}
                className="flex-1 bg-[#ff007c] text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
                {saving ? 'Creando...' : 'Crear agente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verificar typecheck del frontend**

```bash
cd vendepro-frontend && npx tsc --noEmit
```

Esperado: sin errores de tipo.

- [ ] **Step 4: Commit**

```bash
git add vendepro-frontend/src/lib/crm-config.ts
git add vendepro-frontend/src/app/(dashboard)/admin/agentes/page.tsx
git commit -m "feat(frontend): role change popover in agentes page"
```

---

## Checklist final

- [ ] Migración D1 ejecutada y verificada
- [ ] Tests del core pasan: `cd vendepro-backend/packages/core && npm run test`
- [ ] TypeScript sin errores en infrastructure, api-admin y frontend
- [ ] Backend deployado via GitHub Actions o CF Dashboard
- [ ] Verificar en producción: click en badge de rol → dropdown → cambio efectivo
