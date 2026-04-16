# Leads-Contactos Integration + Public API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vincular todo lead a un contacto, migrar datos existentes, y exponer un endpoint público autenticado con API key para recibir leads desde sitios web externos.

**Architecture:** Cada lead tiene una FK `contact_id` a la tabla `contacts`. Al crear un lead se acepta `contact_id` (existente) o `contact_data` (crea contacto en el mismo request). La API pública valida un header `X-API-Key` contra la columna `organizations.api_key` y crea contacto + lead automáticamente.

**Tech Stack:** Hono + Cloudflare Workers D1 (SQLite), Next.js 15 App Router, TypeScript, Tailwind CSS, Vitest para tests de backend.

**Spec:** `docs/superpowers/specs/2026-04-16-leads-contacts-integration-design.md`

**Codebase context:**
- Backend monorepo hexagonal en `vendepro-backend/`. Leer `doc/backend.md` antes de editar.
- `packages/core/` — dominio + use cases. `packages/infrastructure/` — repositorios D1. `packages/api-crm/` — Worker HTTP.
- Las migraciones van en `vendepro-backend/migrations_v2/` (actualmente 000–002).
- El frontend está en `vendepro-frontend/src/`. Usa `apiFetch(service, path, options)` de `@/lib/api` para llamadas API. Usa `useToast` de `@/components/ui/Toast` para feedback.
- No hay `components/leads/` — la lógica de leads vive en `src/app/(dashboard)/leads/page.tsx`.
- Las rutas protegidas usan `getCurrentUser()` en el backend.

---

## File Map

| Archivo | Acción | Qué cambia |
|---|---|---|
| `vendepro-backend/packages/core/src/application/use-cases/contacts/create-contact.ts` | Modificar | `role` → `contact_type`, agregar `neighborhood`, `source` |
| `vendepro-backend/packages/infrastructure/src/repositories/d1-contact-repository.ts` | Modificar | SQL usa `contact_type` (no `role`), agrega campos faltantes |
| `vendepro-backend/migrations_v2/003_leads_contact_id.sql` | Crear | `leads.contact_id` + `organizations.api_key` + migración de datos |
| `vendepro-backend/packages/core/src/domain/entities/lead.ts` | Modificar | Agregar `contact_id?: string \| null` a `LeadProps` |
| `vendepro-backend/packages/infrastructure/src/repositories/d1-lead-repository.ts` | Modificar | INSERT/SELECT incluyen `contact_id` |
| `vendepro-backend/packages/core/src/application/use-cases/leads/create-lead.ts` | Modificar | Agregar `contact_id?` a `CreateLeadInput` |
| `vendepro-backend/packages/api-crm/src/index.ts` | Modificar | POST /leads maneja `contact_data`; agregar POST/GET /api-key |
| `vendepro-backend/packages/api-crm/tests/lead-routes.test.ts` | Modificar | Tests para POST /leads con contact_data + /api-key |
| `vendepro-backend/packages/api-public/src/index.ts` | Modificar | Agregar POST /public/leads |
| `vendepro-frontend/src/lib/types.ts` | Modificar | Agregar `Contact` interface, `contact_id` en `Lead` |
| `vendepro-frontend/src/app/(dashboard)/leads/page.tsx` | Modificar | Modal "Nuevo lead" 2 pasos |
| `vendepro-frontend/src/app/(dashboard)/leads/[id]/page.tsx` | Modificar | Bloque "Ver contacto →" en header |
| `vendepro-frontend/src/app/(dashboard)/configuracion/page.tsx` | Modificar | Sección "Integración web" con gestión de API key |

---

## Task 1: Fix contacts bug — role → contact_type

**Problema:** `CreateContactInput` usa `role` pero la entidad `Contact` y la tabla D1 usan `contact_type`. El repositorio inserta en columna `role` que no existe. Los contactos nunca se guardan.

**Files:**
- Modify: `vendepro-backend/packages/core/src/application/use-cases/contacts/create-contact.ts`
- Modify: `vendepro-backend/packages/infrastructure/src/repositories/d1-contact-repository.ts`

- [ ] **Step 1: Reemplazar create-contact.ts completo**

```typescript
// vendepro-backend/packages/core/src/application/use-cases/contacts/create-contact.ts
import type { ContactRepository } from '../../ports/repositories/contact-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { Contact } from '../../../domain/entities/contact'

export interface CreateContactInput {
  org_id: string
  full_name: string
  phone?: string | null
  email?: string | null
  contact_type?: string | null
  neighborhood?: string | null
  source?: string | null
  notes?: string | null
  agent_id: string
}

export class CreateContactUseCase {
  constructor(
    private readonly contactRepo: ContactRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: CreateContactInput): Promise<{ id: string }> {
    const contact = Contact.create({
      id: this.idGen.generate(),
      org_id: input.org_id,
      full_name: input.full_name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      contact_type: input.contact_type ?? 'propietario',
      neighborhood: input.neighborhood ?? null,
      source: input.source ?? null,
      notes: input.notes ?? null,
      agent_id: input.agent_id,
    })
    await this.contactRepo.save(contact)
    return { id: contact.id }
  }
}
```

- [ ] **Step 2: Reemplazar d1-contact-repository.ts completo**

```typescript
// vendepro-backend/packages/infrastructure/src/repositories/d1-contact-repository.ts
import { Contact } from '@vendepro/core'
import type { ContactRepository, ContactFilters } from '@vendepro/core'

export class D1ContactRepository implements ContactRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string, orgId: string): Promise<Contact | null> {
    const row = await this.db
      .prepare('SELECT * FROM contacts WHERE id = ? AND org_id = ?')
      .bind(id, orgId)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async findByOrg(orgId: string, filters?: ContactFilters): Promise<Contact[]> {
    let query = 'SELECT * FROM contacts WHERE org_id = ?'
    const binds: unknown[] = [orgId]

    if (filters?.agent_id) { query += ' AND agent_id = ?'; binds.push(filters.agent_id) }
    if (filters?.search) {
      query += ' AND (full_name LIKE ? OR phone LIKE ? OR email LIKE ?)'
      binds.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`)
    }
    query += ' ORDER BY full_name LIMIT 200'

    const rows = (await this.db.prepare(query).bind(...binds).all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async save(contact: Contact): Promise<void> {
    const o = contact.toObject()
    await this.db.prepare(`
      INSERT INTO contacts (id, org_id, full_name, phone, email, contact_type, neighborhood, notes, source, agent_id, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        full_name=excluded.full_name, phone=excluded.phone, email=excluded.email,
        contact_type=excluded.contact_type, neighborhood=excluded.neighborhood,
        notes=excluded.notes, source=excluded.source
    `).bind(
      o.id, o.org_id, o.full_name, o.phone, o.email,
      o.contact_type, o.neighborhood, o.notes, o.source,
      o.agent_id, o.created_at
    ).run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.prepare('DELETE FROM contacts WHERE id = ? AND org_id = ?').bind(id, orgId).run()
  }

  private toEntity(row: any): Contact {
    return Contact.create({
      id: row.id,
      org_id: row.org_id,
      full_name: row.full_name,
      phone: row.phone ?? null,
      email: row.email ?? null,
      contact_type: row.contact_type ?? 'propietario',
      neighborhood: row.neighborhood ?? null,
      notes: row.notes ?? null,
      source: row.source ?? null,
      agent_id: row.agent_id,
      created_at: row.created_at,
    })
  }
}
```

- [ ] **Step 3: Verificar TypeScript**

Desde `vendepro-backend/packages/core/`:
```bash
npx tsc --noEmit
```
Esperado: sin errores.

Desde `vendepro-backend/packages/infrastructure/`:
```bash
npx tsc --noEmit
```
Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add vendepro-backend/packages/core/src/application/use-cases/contacts/create-contact.ts
git add vendepro-backend/packages/infrastructure/src/repositories/d1-contact-repository.ts
git commit -m "fix(contacts): corregir bug role → contact_type en use case y repositorio"
```

---

## Task 2: Migración DB — leads.contact_id + organizations.api_key

**Files:**
- Create: `vendepro-backend/migrations_v2/003_leads_contact_id.sql`

- [ ] **Step 1: Crear archivo de migración**

```sql
-- vendepro-backend/migrations_v2/003_leads_contact_id.sql

-- 1. Agregar contact_id a leads (nullable — se completa con migración de datos)
ALTER TABLE leads ADD COLUMN contact_id TEXT REFERENCES contacts(id);

-- 2. Agregar api_key a organizations
ALTER TABLE organizations ADD COLUMN api_key TEXT;

-- 3. Migración de datos: crear contactos desde leads existentes
--    Usa 'ct_' + lead_id como ID determinístico para poder vincular luego.
INSERT OR IGNORE INTO contacts (id, org_id, full_name, phone, email, contact_type, neighborhood, notes, source, agent_id, created_at)
SELECT
  'ct_' || l.id,
  l.org_id,
  l.full_name,
  l.phone,
  l.email,
  'propietario',
  l.neighborhood,
  l.notes,
  l.source,
  COALESCE(
    l.assigned_to,
    (SELECT u.id FROM users u WHERE u.org_id = l.org_id ORDER BY u.created_at LIMIT 1)
  ),
  l.created_at
FROM leads l
WHERE l.full_name IS NOT NULL
  AND trim(l.full_name) != ''
  AND l.contact_id IS NULL;

-- 4. Vincular leads con sus contactos recién creados
UPDATE leads
SET contact_id = 'ct_' || id
WHERE contact_id IS NULL
  AND full_name IS NOT NULL
  AND trim(full_name) != '';
```

- [ ] **Step 2: Aplicar migración**

La migración debe aplicarse manualmente en Cloudflare Dashboard → D1 → base de datos `vendepro-db` → "Execute query". Ejecutar las 4 partes en orden.

Para desarrollo local (si se usa `wrangler dev`):
```bash
# Desde vendepro-backend/packages/api-crm/
npx wrangler d1 execute vendepro-db --local --file=../../migrations_v2/003_leads_contact_id.sql
```

- [ ] **Step 3: Commit**

```bash
git add vendepro-backend/migrations_v2/003_leads_contact_id.sql
git commit -m "feat(db): migración 003 — leads.contact_id + organizations.api_key + datos"
```

---

## Task 3: Lead entity + D1LeadRepository — agregar contact_id

**Files:**
- Modify: `vendepro-backend/packages/core/src/domain/entities/lead.ts`
- Modify: `vendepro-backend/packages/infrastructure/src/repositories/d1-lead-repository.ts`

- [ ] **Step 1: Agregar contact_id a LeadProps en lead.ts**

En `vendepro-backend/packages/core/src/domain/entities/lead.ts`, en la interface `LeadProps` (después de `first_contact_at`), agregar:

```typescript
  contact_id?: string | null
```

La interface quedará:
```typescript
export interface LeadProps {
  id: string
  org_id: string
  full_name: string
  phone: string | null
  email: string | null
  source: string
  source_detail: string | null
  property_address: string | null
  neighborhood: string | null
  property_type: string | null
  operation: string
  stage: LeadStageValue
  assigned_to: string | null
  notes: string | null
  estimated_value: number | null
  budget: string | null
  timing: string | null
  personas_trabajo: string | null
  mascotas: string | null
  next_step: string | null
  next_step_date: string | null
  lost_reason: string | null
  first_contact_at: string | null
  contact_id?: string | null   // ← nuevo
  created_at: string
  updated_at: string
  // Computed
  tags?: string[]
  assigned_name?: string
  last_activity_at?: string | null
}
```

Agregar también el getter después de `get first_contact_at()`:
```typescript
  get contact_id() { return this.props.contact_id ?? null }
```

- [ ] **Step 2: Actualizar D1LeadRepository — INSERT incluye contact_id**

En `d1-lead-repository.ts`, reemplazar el método `save()` completo:

```typescript
  async save(lead: Lead): Promise<void> {
    const o = lead.toObject()
    await this.db.prepare(`
      INSERT INTO leads (id, org_id, full_name, phone, email, source, source_detail, property_address,
        neighborhood, property_type, operation, stage, assigned_to, notes, estimated_value, budget,
        timing, personas_trabajo, mascotas, next_step, next_step_date, lost_reason, first_contact_at,
        contact_id, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        stage=excluded.stage, assigned_to=excluded.assigned_to, notes=excluded.notes,
        estimated_value=excluded.estimated_value, budget=excluded.budget, timing=excluded.timing,
        personas_trabajo=excluded.personas_trabajo, mascotas=excluded.mascotas,
        next_step=excluded.next_step, next_step_date=excluded.next_step_date,
        lost_reason=excluded.lost_reason, first_contact_at=excluded.first_contact_at,
        full_name=excluded.full_name, phone=excluded.phone, email=excluded.email,
        neighborhood=excluded.neighborhood, contact_id=excluded.contact_id,
        updated_at=excluded.updated_at
    `).bind(
      o.id, o.org_id, o.full_name, o.phone, o.email, o.source, o.source_detail,
      o.property_address, o.neighborhood, o.property_type, o.operation, o.stage,
      o.assigned_to, o.notes, o.estimated_value, o.budget, o.timing, o.personas_trabajo,
      o.mascotas, o.next_step, o.next_step_date, o.lost_reason, o.first_contact_at,
      o.contact_id ?? null, o.created_at, o.updated_at
    ).run()
  }
```

- [ ] **Step 3: Actualizar toEntity en D1LeadRepository para incluir contact_id**

En el método `private toEntity(row: any): Lead`, agregar `contact_id: row.contact_id ?? null` antes de `created_at`:

```typescript
  private toEntity(row: any): Lead {
    return Lead.create({
      id: row.id, org_id: row.org_id, full_name: row.full_name, phone: row.phone,
      email: row.email, source: row.source, source_detail: row.source_detail,
      property_address: row.property_address, neighborhood: row.neighborhood,
      property_type: row.property_type, operation: row.operation, stage: row.stage,
      assigned_to: row.assigned_to, notes: row.notes, estimated_value: row.estimated_value,
      budget: row.budget, timing: row.timing, personas_trabajo: row.personas_trabajo,
      mascotas: row.mascotas, next_step: row.next_step, next_step_date: row.next_step_date,
      lost_reason: row.lost_reason, first_contact_at: row.first_contact_at,
      contact_id: row.contact_id ?? null,
      created_at: row.created_at, updated_at: row.updated_at,
      assigned_name: row.assigned_name,
    })
  }
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd vendepro-backend && npx tsc --noEmit -p packages/core/tsconfig.json && npx tsc --noEmit -p packages/infrastructure/tsconfig.json
```
Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add vendepro-backend/packages/core/src/domain/entities/lead.ts
git add vendepro-backend/packages/infrastructure/src/repositories/d1-lead-repository.ts
git commit -m "feat(lead): agregar contact_id a entidad Lead y D1LeadRepository"
```

---

## Task 4: CreateLeadUseCase — aceptar contact_id

**Files:**
- Modify: `vendepro-backend/packages/core/src/application/use-cases/leads/create-lead.ts`

- [ ] **Step 1: Agregar contact_id a CreateLeadInput y pasarlo al Lead.create()**

Reemplazar `create-lead.ts` completo:

```typescript
// vendepro-backend/packages/core/src/application/use-cases/leads/create-lead.ts
import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { Lead } from '../../../domain/entities/lead'

export interface CreateLeadInput {
  org_id: string
  full_name: string
  phone?: string | null
  email?: string | null
  source: string
  source_detail?: string | null
  property_address?: string | null
  neighborhood?: string | null
  property_type?: string
  operation?: string
  assigned_to: string
  notes?: string | null
  estimated_value?: string | null
  next_step?: string | null
  next_step_date?: string | null
  budget?: number | null
  contact_id?: string | null
}

export class CreateLeadUseCase {
  constructor(
    private readonly leadRepo: LeadRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: CreateLeadInput): Promise<{ id: string }> {
    const lead = Lead.create({
      id: this.idGen.generate(),
      org_id: input.org_id,
      full_name: input.full_name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      source: input.source,
      source_detail: input.source_detail ?? null,
      property_address: input.property_address ?? null,
      neighborhood: input.neighborhood ?? null,
      property_type: input.property_type ?? 'departamento',
      operation: input.operation ?? 'venta',
      stage: 'nuevo',
      assigned_to: input.assigned_to,
      notes: input.notes ?? null,
      estimated_value: input.estimated_value ? parseFloat(String(input.estimated_value)) : null,
      budget: input.budget ?? null,
      timing: null,
      personas_trabajo: null,
      mascotas: null,
      next_step: input.next_step ?? null,
      next_step_date: input.next_step_date ?? null,
      lost_reason: null,
      first_contact_at: null,
      contact_id: input.contact_id ?? null,
    })

    await this.leadRepo.save(lead)
    return { id: lead.id }
  }
}
```

- [ ] **Step 2: Verificar TypeScript en core**

```bash
cd vendepro-backend && npx tsc --noEmit -p packages/core/tsconfig.json
```
Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add vendepro-backend/packages/core/src/application/use-cases/leads/create-lead.ts
git commit -m "feat(lead): CreateLeadInput acepta contact_id opcional"
```

---

## Task 5: api-crm — POST /leads con contact_data + POST/GET /api-key

**Files:**
- Modify: `vendepro-backend/packages/api-crm/src/index.ts`
- Modify: `vendepro-backend/packages/api-crm/tests/lead-routes.test.ts`

- [ ] **Step 1: Actualizar POST /leads en api-crm/src/index.ts**

Reemplazar el handler de `app.post('/leads', ...)` existente con:

```typescript
app.post('/leads', async (c) => {
  const body = (await c.req.json()) as any

  let contact_id: string | undefined = body.contact_id

  // Si viene contact_data, crear el contacto primero
  if (!contact_id && body.contact_data) {
    const contactRepo = new D1ContactRepository(c.env.DB)
    const createContact = new CreateContactUseCase(contactRepo, new CryptoIdGenerator())
    const contactResult = await createContact.execute({
      ...body.contact_data,
      org_id: c.get('orgId'),
      agent_id: c.get('userId'),
    })
    contact_id = contactResult.id
  }

  const repo = new D1LeadRepository(c.env.DB)
  const useCase = new CreateLeadUseCase(repo, new CryptoIdGenerator())
  const result = await useCase.execute({
    ...body,
    contact_id: contact_id ?? null,
    org_id: c.get('orgId'),
    assigned_to: body.assigned_to || c.get('userId'),
  })
  return c.json(result, 201)
})
```

- [ ] **Step 2: Agregar POST /api-key y GET /api-key al final de la sección de rutas de api-crm/src/index.ts**

Agregar antes de `export default app`:

```typescript
// ── API KEY ────────────────────────────────────────────────────
app.post('/api-key', async (c) => {
  const orgId = c.get('orgId')
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const hex = Array.from(bytes).map((b: number) => b.toString(16).padStart(2, '0')).join('')
  const apiKey = `vp_live_${hex}`
  await c.env.DB.prepare('UPDATE organizations SET api_key = ? WHERE id = ?').bind(apiKey, orgId).run()
  return c.json({ api_key: apiKey })
})

app.get('/api-key', async (c) => {
  const orgId = c.get('orgId')
  const row = await c.env.DB.prepare('SELECT api_key FROM organizations WHERE id = ?').bind(orgId).first() as any
  if (!row?.api_key) return c.json({ has_key: false, api_key_masked: null })
  const key = row.api_key as string
  const masked = `vp_live_••••••••••••${key.slice(-4)}`
  return c.json({ has_key: true, api_key_masked: masked })
})
```

- [ ] **Step 3: Agregar tests para las nuevas rutas**

Agregar al final de `describe('api-crm lead routes', ...)` en `tests/lead-routes.test.ts`:

```typescript
  it('POST /leads with contact_data creates contact then lead', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_data: { full_name: 'María González', contact_type: 'propietario' },
        source: 'manual',
      }),
    }, { DB: {}, JWT_SECRET: 'secret' })
    expect(res.status).toBe(201)
    const body = await res.json() as any
    expect(body.id).toBe('gen-id')
  })

  it('POST /api-key stores and returns new key', async () => {
    const mockRun = vi.fn().mockResolvedValue({})
    const mockFirst = vi.fn().mockResolvedValue(null)
    const mockDB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({ run: mockRun, first: mockFirst }),
      }),
    }
    const { default: app } = await import('../src/index')
    const res = await app.request('/api-key', {
      method: 'POST',
    }, { DB: mockDB, JWT_SECRET: 'secret' })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.api_key).toMatch(/^vp_live_[0-9a-f]{32}$/)
  })

  it('GET /api-key returns has_key false when no key', async () => {
    const mockDB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue({ api_key: null }) }),
      }),
    }
    const { default: app } = await import('../src/index')
    const res = await app.request('/api-key', { method: 'GET' }, { DB: mockDB, JWT_SECRET: 'secret' })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.has_key).toBe(false)
  })
```

**Nota:** Los tests de `/api-key` usan un `mockDB` inline porque necesitan controlar el comportamiento de `DB.prepare` directamente, sin el mock global. Importar `app` en cada test que usa `mockDB` inline (los tests de api-key hacen `await import('../src/index')` por separado, pero como vitest cachea modules necesitás hacer `vi.resetModules()` antes o usar `vi.isolateModules`. La forma más simple es hacerlo en tests separados con su propio mock de DB pasado como tercer argumento a `app.request`.

En la práctica, los tests de `/api-key` ya reciben `{ DB: mockDB }` como env (tercer argumento de `app.request`) entonces funcionan correctamente ya que Hono usa ese env object directamente para `c.env.DB`.

- [ ] **Step 4: Correr tests**

```bash
cd vendepro-backend/packages/api-crm && npx vitest run
```
Esperado: todos los tests pasan.

- [ ] **Step 5: Commit**

```bash
git add vendepro-backend/packages/api-crm/src/index.ts
git add vendepro-backend/packages/api-crm/tests/lead-routes.test.ts
git commit -m "feat(api-crm): POST /leads acepta contact_data; agregar POST/GET /api-key"
```

---

## Task 6: api-public — POST /public/leads

**Files:**
- Modify: `vendepro-backend/packages/api-public/src/index.ts`

- [ ] **Step 1: Agregar el endpoint POST /public/leads**

Agregar antes de `export default app` en `packages/api-public/src/index.ts`:

```typescript
// ── PUBLIC LEADS (/public/leads) ─────────────────────────────
app.post('/public/leads', async (c) => {
  const apiKey = c.req.header('X-API-Key')
  if (!apiKey) return c.json({ error: 'API key requerida' }, 401)

  const db = c.env.DB

  // 1. Buscar organización por api_key
  const org = await db
    .prepare('SELECT id FROM organizations WHERE api_key = ?')
    .bind(apiKey)
    .first() as any
  if (!org) return c.json({ error: 'API key inválida' }, 401)

  const orgId = org.id as string
  const body = (await c.req.json()) as any

  if (!body.full_name?.trim()) {
    return c.json({ error: 'full_name es requerido' }, 400)
  }

  // 2. Obtener primer admin de la org (para agent_id)
  const admin = await db
    .prepare("SELECT id FROM users WHERE org_id = ? AND role = 'admin' ORDER BY created_at LIMIT 1")
    .bind(orgId)
    .first() as any
  if (!admin) return c.json({ error: 'Organización sin administrador configurado' }, 422)

  const agentId = admin.id as string
  const now = new Date().toISOString()

  // 3. Crear contacto
  const contactId = crypto.randomUUID().replace(/-/g, '')
  await db.prepare(`
    INSERT INTO contacts (id, org_id, full_name, phone, email, contact_type, notes, source, agent_id, created_at)
    VALUES (?, ?, ?, ?, ?, 'otro', ?, 'web', ?, ?)
  `).bind(
    contactId, orgId, body.full_name.trim(),
    body.phone ?? null, body.email ?? null,
    body.notes ?? null, agentId, now
  ).run()

  // 4. Crear lead
  const leadId = crypto.randomUUID().replace(/-/g, '')
  await db.prepare(`
    INSERT INTO leads (id, org_id, full_name, phone, email, source, source_detail, operation, stage, contact_id, assigned_to, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'web', ?, ?, 'nuevo', ?, ?, ?, ?)
  `).bind(
    leadId, orgId, body.full_name.trim(),
    body.phone ?? null, body.email ?? null,
    body.source_detail ?? null,
    body.operation ?? 'otro',
    contactId, agentId, now, now
  ).run()

  return c.json({ id: leadId, success: true }, 201)
})
```

- [ ] **Step 2: Verificar TypeScript en api-public**

```bash
cd vendepro-backend/packages/api-public && npx tsc --noEmit
```
Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add vendepro-backend/packages/api-public/src/index.ts
git commit -m "feat(api-public): agregar POST /public/leads autenticado con X-API-Key"
```

---

## Task 7: Frontend — tipos Contact + Lead.contact_id

**Files:**
- Modify: `vendepro-frontend/src/lib/types.ts`

- [ ] **Step 1: Agregar interface Contact y contact_id a Lead**

En `vendepro-frontend/src/lib/types.ts`, agregar después de la interface `LeadTag`:

```typescript
export interface Contact {
  id: string
  org_id: string
  full_name: string
  phone: string | null
  email: string | null
  contact_type: string
  neighborhood: string | null
  notes: string | null
  source: string | null
  agent_id: string
  created_at: string
}
```

En la interface `Lead`, agregar `contact_id` después de `appraisal_count`:

```typescript
  appraisal_count?: number
  contact_id?: string | null
```

- [ ] **Step 2: Verificar TypeScript en frontend**

```bash
cd vendepro-frontend && npx tsc --noEmit
```
Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add vendepro-frontend/src/lib/types.ts
git commit -m "feat(types): agregar Contact interface y contact_id a Lead"
```

---

## Task 8: Frontend — Modal "Nuevo lead" en 2 pasos

**Contexto:** El modal de creación vive en `vendepro-frontend/src/app/(dashboard)/leads/page.tsx`. Actualmente es un form plano de un solo paso. Necesita convertirse en un modal de 2 pasos:
- **Paso 1:** buscar o crear contacto (búsqueda debounced por nombre/teléfono/email)
- **Paso 2:** datos del pipeline (fuente, operación, barrio, etc.)

**Files:**
- Modify: `vendepro-frontend/src/app/(dashboard)/leads/page.tsx`

- [ ] **Step 1: Agregar imports necesarios**

Agregar `useRef` a los imports de React si no está ya:
```typescript
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
```

Agregar `Contact` a los imports de types:
```typescript
import type { Lead, Contact } from '@/lib/types'
```

Agregar estos iconos de lucide-react (si no están ya):
```typescript
import {
  Plus, Search, Phone, MessageCircle, Filter, X, LayoutList, Columns3,
  AlertTriangle, Clock, User, MapPin, DollarSign, ArrowRight, ChevronDown,
  Download, Sparkles, Trash2, GripVertical, ChevronRight, Check
} from 'lucide-react'
```

- [ ] **Step 2: Reemplazar el estado del formulario de creación**

Reemplazar el estado `form` y agregar los nuevos estados del modal de 2 pasos. Ubicar donde está actualmente:
```typescript
const [form, setForm] = useState({
  full_name: '', phone: '', ...
})
```

Reemplazar ese bloque con:
```typescript
// ── Modal de creación — 2 pasos ──────────────────────────────
const [createStep, setCreateStep] = useState<1 | 2>(1)
const [contactSearch, setContactSearch] = useState('')
const [contactResults, setContactResults] = useState<Contact[]>([])
const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
const [showNewContactForm, setShowNewContactForm] = useState(false)
const [contactForm, setContactForm] = useState({
  full_name: '', phone: '', email: '', contact_type: 'propietario'
})
const contactSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

const [form, setForm] = useState({
  source: 'manual', source_detail: '',
  property_address: '', neighborhood: '', operation: 'venta',
  notes: '', estimated_value: '', assigned_to: '', next_step: '', next_step_date: ''
})
```

- [ ] **Step 3: Agregar efecto de búsqueda debounced de contactos**

Agregar este `useEffect` después del que carga leads y agentes:
```typescript
  useEffect(() => {
    if (!contactSearch.trim() || selectedContact) {
      setContactResults([])
      return
    }
    if (contactSearchRef.current) clearTimeout(contactSearchRef.current)
    contactSearchRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch('crm', `/contacts?search=${encodeURIComponent(contactSearch)}`)
        const data = (await res.json()) as any
        setContactResults(Array.isArray(data) ? data.slice(0, 5) : [])
      } catch {
        setContactResults([])
      }
    }, 300)
  }, [contactSearch, selectedContact])
```

- [ ] **Step 4: Agregar función closeCreateModal y actualizar handleCreate**

Agregar estas funciones:
```typescript
  const closeCreateModal = () => {
    setShowCreate(false)
    setCreateStep(1)
    setContactSearch('')
    setContactResults([])
    setSelectedContact(null)
    setShowNewContactForm(false)
    setContactForm({ full_name: '', phone: '', email: '', contact_type: 'propietario' })
    setForm({
      source: 'manual', source_detail: '', property_address: '', neighborhood: '',
      operation: 'venta', notes: '', estimated_value: '', assigned_to: '',
      next_step: '', next_step_date: ''
    })
  }

  const handleCreate = async () => {
    setSaving(true)
    try {
      const payload: any = { ...form }

      if (selectedContact?.id) {
        payload.contact_id = selectedContact.id
      } else {
        payload.contact_data = {
          full_name: contactForm.full_name.trim(),
          phone: contactForm.phone || null,
          email: contactForm.email || null,
          contact_type: contactForm.contact_type,
        }
      }

      const res = await apiFetch('crm', '/leads', { method: 'POST', body: JSON.stringify(payload) })
      const data = (await res.json()) as any
      if (data.id) {
        closeCreateModal()
        toast('Lead creado correctamente')
        loadLeads()
      } else {
        toast(data.error || 'Error al crear lead', 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    }
    setSaving(false)
  }
```

El paso 2 puede avanzar cuando hay contacto seleccionado o cuando el formulario nuevo tiene nombre:
```typescript
  const canProceedStep1 = selectedContact !== null ||
    (showNewContactForm && contactForm.full_name.trim().length >= 2)
```

- [ ] **Step 5: Reemplazar el JSX del modal CREATE**

Buscar el bloque `{/* CREATE MODAL */}` y reemplazarlo completo con el modal de 2 pasos. También reemplazar los `setShowCreate(false)` en el botón X y en el backdrop con `closeCreateModal()`:

```tsx
{/* CREATE MODAL */}
{showCreate && (
  <div
    className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    onClick={closeCreateModal}
  >
    <div
      className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto"
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between rounded-t-2xl z-10">
        <div>
          <h3 className="font-semibold text-gray-800">Nuevo lead</h3>
          <p className="text-xs text-gray-400">
            {createStep === 1 ? 'Paso 1 de 2 — Contacto' : 'Paso 2 de 2 — Pipeline'}
          </p>
        </div>
        <button onClick={closeCreateModal} className="p-1 hover:bg-gray-100 rounded-lg">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* PASO 1: Contacto */}
      {createStep === 1 && (
        <div className="p-4 space-y-3">
          {/* Contacto seleccionado */}
          {selectedContact ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-green-600 shrink-0" />
                <span className="font-medium text-gray-800">{selectedContact.full_name}</span>
                <span className="text-gray-500">·</span>
                <span className="text-gray-500 capitalize">{selectedContact.contact_type}</span>
              </div>
              <button
                onClick={() => { setSelectedContact(null); setContactSearch('') }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              {/* Buscador */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, teléfono o email..."
                  value={contactSearch}
                  onChange={e => { setContactSearch(e.target.value); setShowNewContactForm(false) }}
                  className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/30 focus:border-[#ff007c]"
                  autoFocus
                />
              </div>

              {/* Resultados */}
              {contactResults.length > 0 && !showNewContactForm && (
                <div className="border rounded-lg overflow-hidden">
                  {contactResults.map(ct => (
                    <button
                      key={ct.id}
                      onClick={() => { setSelectedContact(ct); setContactSearch(''); setContactResults([]) }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left border-b last:border-b-0"
                    >
                      <User className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{ct.full_name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {[ct.phone, ct.contact_type].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Formulario nuevo contacto */}
              {showNewContactForm ? (
                <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Nuevo contacto</p>
                  <input
                    placeholder="Nombre completo *"
                    value={contactForm.full_name}
                    onChange={e => setContactForm({ ...contactForm, full_name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    autoFocus
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      placeholder="Teléfono"
                      value={contactForm.phone}
                      onChange={e => setContactForm({ ...contactForm, phone: e.target.value })}
                      className="border rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      placeholder="Email"
                      type="email"
                      value={contactForm.email}
                      onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                      className="border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <select
                    value={contactForm.contact_type}
                    onChange={e => setContactForm({ ...contactForm, contact_type: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="propietario">Propietario</option>
                    <option value="comprador">Comprador</option>
                    <option value="inversor">Inversor</option>
                    <option value="inquilino">Inquilino</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              ) : (
                <button
                  onClick={() => { setShowNewContactForm(true); setContactSearch(''); setContactResults([]) }}
                  className="w-full text-sm text-[#ff007c] hover:underline text-left px-1"
                >
                  + Crear contacto nuevo
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* PASO 2: Pipeline */}
      {createStep === 2 && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full">
              {Object.entries(LEAD_SOURCES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={form.operation} onChange={e => setForm({ ...form, operation: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full">
              {Object.entries(OPERATION_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input placeholder="Barrio/Zona" value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
            <input placeholder="Dirección propiedad" value={form.property_address} onChange={e => setForm({ ...form, property_address: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
            <input placeholder="Valor estimado (USD)" type="number" value={form.estimated_value} onChange={e => setForm({ ...form, estimated_value: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
            {agents.length > 0 && (
              <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full">
                <option value="">Asignar agente...</option>
                {agents.map((a: any) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </select>
            )}
          </div>
          <input placeholder="Próxima acción" value={form.next_step} onChange={e => setForm({ ...form, next_step: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
          <input type="date" value={form.next_step_date} onChange={e => setForm({ ...form, next_step_date: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
          <textarea placeholder="Notas" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
        </div>
      )}

      {/* Footer con botones de navegación */}
      <div className="sticky bottom-0 bg-white border-t px-4 py-3 flex gap-2">
        {createStep === 1 ? (
          <>
            <button onClick={closeCreateModal} className="flex-1 px-4 py-2 border rounded-lg text-sm">Cancelar</button>
            <button
              onClick={() => setCreateStep(2)}
              disabled={!canProceedStep1}
              className="flex-1 px-4 py-2 bg-[#ff007c] text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1"
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setCreateStep(1)} className="flex-1 px-4 py-2 border rounded-lg text-sm">← Atrás</button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-[#ff007c] text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Crear lead'}
            </button>
          </>
        )}
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 6: Mover la declaración de canProceedStep1 al bloque de estado**

`canProceedStep1` usa `selectedContact`, `showNewContactForm` y `contactForm` — debe declararse como variable derivada en el cuerpo del componente (no dentro de ningún handler), justo antes del return. Agregar:

```typescript
  const canProceedStep1 = selectedContact !== null ||
    (showNewContactForm && contactForm.full_name.trim().length >= 2)
```

- [ ] **Step 7: Verificar TypeScript**

```bash
cd vendepro-frontend && npx tsc --noEmit
```
Esperado: sin errores.

- [ ] **Step 8: Commit**

```bash
git add vendepro-frontend/src/app/(dashboard)/leads/page.tsx
git commit -m "feat(leads): modal de creación en 2 pasos — contacto + pipeline"
```

---

## Task 9: Frontend — bloque "Ver contacto →" en /leads/[id]

**Contexto:** El detalle del lead (`leads/[id]/page.tsx`) necesita mostrar el contacto vinculado en el header. El campo `contact_id` viene en el objeto lead. Con ese ID se hace un segundo fetch a `/contacts?search=` no, mejor a... espera, no hay endpoint `GET /contacts/:id`. Usamos `GET /contacts?search=` con el full_name, pero eso no garantiza resultado único.

Mejor opción: El endpoint `GET /leads/:id` en api-crm devuelve el lead con `contact_id`. Para mostrar el nombre del contacto, necesitamos un fetch adicional. Pero no hay `GET /contacts/:id` en api-crm.

La solución más simple sin agregar endpoint nuevo: como el lead ya tiene `full_name` que coincide con el contacto (fue creado desde el lead), mostrar el bloque con el `full_name` del lead y un link a `/contactos`. Si hay `contact_id` se muestra el bloque; si no hay (lead viejo sin migrar), no se muestra.

**Files:**
- Modify: `vendepro-frontend/src/app/(dashboard)/leads/[id]/page.tsx`

- [ ] **Step 1: Verificar que la interface Lead tiene contact_id**

El archivo `types.ts` ya fue actualizado en Task 7. Confirmar que `lead.contact_id` está disponible en el tipo.

- [ ] **Step 2: Agregar bloque de contacto en el header del detalle**

En `leads/[id]/page.tsx`, leer el archivo primero para ubicar el header del detalle (es la sección con el nombre del lead, stage selector y botones de acción). La sección está aproximadamente en el `<div className="bg-white ...">` que contiene el nombre del lead.

Agregar el bloque de contacto **inmediatamente después del nombre del lead** (después del `<h1>` con `lead.full_name`), antes de los badges de urgencia:

```tsx
{/* Bloque contacto */}
{lead.contact_id && (
  <Link
    href="/contactos"
    className="inline-flex items-center gap-2 text-sm text-gray-600 bg-gray-50 border rounded-lg px-3 py-1.5 hover:bg-gray-100 transition-colors"
  >
    <User className="w-4 h-4 text-gray-400 shrink-0" />
    <span className="font-medium truncate max-w-[180px]">{lead.full_name}</span>
    <span className="text-gray-400">·</span>
    <span className="text-gray-500 text-xs">Contacto</span>
    <ChevronRight className="w-3 h-3 text-gray-400 ml-1" />
  </Link>
)}
```

Asegurarse de que `User`, `ChevronRight` y `Link` estén importados. `Link` de `next/link`, `User` y `ChevronRight` de `lucide-react`.

- [ ] **Step 3: Verificar TypeScript**

```bash
cd vendepro-frontend && npx tsc --noEmit
```
Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add vendepro-frontend/src/app/(dashboard)/leads/[id]/page.tsx
git commit -m "feat(leads): mostrar bloque 'Ver contacto' en detalle de lead"
```

---

## Task 10: Frontend — sección "Integración web" en /configuracion

**Files:**
- Modify: `vendepro-frontend/src/app/(dashboard)/configuracion/page.tsx`

- [ ] **Step 1: Agregar imports necesarios**

Agregar a los imports de lucide-react: `Key`, `Copy`, `RefreshCw`, `CheckCircle2`

```typescript
import { Settings, Save, Loader2, Building2, Palette, Link2, CheckCircle, XCircle, Key, Copy, RefreshCw, CheckCircle2 } from 'lucide-react'
```

- [ ] **Step 2: Agregar estado para API key**

Agregar estos estados en el componente (después de los estados existentes):

```typescript
  const [apiKeyData, setApiKeyData] = useState<{ has_key: boolean; api_key_masked: string | null } | null>(null)
  const [newApiKey, setNewApiKey] = useState<string | null>(null)
  const [generatingKey, setGeneratingKey] = useState(false)
  const [copied, setCopied] = useState(false)
```

- [ ] **Step 3: Cargar API key en el useEffect inicial**

En el `useEffect` que carga la configuración, agregar la llamada al endpoint de API key. Modificar el `Promise.all`:

```typescript
  useEffect(() => {
    Promise.all([
      apiFetch('admin', '/org-settings').then(r => r.json() as Promise<any>),
      apiFetch('crm', '/api-key').then(r => r.json() as Promise<any>).catch(() => null),
    ]).then(([data, keyData]) => {
      if (data.settings) setSettings(data.settings)
      if (data.org) setOrg(data.org)
      if (data.slug) setSlug(data.slug)
      if (keyData) setApiKeyData(keyData)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])
```

- [ ] **Step 4: Agregar handlers para generación y copia**

```typescript
  const handleGenerateApiKey = async (isRegenerate = false) => {
    if (isRegenerate && !confirm('¿Regenerar la API key? La key anterior dejará de funcionar.')) return
    setGeneratingKey(true)
    try {
      const res = await apiFetch('crm', '/api-key', { method: 'POST' })
      const data = (await res.json()) as any
      if (data.api_key) {
        setNewApiKey(data.api_key)
        setApiKeyData({ has_key: true, api_key_masked: `vp_live_••••••••••••${data.api_key.slice(-4)}` })
        toast('API key generada — copiala ahora, no se mostrará completa nuevamente')
      }
    } catch { toast('Error al generar API key', 'error') }
    setGeneratingKey(false)
  }

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
```

- [ ] **Step 5: Agregar la sección "Integración web" al JSX**

Agregar al final del `return`, antes del cierre del `<div className="max-w-3xl space-y-6">`:

```tsx
      {/* Integración web */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
          <Key className="w-4 h-4 text-[#ff007c]" /> Integración web
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Recibí leads automáticamente desde tu sitio web usando tu API key.
        </p>

        {/* Gestión de API key */}
        <div className="border rounded-lg p-4 mb-4 bg-gray-50">
          <p className="text-sm font-medium text-gray-700 mb-3">API Key</p>

          {/* Nueva key recién generada — mostrar completa */}
          {newApiKey && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700 mb-2 font-medium">Copiá esta key — no se mostrará nuevamente:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-white border rounded px-2 py-1 truncate">{newApiKey}</code>
                <button
                  onClick={() => handleCopyKey(newApiKey)}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs bg-[#ff007c] text-white rounded hover:opacity-90"
                >
                  {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
          )}

          {apiKeyData?.has_key ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono bg-white border rounded px-3 py-2 text-gray-600">
                {apiKeyData.api_key_masked}
              </code>
              <button
                onClick={() => handleGenerateApiKey(true)}
                disabled={generatingKey}
                className="shrink-0 flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-100 disabled:opacity-50"
                title="Regenerar key"
              >
                <RefreshCw className={`w-4 h-4 ${generatingKey ? 'animate-spin' : ''}`} />
                Regenerar
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleGenerateApiKey(false)}
              disabled={generatingKey}
              className="flex items-center gap-2 px-4 py-2 bg-[#ff007c] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {generatingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              Generar API key
            </button>
          )}
        </div>

        {/* Snippet de código */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-gray-400 font-mono">JavaScript</span>
            <button
              onClick={() => handleCopyKey(`fetch('https://public.api.vendepro.com.ar/public/leads', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'TU_API_KEY'
  },
  body: JSON.stringify({
    full_name: 'Juan Pérez',
    phone: '1123456789',
    email: 'juan@email.com',
    operation: 'venta',
    source_detail: 'Formulario Home'
  })
})`)}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
            >
              <Copy className="w-3 h-3" /> Copiar
            </button>
          </div>
          <pre className="bg-gray-900 text-green-400 text-xs font-mono p-4 overflow-x-auto">{`fetch('https://public.api.vendepro.com.ar/public/leads', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'TU_API_KEY'
  },
  body: JSON.stringify({
    full_name: 'Juan Pérez',      // requerido
    phone: '1123456789',          // opcional
    email: 'juan@email.com',      // opcional
    operation: 'venta',           // venta | alquiler | tasacion | otro
    source_detail: 'Formulario Home'  // texto libre
  })
})`}</pre>
        </div>

        {/* Tabla de campos */}
        <div className="mt-4 border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-600">Campo</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-600">Tipo</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-600">Requerido</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-600 hidden sm:table-cell">Descripción</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                ['full_name', 'string', 'Sí', 'Nombre completo del contacto'],
                ['phone', 'string', 'No', 'Teléfono'],
                ['email', 'string', 'No', 'Email'],
                ['operation', 'string', 'No', 'venta | alquiler | tasacion | otro'],
                ['source_detail', 'string', 'No', 'Ej: "Formulario Home"'],
                ['notes', 'string', 'No', 'Notas adicionales'],
              ].map(([campo, tipo, req, desc]) => (
                <tr key={campo} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs text-[#ff007c]">{campo}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{tipo}</td>
                  <td className="px-3 py-2 text-xs">{req === 'Sí' ? <span className="text-green-600 font-medium">Sí</span> : <span className="text-gray-400">No</span>}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs hidden sm:table-cell">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
```

- [ ] **Step 6: Verificar TypeScript**

```bash
cd vendepro-frontend && npx tsc --noEmit
```
Esperado: sin errores.

- [ ] **Step 7: Commit**

```bash
git add vendepro-frontend/src/app/(dashboard)/configuracion/page.tsx
git commit -m "feat(configuracion): sección Integración web con gestión de API key"
```

---

## Notas para el reviewer

- El Contact entity no tiene `updated_at` — el SQL de `save()` en el repositorio no debe incluirlo.
- Los tests de `/api-key` pasan su propio `mockDB` como tercer argumento a `app.request()` ya que `c.env.DB` en Hono toma el segundo argumento del handler como el env object.
- La migración de datos (paso 3 y 4 del SQL) es idempotente: usa `INSERT OR IGNORE` y el `UPDATE` solo afecta filas con `contact_id IS NULL`.
- El bloque "Ver contacto" en leads/[id] muestra el `full_name` del lead (no del contacto por separado) porque ambos se crearon con el mismo nombre. Una futura iteración puede hacer fetch al endpoint de contacto cuando exista `GET /contacts/:id`.
- La sección "Integración web" en configuracion carga `/api-key` con `apiFetch('crm', '/api-key')` — usar el servicio `crm` (no `admin`).
