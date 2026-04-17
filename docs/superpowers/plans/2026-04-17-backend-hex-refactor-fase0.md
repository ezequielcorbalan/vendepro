# Backend Hexagonal Refactor — Plan Fase 0 (Foundational)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nivelar `@vendepro/core` y `@vendepro/infrastructure` para desbloquear los refactors worker-por-worker (Fases 1-8). Al terminar esta fase existen todas las entidades, ports, adapters y tests de dominio necesarios; el setup de Miniflare está operativo; los 2 bugs detectados están corregidos.

**Architecture:** Se trabaja exclusivamente sobre `vendepro-backend/packages/core/` y `vendepro-backend/packages/infrastructure/`. Ningún worker se toca en esta fase. Tests unitarios de dominio con Vitest puro; tests de integración de infraestructura con `@cloudflare/vitest-pool-workers` (ya instalado como devDep) que monta D1 in-memory vía Miniflare con `schema.sql` aplicado.

**Tech Stack:** TypeScript 5.8, Vitest 3.2, `@cloudflare/vitest-pool-workers` 0.8.5 (Miniflare D1), `@vendepro/core`, `@vendepro/infrastructure`.

**Spec de referencia:** `docs/superpowers/specs/2026-04-17-backend-hex-refactor-design.md`

**Árbol de archivos afectados** (solo los nuevos o modificados):

```
vendepro-backend/
  packages/
    core/
      src/domain/entities/
        visit-form.ts                         (NEW)
        visit-form-response.ts                (NEW)
        password-reset-token.ts               (NEW)
        role.ts                               (NEW)
        notification.ts                       (NEW)
        index.ts                              (MOD — export new entities)
      src/application/ports/repositories/
        visit-form-repository.ts              (NEW)
        password-reset-token-repository.ts    (NEW)
        role-repository.ts                    (NEW)
        notification-repository.ts            (NEW)
        organization-repository.ts            (MOD — new methods)
        user-repository.ts                    (MOD — new methods)
        activity-repository.ts                (MOD — + findById)
        property-repository.ts                (MOD — + findPhotos, update, etc.)
        contact-repository.ts                 (MOD — + findWithLeadsAndProperties)
        index.ts                              (MOD — export new ports)
      src/application/ports/services/
        calendar-sync.ts                      (DELETE)
        index.ts                              (MOD — remove export)
      src/application/use-cases/reservations/ (RENAMED → transactions/)
      tests/domain/
        activity.test.ts                      (NEW)
        appraisal.test.ts                     (NEW)
        contact.test.ts                       (NEW)
        ficha-tasacion.test.ts                (NEW)
        objective.test.ts                     (NEW)
        organization.test.ts                  (NEW)
        prefactibilidad.test.ts               (NEW)
        report.test.ts                        (NEW)
        tag.test.ts                           (NEW)
        template-block.test.ts                (NEW)
        user.test.ts                          (NEW)
        visit-form.test.ts                    (NEW)
        password-reset-token.test.ts          (NEW)
        role.test.ts                          (NEW)
        notification.test.ts                  (NEW)
        email.test.ts                         (NEW — VO)
        event-type.test.ts                    (NEW — VO)
        money.test.ts                         (NEW — VO)
        property-stage.test.ts                (NEW — VO)
        lead-rules.test.ts                    (NEW)
        property-rules.test.ts                (NEW)
        reservation-rules.test.ts             (NEW)
      tests/use-cases/reservations/           (RENAMED → transactions/)
    infrastructure/
      src/repositories/
        d1-appraisal-repository.ts            (NEW)
        d1-ficha-repository.ts                (NEW)
        d1-prefactibilidad-repository.ts      (NEW)
        d1-report-repository.ts               (NEW)
        d1-visit-form-repository.ts           (NEW)
        d1-password-reset-token-repository.ts (NEW)
        d1-role-repository.ts                 (NEW)
        d1-notification-repository.ts         (NEW)
        d1-property-repository.ts             (MOD — bug fix + new methods)
        d1-stage-history-repository.ts        (MOD — bug fix)
        d1-organization-repository.ts         (MOD — new methods)
        d1-user-repository.ts                 (MOD — new methods)
        d1-activity-repository.ts             (MOD — + findById)
        d1-contact-repository.ts              (MOD — + findWithLeadsAndProperties)
        index.ts                              (MOD — export new adapters)
      tests/                                  (NEW FOLDER)
        helpers/
          d1-test-env.ts                      (NEW)
          fixtures.ts                         (NEW)
        repositories/
          d1-property-repository.test.ts      (NEW — covers bug regression)
          d1-stage-history-repository.test.ts (NEW — covers bug regression)
          d1-appraisal-repository.test.ts     (NEW)
          d1-ficha-repository.test.ts         (NEW)
          d1-prefactibilidad-repository.test.ts (NEW)
          d1-report-repository.test.ts        (NEW)
          d1-visit-form-repository.test.ts    (NEW)
          d1-password-reset-token-repository.test.ts (NEW)
          d1-role-repository.test.ts          (NEW)
          d1-notification-repository.test.ts  (NEW)
          d1-organization-repository.test.ts  (NEW — new methods)
          d1-user-repository.test.ts          (NEW — new methods)
          d1-activity-repository.test.ts      (NEW — + findById)
          d1-contact-repository.test.ts       (NEW — new method)
      vitest.config.ts                        (MOD — pool-workers config)
```

---

## Task 1: Setup Miniflare D1 test helper

**Files:**
- Create: `vendepro-backend/packages/infrastructure/tests/helpers/d1-test-env.ts`
- Create: `vendepro-backend/packages/infrastructure/tests/helpers/fixtures.ts`
- Modify: `vendepro-backend/packages/infrastructure/vitest.config.ts`

- [ ] **Step 1: Write placeholder test that proves Miniflare boots and schema applies**

Create `vendepro-backend/packages/infrastructure/tests/helpers/d1-test-env.ts`:

```typescript
import { Miniflare } from 'miniflare'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface TestEnv { DB: D1Database; mf: Miniflare }

let schemaSql: string | null = null

function loadSchema(): string {
  if (schemaSql !== null) return schemaSql
  const path = join(process.cwd(), '..', '..', 'schema.sql')
  schemaSql = readFileSync(path, 'utf-8')
  return schemaSql
}

export async function createTestDB(): Promise<TestEnv> {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { async fetch() { return new Response(null) } }',
    d1Databases: { DB: 'test-db-' + crypto.randomUUID() },
  })
  const DB = await mf.getD1Database('DB') as unknown as D1Database
  const statements = loadSchema()
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
  for (const stmt of statements) {
    await DB.prepare(stmt).run()
  }
  return { DB, mf }
}

export async function closeTestDB(env: TestEnv): Promise<void> {
  await env.mf.dispose()
}
```

- [ ] **Step 2: Create fixtures helper**

Create `vendepro-backend/packages/infrastructure/tests/helpers/fixtures.ts`:

```typescript
import type { D1Database } from '@cloudflare/workers-types'

let seq = 0
export const nextId = (prefix = 'id') => `${prefix}_${++seq}_${Date.now()}`

export async function seedOrg(db: D1Database, overrides: Partial<{ id: string; slug: string; name: string }> = {}) {
  const id = overrides.id ?? nextId('org')
  const slug = overrides.slug ?? `org-${id}`
  const name = overrides.name ?? 'Test Org'
  await db.prepare(`INSERT INTO organizations (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))`)
    .bind(id, slug, name).run()
  return { id, slug, name }
}

export async function seedUser(db: D1Database, orgId: string, overrides: Partial<{ id: string; email: string; role: string; full_name: string }> = {}) {
  const id = overrides.id ?? nextId('user')
  const email = overrides.email ?? `${id}@test.com`
  const role = overrides.role ?? 'agent'
  const full_name = overrides.full_name ?? 'Test User'
  await db.prepare(`INSERT INTO users (id, org_id, email, password_hash, full_name, role, created_at, updated_at) VALUES (?, ?, ?, 'x', ?, ?, datetime('now'), datetime('now'))`)
    .bind(id, orgId, email, full_name, role).run()
  return { id, email, role, full_name, org_id: orgId }
}
```

- [ ] **Step 3: Add `miniflare` to infrastructure devDependencies**

Edit `vendepro-backend/packages/infrastructure/package.json` — add `"miniflare": "^3.20240821.0"` to `devDependencies`. Then from `vendepro-backend/`:

Run: `npm install`
Expected: miniflare installed without errors.

- [ ] **Step 4: Create smoke test**

Create `vendepro-backend/packages/infrastructure/tests/helpers/d1-test-env.test.ts`:

```typescript
import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from './d1-test-env'
import { seedOrg } from './fixtures'

describe('d1 test env', () => {
  let env: TestEnv
  beforeAll(async () => { env = await createTestDB() })
  afterAll(async () => { await closeTestDB(env) })

  it('boots Miniflare and applies schema', async () => {
    const { id } = await seedOrg(env.DB)
    const row = await env.DB.prepare('SELECT id, slug FROM organizations WHERE id = ?').bind(id).first()
    expect(row).toBeTruthy()
    expect((row as any).id).toBe(id)
  })
})
```

- [ ] **Step 5: Run smoke test**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/infrastructure`
Expected: 1 test passed.

If it fails on path resolution of `schema.sql`, adjust the `join` in `d1-test-env.ts` — the working directory depends on where vitest is launched. Fall back to `join(__dirname, '..', '..', '..', '..', 'schema.sql')`.

- [ ] **Step 6: Commit**

```bash
git add vendepro-backend/packages/infrastructure/tests/helpers/ vendepro-backend/packages/infrastructure/package.json
git commit -m "test(infra): setup Miniflare D1 test helper"
```

---

## Task 2: Regression test + fix for duplicate `contact_id` in D1PropertyRepository

**Files:**
- Create: `vendepro-backend/packages/infrastructure/tests/repositories/d1-property-repository.test.ts`
- Modify: `vendepro-backend/packages/infrastructure/src/repositories/d1-property-repository.ts:120-130`

- [ ] **Step 1: Write failing test that documents the mapping**

Create `vendepro-backend/packages/infrastructure/tests/repositories/d1-property-repository.test.ts`:

```typescript
import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1PropertyRepository } from '../../src/repositories/d1-property-repository'

describe('D1PropertyRepository', () => {
  let env: TestEnv
  let orgId: string
  let agentId: string
  beforeAll(async () => { env = await createTestDB() })
  afterAll(async () => { await closeTestDB(env) })
  beforeEach(async () => {
    const org = await seedOrg(env.DB)
    orgId = org.id
    const user = await seedUser(env.DB, orgId)
    agentId = user.id
  })

  it('findById returns property with contact_id populated (no duplicate key bug)', async () => {
    const propId = nextId('prop')
    const contactId = nextId('contact')
    await env.DB.prepare(`INSERT INTO contacts (id, org_id, full_name, created_at, updated_at) VALUES (?, ?, 'Owner', datetime('now'), datetime('now'))`).bind(contactId, orgId).run()
    await env.DB.prepare(`INSERT INTO properties (id, org_id, agent_id, address, neighborhood, city, property_type, owner_name, status, contact_id, operation_type, operation_type_id, status_id, created_at, updated_at) VALUES (?, ?, ?, 'Addr 1', 'Palermo', 'CABA', 'departamento', 'Owner', 'captacion', ?, 'venta', 1, 1, datetime('now'), datetime('now'))`)
      .bind(propId, orgId, agentId, contactId).run()

    const repo = new D1PropertyRepository(env.DB)
    const prop = await repo.findById(propId, orgId)
    expect(prop).not.toBeNull()
    expect(prop!.toObject().contact_id).toBe(contactId)
  })
})
```

- [ ] **Step 2: Run to verify the test PASSES even with the bug**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/infrastructure`
Expected: PASS — the duplicate key in object literal is not an error at runtime, the second occurrence just overwrites the first. The test documents the correct mapping; we'll use it as regression protection when we remove the duplicate.

- [ ] **Step 3: Remove duplicate key**

Edit `vendepro-backend/packages/infrastructure/src/repositories/d1-property-repository.ts`. Find lines 120 and 130 — both assign `contact_id: row.contact_id ?? null`. Remove line 130 (keep line 120, which is in the original block where `owner_email` and the rest live).

The `toEntity` should have `contact_id: row.contact_id ?? null` appearing exactly once.

- [ ] **Step 4: Run test to verify it still passes**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/infrastructure`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vendepro-backend/packages/infrastructure/src/repositories/d1-property-repository.ts vendepro-backend/packages/infrastructure/tests/repositories/d1-property-repository.test.ts
git commit -m "fix(infra): remove duplicate contact_id key in D1PropertyRepository.toEntity"
```

---

## Task 3: Regression test + fix for D1StageHistoryRepository column mismatch

**Files:**
- Create: `vendepro-backend/packages/infrastructure/tests/repositories/d1-stage-history-repository.test.ts`
- Modify: `vendepro-backend/packages/infrastructure/src/repositories/d1-stage-history-repository.ts`

The bug: SELECT orders by `sh.created_at` but the schema column is `changed_at`. The entity exposes `changed_at`. At runtime `r.changed_at` is read from the row (because the schema column IS `changed_at`), so the mapping works — but the ORDER BY clause fails silently on an unknown column, or orders arbitrarily. We need to align on `changed_at`.

Confirm schema column name first:

- [ ] **Step 1: Verify schema column**

Run: `cd vendepro-backend && grep -A2 "CREATE TABLE stage_history" schema.sql`
Expected output: confirm whether the column is `changed_at` or `created_at`. Pick accordingly for the fix.

- [ ] **Step 2: Write failing test**

Create `vendepro-backend/packages/infrastructure/tests/repositories/d1-stage-history-repository.test.ts`:

```typescript
import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1StageHistoryRepository } from '../../src/repositories/d1-stage-history-repository'

describe('D1StageHistoryRepository', () => {
  let env: TestEnv
  beforeAll(async () => { env = await createTestDB() })
  afterAll(async () => { await closeTestDB(env) })

  it('log() persists entry and findByEntity() returns it with changed_at populated and ordered DESC', async () => {
    const org = await seedOrg(env.DB)
    const user = await seedUser(env.DB, org.id)
    const leadId = nextId('lead')
    const repo = new D1StageHistoryRepository(env.DB)

    await repo.log({ org_id: org.id, entity_type: 'lead', entity_id: leadId, from_stage: 'nuevo', to_stage: 'asignado', changed_by: user.id, notes: null })
    await new Promise(r => setTimeout(r, 10))
    await repo.log({ org_id: org.id, entity_type: 'lead', entity_id: leadId, from_stage: 'asignado', to_stage: 'contactado', changed_by: user.id, notes: null })

    const entries = await repo.findByEntity('lead', leadId, org.id)
    expect(entries.length).toBe(2)
    expect(entries[0].to_stage).toBe('contactado')
    expect(entries[0].changed_at).toBeTruthy()
    expect(entries[1].to_stage).toBe('asignado')
  })
})
```

- [ ] **Step 3: Run test to confirm it fails**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/infrastructure -- d1-stage-history-repository`
Expected: FAIL — either ORDER BY error, or `changed_at` undefined, or ordering wrong.

- [ ] **Step 4: Fix adapter**

Edit `vendepro-backend/packages/infrastructure/src/repositories/d1-stage-history-repository.ts`. Replace the full file with:

```typescript
import type { StageHistoryRepository, StageHistoryEntry } from '@vendepro/core'

export class D1StageHistoryRepository implements StageHistoryRepository {
  constructor(private readonly db: D1Database) {}

  async findByEntity(entityType: 'lead' | 'reservation', entityId: string, orgId: string): Promise<StageHistoryEntry[]> {
    const rows = (await this.db
      .prepare(`SELECT sh.*, u.full_name as changed_by_name FROM stage_history sh LEFT JOIN users u ON sh.changed_by = u.id WHERE sh.org_id = ? AND sh.entity_id = ? AND sh.entity_type = ? ORDER BY sh.changed_at DESC`)
      .bind(orgId, entityId, entityType)
      .all()).results as any[]

    return rows.map(r => ({
      id: r.id, org_id: r.org_id, entity_type: r.entity_type,
      entity_id: r.entity_id, from_stage: r.from_stage, to_stage: r.to_stage,
      changed_by: r.changed_by, changed_at: r.changed_at, notes: r.notes,
      changed_by_name: r.changed_by_name ?? null,
    }))
  }

  async log(entry: Omit<StageHistoryEntry, 'id' | 'changed_at'>): Promise<void> {
    const id = crypto.randomUUID().replace(/-/g, '')
    await this.db.prepare(`
      INSERT INTO stage_history (id, org_id, entity_type, entity_id, from_stage, to_stage, changed_by, notes, changed_at)
      VALUES (?,?,?,?,?,?,?,?, datetime('now'))
    `).bind(id, entry.org_id, entry.entity_type, entry.entity_id, entry.from_stage, entry.to_stage, entry.changed_by, entry.notes).run()
  }
}
```

If Step 1 showed the schema column is `created_at` (not `changed_at`), then instead of changing the SQL, change the entity mapping to use `created_at` as the source and expose it as `changed_at` — document the choice in a commit message.

- [ ] **Step 5: Run test to verify pass**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/infrastructure`
Expected: all infrastructure tests pass.

- [ ] **Step 6: Commit**

```bash
git add vendepro-backend/packages/infrastructure/src/repositories/d1-stage-history-repository.ts vendepro-backend/packages/infrastructure/tests/repositories/d1-stage-history-repository.test.ts
git commit -m "fix(infra): align StageHistory SQL column with entity changed_at field"
```

---

## Task 4: Rename use-cases `reservations/` → `transactions/`

**Files:**
- Rename: `vendepro-backend/packages/core/src/application/use-cases/reservations/` → `transactions/`
- Rename: `vendepro-backend/packages/core/tests/use-cases/reservations/` → `transactions/`
- Modify: `vendepro-backend/packages/core/src/application/index.ts`
- Modify: `vendepro-backend/packages/api-transactions/src/index.ts` (if it imports from the old path)

- [ ] **Step 1: Run a grep to list all importers**

Run: `cd vendepro-backend && grep -rn "use-cases/reservations" packages/ --include="*.ts"`
Write down all paths that reference the old folder.

- [ ] **Step 2: Rename the folders**

```bash
cd vendepro-backend
git mv packages/core/src/application/use-cases/reservations packages/core/src/application/use-cases/transactions
git mv packages/core/tests/use-cases/reservations packages/core/tests/use-cases/transactions
```

- [ ] **Step 3: Update barrel and imports**

In `packages/core/src/application/use-cases/index.ts` (if it re-exports reservations), change the path to `./transactions/...`.
In each file found in Step 1, replace `use-cases/reservations` with `use-cases/transactions`.

If the use-case files inside still say `advance-reservation-stage.ts`, that filename is fine — it's a reservation-specific operation. Only the folder renames.

- [ ] **Step 4: Run tests to verify nothing broke**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/core`
Expected: existing tests pass.

Run: `cd vendepro-backend && npm run build --filter api-transactions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(core): rename use-cases/reservations to use-cases/transactions"
```

---

## Task 5: Delete `CalendarSyncService` port (YAGNI)

**Files:**
- Delete: `vendepro-backend/packages/core/src/application/ports/services/calendar-sync.ts`
- Modify: `vendepro-backend/packages/core/src/application/ports/services/index.ts`

- [ ] **Step 1: Verify no imports exist**

Run: `cd vendepro-backend && grep -rn "CalendarSyncService\|calendar-sync" packages/ --include="*.ts"`
Expected: only hits in `ports/services/calendar-sync.ts` and `ports/services/index.ts`.

- [ ] **Step 2: Delete file**

```bash
rm vendepro-backend/packages/core/src/application/ports/services/calendar-sync.ts
```

- [ ] **Step 3: Remove export from barrel**

Edit `vendepro-backend/packages/core/src/application/ports/services/index.ts` — delete the line `export * from './calendar-sync'` (or equivalent).

- [ ] **Step 4: Build to verify**

Run: `cd vendepro-backend && npx turbo build --filter @vendepro/core`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(core): remove unused CalendarSyncService port (YAGNI)"
```

---

## Task 6: Domain entity `VisitForm` + test

**Files:**
- Create: `vendepro-backend/packages/core/src/domain/entities/visit-form.ts`
- Create: `vendepro-backend/packages/core/tests/domain/visit-form.test.ts`
- Modify: `vendepro-backend/packages/core/src/domain/entities/index.ts`

- [ ] **Step 1: Write the failing test**

Create `vendepro-backend/packages/core/tests/domain/visit-form.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { VisitForm } from '../../src/domain/entities/visit-form'
import { ValidationError } from '../../src/domain/errors/validation-error'

const base = {
  id: 'vf-1',
  org_id: 'org_1',
  property_id: 'prop_1',
  public_slug: 'visita-abc',
  fields: [{ key: 'name', label: 'Nombre', type: 'text', required: true }],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('VisitForm', () => {
  it('creates a form with valid props', () => {
    const form = VisitForm.create(base)
    expect(form.id).toBe('vf-1')
    expect(form.public_slug).toBe('visita-abc')
    expect(form.fields).toHaveLength(1)
  })

  it('rejects empty slug', () => {
    expect(() => VisitForm.create({ ...base, public_slug: '' })).toThrow(ValidationError)
  })

  it('rejects slug with invalid characters', () => {
    expect(() => VisitForm.create({ ...base, public_slug: 'with spaces!' })).toThrow(ValidationError)
  })

  it('rejects zero fields', () => {
    expect(() => VisitForm.create({ ...base, fields: [] })).toThrow(ValidationError)
  })

  it('toObject returns plain data', () => {
    const form = VisitForm.create(base)
    expect(form.toObject()).toEqual(base)
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/core -- visit-form`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Write entity**

Create `vendepro-backend/packages/core/src/domain/entities/visit-form.ts`:

```typescript
import { ValidationError } from '../errors/validation-error'

export interface VisitFormField {
  key: string
  label: string
  type: 'text' | 'email' | 'phone' | 'select' | 'textarea'
  required: boolean
  options?: string[]
}

export interface VisitFormProps {
  id: string
  org_id: string
  property_id: string
  public_slug: string
  fields: VisitFormField[]
  created_at: string
  updated_at: string
}

const SLUG_RX = /^[a-z0-9-]+$/i

export class VisitForm {
  private constructor(private readonly props: VisitFormProps) {}

  static create(props: VisitFormProps): VisitForm {
    if (!props.public_slug || !SLUG_RX.test(props.public_slug)) {
      throw new ValidationError('public_slug inválido')
    }
    if (!props.fields || props.fields.length === 0) {
      throw new ValidationError('el formulario requiere al menos un campo')
    }
    return new VisitForm(props)
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get property_id() { return this.props.property_id }
  get public_slug() { return this.props.public_slug }
  get fields() { return this.props.fields }

  toObject(): VisitFormProps { return { ...this.props, fields: [...this.props.fields] } }
}
```

- [ ] **Step 4: Export from barrel**

Edit `vendepro-backend/packages/core/src/domain/entities/index.ts` — add `export * from './visit-form'`.

- [ ] **Step 5: Run test to confirm pass**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/core -- visit-form`
Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add vendepro-backend/packages/core/src/domain/entities/visit-form.ts vendepro-backend/packages/core/src/domain/entities/index.ts vendepro-backend/packages/core/tests/domain/visit-form.test.ts
git commit -m "feat(core): add VisitForm domain entity"
```

---

## Task 7: Domain entity `VisitFormResponse` + test

**Files:**
- Create: `vendepro-backend/packages/core/src/domain/entities/visit-form-response.ts`
- Create: `vendepro-backend/packages/core/tests/domain/visit-form-response.test.ts`
- Modify: `vendepro-backend/packages/core/src/domain/entities/index.ts`

Follow the same pattern as Task 6. Props:

```typescript
export interface VisitFormResponseProps {
  id: string
  form_id: string
  visitor_name: string
  visitor_phone: string | null
  visitor_email: string | null
  responses: Record<string, string>  // arbitrary key→value
  created_at: string
}
```

Tests to cover:
1. Creates with valid props.
2. Rejects empty `visitor_name`.
3. Requires at least phone OR email (throws if both null).
4. `toObject()` round-trips.

Entity validation:
```typescript
if (!props.visitor_name?.trim()) throw new ValidationError('visitor_name requerido')
if (!props.visitor_phone && !props.visitor_email) throw new ValidationError('se requiere teléfono o email')
```

- [ ] **Step 1: Write failing test** (structure identical to Task 6, adapt props/fields)
- [ ] **Step 2: Run to confirm fail**
- [ ] **Step 3: Write entity**
- [ ] **Step 4: Add to barrel**
- [ ] **Step 5: Run test — pass**
- [ ] **Step 6: Commit** `feat(core): add VisitFormResponse domain entity`

---

## Task 8: Domain entity `PasswordResetToken` + test

**Files:**
- Create: `vendepro-backend/packages/core/src/domain/entities/password-reset-token.ts`
- Create: `vendepro-backend/packages/core/tests/domain/password-reset-token.test.ts`
- Modify: entities barrel

Props:
```typescript
export interface PasswordResetTokenProps {
  token: string         // opaque string, NOT id
  user_id: string
  expires_at: string    // ISO
  used: boolean
  created_at: string
}
```

Methods:
```typescript
static create(props: PasswordResetTokenProps): PasswordResetToken  // validates token length ≥ 32
isExpired(now = new Date()): boolean
canBeUsed(now = new Date()): boolean  // !used && !isExpired
markUsed(): PasswordResetToken        // returns new instance with used=true
```

Tests:
1. Creates with valid props.
2. Rejects token shorter than 32 chars.
3. `isExpired()` returns false when now < expires_at.
4. `isExpired()` returns true when now > expires_at.
5. `canBeUsed()` false when already used.
6. `canBeUsed()` true when fresh and not used.
7. `markUsed()` returns a new token with used=true.

- [ ] **Step 1: Write failing test** (7 cases, adapt the shape from Task 6)
- [ ] **Step 2: Confirm fail**
- [ ] **Step 3: Write entity**
- [ ] **Step 4: Barrel export**
- [ ] **Step 5: Pass**
- [ ] **Step 6: Commit** `feat(core): add PasswordResetToken domain entity`

---

## Task 9: Domain entity `Role` + test

**Files:**
- Create: `vendepro-backend/packages/core/src/domain/entities/role.ts`
- Create: `vendepro-backend/packages/core/tests/domain/role.test.ts`
- Modify: entities barrel

Props:
```typescript
export interface RoleProps { id: number; name: string; label: string }
```

Validation:
- `name` must match `/^[a-z_]+$/`.
- `label` is non-empty.

Tests: create valid; reject empty name; reject invalid name chars; reject empty label.

Steps: same 6-step TDD pattern as Task 6. Commit message: `feat(core): add Role domain entity`.

---

## Task 10: Domain entity `Notification` + test

**Files:**
- Create: `vendepro-backend/packages/core/src/domain/entities/notification.ts`
- Create: `vendepro-backend/packages/core/tests/domain/notification.test.ts`
- Modify: entities barrel

Props:
```typescript
export interface NotificationProps {
  id: string
  org_id: string
  user_id: string
  kind: 'lead_assigned' | 'task_overdue' | 'reservation_update' | 'system'
  title: string
  body: string | null
  link_url: string | null
  read: boolean
  created_at: string
}
```

Methods:
- `static create(props): Notification` — validates title non-empty.
- `markRead(): Notification` — returns new instance with read=true.

Tests: valid create; rejects empty title; rejects unknown kind; `markRead()` round-trip.

Commit: `feat(core): add Notification domain entity`.

---

## Task 11-21: Tests for existing entities

Each existing entity without a test gets one new test file. Use the **6-step TDD pattern** per entity:

Files to create (one per task):
- Task 11: `core/tests/domain/activity.test.ts`
- Task 12: `core/tests/domain/appraisal.test.ts`
- Task 13: `core/tests/domain/contact.test.ts`
- Task 14: `core/tests/domain/ficha-tasacion.test.ts`
- Task 15: `core/tests/domain/objective.test.ts`
- Task 16: `core/tests/domain/organization.test.ts`
- Task 17: `core/tests/domain/prefactibilidad.test.ts`
- Task 18: `core/tests/domain/report.test.ts`
- Task 19: `core/tests/domain/tag.test.ts`
- Task 20: `core/tests/domain/template-block.test.ts`
- Task 21: `core/tests/domain/user.test.ts`

**Per task, 6 steps:**

- [ ] **Step 1: Read the entity source** (`cat packages/core/src/domain/entities/<name>.ts`) and enumerate its behaviors: constructor validations, state transitions, computed properties, helper methods.

- [ ] **Step 2: Write the test file** covering every public behavior. Minimum checklist per entity:
  - Valid constructor/factory call succeeds.
  - Each validation throws `ValidationError`.
  - Each state transition method (e.g., `update`, `advance`, `complete`) produces the expected state.
  - `toObject()` or equivalent serializer round-trips.

- [ ] **Step 3: Run test** — it may PASS immediately if the entity is correct. If it FAILS, the test caught a bug; either fix the entity or adjust the test to match documented behavior.

- [ ] **Step 4: If a bug is found** — record it, fix the entity, and the test becomes regression.

- [ ] **Step 5: Run the full `@vendepro/core` suite** to confirm nothing else broke.

Run: `cd vendepro-backend && npm test -- --filter @vendepro/core`
Expected: PASS.

- [ ] **Step 6: Commit** with message `test(core): cover <entity> domain entity`.

**Example for Task 11 (Activity):**

Activity entity (inferred from audit): tracks a user action (call, whatsapp, email, note, stage_change, etc.) tied to a lead/contact/property.

```typescript
// packages/core/tests/domain/activity.test.ts
import { describe, it, expect } from 'vitest'
import { Activity } from '../../src/domain/entities/activity'
import { ValidationError } from '../../src/domain/errors/validation-error'

const base = {
  id: 'act-1',
  org_id: 'org_1',
  type: 'call' as const,
  entity_type: 'lead' as const,
  entity_id: 'lead-1',
  user_id: 'user-1',
  description: 'Llamé al cliente',
  created_at: '2026-01-01T00:00:00Z',
}

describe('Activity', () => {
  it('creates with valid props', () => {
    const a = Activity.create(base)
    expect(a.id).toBe('act-1')
    expect(a.type).toBe('call')
  })
  it('rejects empty description', () => {
    expect(() => Activity.create({ ...base, description: '' })).toThrow(ValidationError)
  })
  it('rejects unknown type', () => {
    expect(() => Activity.create({ ...base, type: 'unknown' as any })).toThrow(ValidationError)
  })
  it('toObject round-trips', () => {
    const a = Activity.create(base)
    expect(a.toObject()).toEqual(base)
  })
})
```

Adapt to each entity's actual shape. **DO NOT invent methods the entity doesn't have** — read the source first.

---

## Task 22-25: Value object tests

Follow the same 6-step TDD pattern. Each VO gets one test file:
- Task 22: `core/tests/domain/email.test.ts`
- Task 23: `core/tests/domain/event-type.test.ts`
- Task 24: `core/tests/domain/money.test.ts`
- Task 25: `core/tests/domain/property-stage.test.ts`

Coverage per VO: constructor/factory, validation failures, equality, any transitions or formatters.

**Example for Task 22 (Email):**

```typescript
import { describe, it, expect } from 'vitest'
import { Email } from '../../src/domain/value-objects/email'
import { ValidationError } from '../../src/domain/errors/validation-error'

describe('Email', () => {
  it('accepts a valid email', () => {
    const e = Email.create('foo@bar.com')
    expect(e.value).toBe('foo@bar.com')
  })
  it('normalizes to lowercase', () => {
    expect(Email.create('Foo@Bar.COM').value).toBe('foo@bar.com')
  })
  it('rejects malformed email', () => {
    expect(() => Email.create('not-an-email')).toThrow(ValidationError)
    expect(() => Email.create('@no-local.com')).toThrow(ValidationError)
    expect(() => Email.create('no-at.com')).toThrow(ValidationError)
  })
  it('equals() compares normalized values', () => {
    expect(Email.create('A@b.com').equals(Email.create('a@B.COM'))).toBe(true)
  })
})
```

Adjust to actual VO API — read the source first.

Each commit: `test(core): cover <vo-name> value object`.

---

## Task 26-28: Domain rule tests

- Task 26: `core/tests/domain/lead-rules.test.ts`
- Task 27: `core/tests/domain/property-rules.test.ts`
- Task 28: `core/tests/domain/reservation-rules.test.ts`

Read each rule file, enumerate the exported functions, and test each with representative inputs (happy + edge cases).

Commit: `test(core): cover <rule-file> domain rules`.

---

## Task 29: Port `VisitFormRepository`

**Files:**
- Create: `vendepro-backend/packages/core/src/application/ports/repositories/visit-form-repository.ts`
- Modify: `vendepro-backend/packages/core/src/application/ports/repositories/index.ts`

Ports are interfaces, so "tests" here are compile-time checks via a use case. For this task, we only create the port. Use-cases that depend on it come in their respective worker phases.

- [ ] **Step 1: Create port**

```typescript
// packages/core/src/application/ports/repositories/visit-form-repository.ts
import type { VisitForm } from '../../../domain/entities/visit-form'
import type { VisitFormResponse } from '../../../domain/entities/visit-form-response'

export interface VisitFormRepository {
  findById(id: string, orgId: string): Promise<VisitForm | null>
  findByPublicSlug(slug: string): Promise<{ form: VisitForm; property: { address: string; neighborhood: string }; org: { name: string; logo_url: string | null; brand_color: string | null } } | null>
  save(form: VisitForm): Promise<void>
  saveResponse(response: VisitFormResponse): Promise<void>
}
```

- [ ] **Step 2: Add to barrel**

Append `export * from './visit-form-repository'` to the `index.ts`.

- [ ] **Step 3: Compile**

Run: `cd vendepro-backend && npx turbo build --filter @vendepro/core`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add vendepro-backend/packages/core/src/application/ports/repositories/visit-form-repository.ts vendepro-backend/packages/core/src/application/ports/repositories/index.ts
git commit -m "feat(core): add VisitFormRepository port"
```

---

## Task 30: Port `PasswordResetTokenRepository`

Same pattern as Task 29. Interface:

```typescript
import type { PasswordResetToken } from '../../../domain/entities/password-reset-token'

export interface PasswordResetTokenRepository {
  save(token: PasswordResetToken): Promise<void>
  findByToken(token: string): Promise<PasswordResetToken | null>
  markUsed(token: string): Promise<void>
  deleteExpired(now?: Date): Promise<number>  // returns count deleted
}
```

Commit: `feat(core): add PasswordResetTokenRepository port`.

---

## Task 31: Port `RoleRepository`

```typescript
import type { Role } from '../../../domain/entities/role'

export interface RoleRepository {
  findAll(): Promise<Role[]>
  findById(id: number): Promise<Role | null>
}
```

Commit: `feat(core): add RoleRepository port`.

---

## Task 32: Port `NotificationRepository`

```typescript
import type { Notification } from '../../../domain/entities/notification'

export interface NotificationRepository {
  findByUserId(userId: string, orgId: string, limit?: number): Promise<Notification[]>
  save(notification: Notification): Promise<void>
  markRead(id: string, userId: string): Promise<void>
}
```

Commit: `feat(core): add NotificationRepository port`.

---

## Task 33: Extend `OrganizationRepository` port

**Files:**
- Modify: `vendepro-backend/packages/core/src/application/ports/repositories/organization-repository.ts`

- [ ] **Step 1: Add methods**

Replace the interface body with:

```typescript
import type { Organization } from '../../../domain/entities/organization'

export interface OrganizationRepository {
  findById(id: string): Promise<Organization | null>
  findBySlug(slug: string): Promise<Organization | null>
  findByApiKey(apiKey: string): Promise<Organization | null>
  save(org: Organization): Promise<void>
  updateSettings(id: string, patch: Partial<{ name: string; slug: string; logo_url: string | null; brand_color: string | null }>): Promise<void>
  setApiKey(id: string, apiKey: string): Promise<void>
  getApiKey(id: string): Promise<string | null>
}
```

- [ ] **Step 2: Compile — this WILL fail** because `D1OrganizationRepository` doesn't implement the new methods yet. That's expected; we'll add them in Task 47.

Run: `cd vendepro-backend && npx turbo build --filter @vendepro/infrastructure`
Expected: FAIL with missing method errors.

- [ ] **Step 3: Add stub implementations to `D1OrganizationRepository`** so the build passes. Each stub throws `new Error('not implemented')`. We'll wire the real implementations with tests in Task 47.

In `packages/infrastructure/src/repositories/d1-organization-repository.ts`, append:

```typescript
  async findById(id: string) { throw new Error('not implemented'); return null as any }
  async findByApiKey(apiKey: string) { throw new Error('not implemented'); return null as any }
  async updateSettings(id: string, patch: any) { throw new Error('not implemented') }
  async setApiKey(id: string, apiKey: string) { throw new Error('not implemented') }
  async getApiKey(id: string) { throw new Error('not implemented'); return null as any }
```

- [ ] **Step 4: Build passes**

Run: `cd vendepro-backend && npx turbo build --filter @vendepro/infrastructure`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): extend OrganizationRepository port with findById/findByApiKey/updateSettings/api-key methods"
```

---

## Task 34: Extend `UserRepository` port

Add methods:

```typescript
findFirstAdminByOrg(orgId: string): Promise<User | null>
findProfileById(id: string): Promise<User | null>   // same as findById but for profile view
updateProfile(id: string, patch: Partial<{ full_name: string; email: string; avatar_url: string | null }>): Promise<void>
```

Stub them in `D1UserRepository` the same way (throw `not implemented`). Wired in Task 48.

Commit: `feat(core): extend UserRepository port with profile and admin-lookup methods`.

---

## Task 35: Extend `ActivityRepository` port

Add:
```typescript
findById(id: string, orgId: string): Promise<Activity | null>
```

Stub. Commit: `feat(core): add findById to ActivityRepository port`.

---

## Task 36: Extend `PropertyRepository` port

Add the full cluster:

```typescript
findPhotos(propertyId: string, orgId: string): Promise<PropertyPhoto[]>
addPhoto(photo: PropertyPhoto): Promise<void>
deletePhoto(photoId: string, orgId: string): Promise<void>
reorderPhotos(propertyId: string, orgId: string, order: Array<{ id: string; sort_order: number }>): Promise<void>
update(id: string, orgId: string, patch: Partial<PropertyProps>): Promise<void>
updateStage(id: string, orgId: string, stageSlug: string): Promise<void>
findCatalogs(): Promise<{ operation_types: OperationType[]; commercial_stages: CommercialStage[]; property_statuses: PropertyStatus[] }>
markExternalReport(id: string, orgId: string): Promise<void>
clearExternalReport(id: string, orgId: string): Promise<void>
```

Define supporting types (`PropertyPhoto`, `OperationType`, `CommercialStage`, `PropertyStatus`) in the same file or separate entity files as appropriate. For simplicity, inline them as interfaces:

```typescript
export interface PropertyPhoto { id: string; property_id: string; org_id: string; url: string; sort_order: number }
export interface OperationType { id: number; slug: string; label: string }
export interface CommercialStage { id: number; operation_type_id: number; slug: string; label: string; sort_order: number; is_terminal: boolean; color: string | null }
export interface PropertyStatus { id: number; operation_type_id: number; slug: string; label: string; color: string | null }
```

Stub all new methods in `D1PropertyRepository`. Wired in Task 49.

Commit: `feat(core): extend PropertyRepository port with photos, update, stage, catalogs`.

---

## Task 37: Extend `ContactRepository` port

Add:
```typescript
findWithLeadsAndProperties(id: string, orgId: string): Promise<{ contact: Contact; leads: Array<{ id: string; full_name: string; stage: string }>; properties: Array<{ id: string; address: string; status: string }> } | null>
```

Stub. Commit: `feat(core): add findWithLeadsAndProperties to ContactRepository port`.

---

## Task 38: Adapter `D1AppraisalRepository`

**Files:**
- Create: `vendepro-backend/packages/infrastructure/src/repositories/d1-appraisal-repository.ts`
- Create: `vendepro-backend/packages/infrastructure/tests/repositories/d1-appraisal-repository.test.ts`
- Modify: `vendepro-backend/packages/infrastructure/src/repositories/index.ts`

- [ ] **Step 1: Read port to understand contract**

Run: `cat packages/core/src/application/ports/repositories/appraisal-repository.ts`
Note the methods declared.

- [ ] **Step 2: Write failing integration test**

Create `vendepro-backend/packages/infrastructure/tests/repositories/d1-appraisal-repository.test.ts`:

```typescript
import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1AppraisalRepository } from '../../src/repositories/d1-appraisal-repository'
import { Appraisal } from '@vendepro/core'

describe('D1AppraisalRepository', () => {
  let env: TestEnv
  let orgId: string
  let agentId: string
  beforeAll(async () => { env = await createTestDB() })
  afterAll(async () => { await closeTestDB(env) })
  beforeEach(async () => {
    const org = await seedOrg(env.DB); orgId = org.id
    const user = await seedUser(env.DB, orgId); agentId = user.id
  })

  it('save() persists appraisal; findById() returns it', async () => {
    const repo = new D1AppraisalRepository(env.DB)
    const app = Appraisal.create({
      id: nextId('app'), org_id: orgId, agent_id: agentId,
      property_address: 'Av. Siempre Viva 742', neighborhood: 'Palermo', city: 'CABA',
      property_type: 'departamento', rooms: 3, size_m2: 80,
      suggested_price: 180000, currency: 'USD',
      owner_name: 'Homero', owner_phone: '111', owner_email: null,
      status: 'pendiente', public_slug: nextId('slug'),
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    } as any)
    await repo.save(app)
    const found = await repo.findById(app.id, orgId)
    expect(found).not.toBeNull()
    expect(found!.property_address).toBe('Av. Siempre Viva 742')
  })

  it('findByOrg() returns all appraisals scoped to the org', async () => {
    const repo = new D1AppraisalRepository(env.DB)
    // seed 2 in this org, 1 in another
    const otherOrg = await seedOrg(env.DB)
    // ... create 3 appraisals via direct SQL or repo.save
    // assert length is 2 and all have org_id === orgId
  })

  it('comparables: addComparable / findComparables / removeComparable', async () => {
    const repo = new D1AppraisalRepository(env.DB)
    // seed an appraisal, add 2 comparables, find returns 2, remove 1, find returns 1
  })
})
```

Fill in the rest based on the actual `AppraisalRepository` port contract.

- [ ] **Step 3: Run — fail (file doesn't exist)**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/infrastructure -- d1-appraisal`
Expected: FAIL.

- [ ] **Step 4: Implement the adapter**

Create `vendepro-backend/packages/infrastructure/src/repositories/d1-appraisal-repository.ts`:

```typescript
import type { AppraisalRepository } from '@vendepro/core'
import { Appraisal } from '@vendepro/core'

export class D1AppraisalRepository implements AppraisalRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string, orgId: string): Promise<Appraisal | null> {
    const row = await this.db.prepare('SELECT * FROM appraisals WHERE id = ? AND org_id = ?').bind(id, orgId).first()
    return row ? this.toEntity(row) : null
  }

  async findByOrg(orgId: string, filters?: any): Promise<Appraisal[]> {
    const rows = (await this.db.prepare('SELECT * FROM appraisals WHERE org_id = ? ORDER BY created_at DESC').bind(orgId).all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async save(app: Appraisal): Promise<void> {
    const p = app.toObject() as any
    const now = new Date().toISOString()
    await this.db.prepare(`
      INSERT INTO appraisals (id, org_id, agent_id, property_address, neighborhood, city, property_type, rooms, size_m2, suggested_price, currency, owner_name, owner_phone, owner_email, status, public_slug, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        property_address=excluded.property_address, neighborhood=excluded.neighborhood, city=excluded.city,
        property_type=excluded.property_type, rooms=excluded.rooms, size_m2=excluded.size_m2,
        suggested_price=excluded.suggested_price, currency=excluded.currency,
        owner_name=excluded.owner_name, owner_phone=excluded.owner_phone, owner_email=excluded.owner_email,
        status=excluded.status, updated_at=?
    `).bind(p.id, p.org_id, p.agent_id, p.property_address, p.neighborhood, p.city, p.property_type, p.rooms, p.size_m2, p.suggested_price, p.currency, p.owner_name, p.owner_phone, p.owner_email, p.status, p.public_slug, p.created_at, now, now).run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.prepare('DELETE FROM appraisals WHERE id = ? AND org_id = ?').bind(id, orgId).run()
  }

  async findComparables(appraisalId: string): Promise<any[]> {
    const rows = (await this.db.prepare('SELECT * FROM appraisal_comparables WHERE appraisal_id = ? ORDER BY sort_order').bind(appraisalId).all()).results as any[]
    return rows
  }

  async addComparable(appraisalId: string, comp: { zonaprop_url: string | null; address: string | null; total_area: number | null; covered_area: number | null; price: number | null; usd_per_m2: number | null; sort_order: number }): Promise<string> {
    const id = crypto.randomUUID().replace(/-/g, '')
    await this.db.prepare(`INSERT INTO appraisal_comparables (id, appraisal_id, zonaprop_url, address, total_area, covered_area, price, usd_per_m2, sort_order) VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind(id, appraisalId, comp.zonaprop_url, comp.address, comp.total_area, comp.covered_area, comp.price, comp.usd_per_m2, comp.sort_order).run()
    return id
  }

  async removeComparable(id: string): Promise<void> {
    await this.db.prepare('DELETE FROM appraisal_comparables WHERE id = ?').bind(id).run()
  }

  private toEntity(row: any): Appraisal {
    return Appraisal.create(row)
  }
}
```

Adjust field set to match the actual `appraisals` schema in `schema.sql`. Inspect before writing.

- [ ] **Step 5: Add to barrel**

Append `export * from './d1-appraisal-repository'` to `packages/infrastructure/src/repositories/index.ts`.

- [ ] **Step 6: Run tests — pass**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/infrastructure -- d1-appraisal`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(infra): add D1AppraisalRepository adapter"
```

---

## Task 39-45: Remaining new adapters

Same 7-step pattern as Task 38, one task per adapter. Read the port + schema first; write tests that exercise every port method; implement adapter.

- **Task 39: `D1FichaRepository`** (tables: `tasaciones`/`fichas`/whatever schema calls it). Commit: `feat(infra): add D1FichaRepository adapter`.
- **Task 40: `D1PrefactibilidadRepository`** (table: `prefactibilidades`). Commit: `feat(infra): add D1PrefactibilidadRepository adapter`.
- **Task 41: `D1ReportRepository`** — must include cascade of `report_photos`, `report_content`, `report_metrics`. Methods to implement: `findById`, `findByOrg`, `save` (incl. `replaceMetrics`/`replaceContent`), `delete` (cascade photos+content+metrics), `findMetrics`, `findContent`, `findPhotos`. Commit: `feat(infra): add D1ReportRepository adapter with cascade delete`.
- **Task 42: `D1VisitFormRepository`** (tables `visit_forms` + `visit_form_responses`). Commit: `feat(infra): add D1VisitFormRepository adapter`.
- **Task 43: `D1PasswordResetTokenRepository`** (table `password_reset_tokens`). Commit: `feat(infra): add D1PasswordResetTokenRepository adapter`.
- **Task 44: `D1RoleRepository`** (table `roles`). Commit: `feat(infra): add D1RoleRepository adapter`.
- **Task 45: `D1NotificationRepository`** (table `notifications`). Commit: `feat(infra): add D1NotificationRepository adapter`.

**For each:**
- [ ] Read port + schema table DDL.
- [ ] Write failing test covering every port method.
- [ ] Confirm fail.
- [ ] Implement adapter.
- [ ] Export from barrel.
- [ ] Tests pass.
- [ ] Commit.

---

## Task 46: Implement extended methods on `D1OrganizationRepository`

**Files:**
- Modify: `vendepro-backend/packages/infrastructure/src/repositories/d1-organization-repository.ts`
- Create: `vendepro-backend/packages/infrastructure/tests/repositories/d1-organization-repository.test.ts`

- [ ] **Step 1: Write failing tests covering `findById`, `findByApiKey`, `updateSettings`, `setApiKey`, `getApiKey`.**

```typescript
import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg } from '../helpers/fixtures'
import { D1OrganizationRepository } from '../../src/repositories/d1-organization-repository'

describe('D1OrganizationRepository extended methods', () => {
  let env: TestEnv; let orgId: string
  beforeAll(async () => { env = await createTestDB() })
  afterAll(async () => { await closeTestDB(env) })
  beforeEach(async () => { const o = await seedOrg(env.DB); orgId = o.id })

  it('findById returns org by id', async () => {
    const repo = new D1OrganizationRepository(env.DB)
    const org = await repo.findById(orgId)
    expect(org).not.toBeNull()
  })

  it('setApiKey then findByApiKey round-trips', async () => {
    const repo = new D1OrganizationRepository(env.DB)
    await repo.setApiKey(orgId, 'key_abc123')
    const org = await repo.findByApiKey('key_abc123')
    expect(org?.id).toBe(orgId)
  })

  it('getApiKey returns stored key', async () => {
    const repo = new D1OrganizationRepository(env.DB)
    await repo.setApiKey(orgId, 'key_xyz')
    expect(await repo.getApiKey(orgId)).toBe('key_xyz')
  })

  it('updateSettings patches specified fields only', async () => {
    const repo = new D1OrganizationRepository(env.DB)
    await repo.updateSettings(orgId, { name: 'New Name', brand_color: '#ff007c' })
    const org = await repo.findById(orgId)
    expect(org!.toObject().name).toBe('New Name')
  })

  it('updateSettings rejects duplicate slug', async () => {
    const other = await seedOrg(env.DB, { slug: 'taken-slug' })
    const repo = new D1OrganizationRepository(env.DB)
    await expect(repo.updateSettings(orgId, { slug: 'taken-slug' })).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run — fail** (stubs throw `not implemented`).

- [ ] **Step 3: Replace stubs with real implementations**:

```typescript
async findById(id: string): Promise<Organization | null> {
  const row = await this.db.prepare('SELECT * FROM organizations WHERE id = ?').bind(id).first()
  return row ? this.toEntity(row) : null
}

async findByApiKey(apiKey: string): Promise<Organization | null> {
  const row = await this.db.prepare('SELECT * FROM organizations WHERE api_key = ?').bind(apiKey).first()
  return row ? this.toEntity(row) : null
}

async setApiKey(id: string, apiKey: string): Promise<void> {
  await this.db.prepare("UPDATE organizations SET api_key = ?, updated_at = datetime('now') WHERE id = ?").bind(apiKey, id).run()
}

async getApiKey(id: string): Promise<string | null> {
  const row = await this.db.prepare('SELECT api_key FROM organizations WHERE id = ?').bind(id).first() as any
  return row?.api_key ?? null
}

async updateSettings(id: string, patch: Partial<{ name: string; slug: string; logo_url: string | null; brand_color: string | null }>): Promise<void> {
  if (patch.slug) {
    const conflict = await this.db.prepare('SELECT id FROM organizations WHERE slug = ? AND id != ?').bind(patch.slug, id).first()
    if (conflict) throw new Error('slug already in use')
  }
  const now = new Date().toISOString()
  await this.db.prepare(`
    UPDATE organizations SET
      name = COALESCE(?, name),
      slug = COALESCE(?, slug),
      logo_url = COALESCE(?, logo_url),
      brand_color = COALESCE(?, brand_color),
      updated_at = ?
    WHERE id = ?
  `).bind(patch.name ?? null, patch.slug ?? null, patch.logo_url ?? null, patch.brand_color ?? null, now, id).run()
}
```

- [ ] **Step 4: Run tests — pass.**

- [ ] **Step 5: Commit** `feat(infra): implement extended OrganizationRepository methods`.

---

## Task 47: Implement extended methods on `D1UserRepository`

Same 5-step pattern as Task 46. Implement:
- `findFirstAdminByOrg(orgId)` — `SELECT * FROM users WHERE org_id = ? AND role = 'admin' ORDER BY created_at ASC LIMIT 1`.
- `findProfileById(id)` — same as `findById`.
- `updateProfile(id, patch)` — UPDATE with COALESCE pattern like Task 46.

Write tests for each + edge cases (no admin returns null, updateProfile with empty patch is no-op).

Commit: `feat(infra): implement extended UserRepository methods`.

---

## Task 48: Implement `findById` on `D1ActivityRepository`

Same pattern. SQL: `SELECT * FROM activities WHERE id = ? AND org_id = ?`. Write one test.

Commit: `feat(infra): add findById to D1ActivityRepository`.

---

## Task 49: Implement extended methods on `D1PropertyRepository`

This is the largest single adapter task. New methods:
- `findPhotos(propertyId, orgId)` — `SELECT * FROM property_photos WHERE property_id = ? AND org_id = ? ORDER BY sort_order`.
- `addPhoto(photo)`, `deletePhoto(photoId, orgId)`, `reorderPhotos(propId, orgId, order)`.
- `update(id, orgId, patch)` — COALESCE-style UPDATE on all updatable columns.
- `updateStage(id, orgId, stageSlug)` — fetches `commercial_stage_id` from `commercial_stages` where slug matches, then updates.
- `findCatalogs()` — 3 parallel SELECTs on `operation_types`, `commercial_stages`, `property_statuses`.
- `markExternalReport(id, orgId)` — `UPDATE properties SET last_external_report_at = datetime('now') WHERE id = ? AND org_id = ?`.
- `clearExternalReport(id, orgId)` — `UPDATE properties SET last_external_report_at = NULL WHERE id = ? AND org_id = ?`.

Write tests covering every method (including edge: deleting a photo that doesn't exist = no-op; reorder with unknown ids = no-op or error, decide and test).

Commit: `feat(infra): implement extended PropertyRepository methods (photos, update, stage, catalogs, external-report)`.

---

## Task 50: Implement `findWithLeadsAndProperties` on `D1ContactRepository`

SQL: fetch contact + `SELECT id, full_name, stage FROM leads WHERE contact_id = ?` + `SELECT id, address, status FROM properties WHERE contact_id = ?` — return composed structure.

Test: seed contact + 2 leads + 1 property; confirm shape.

Commit: `feat(infra): add findWithLeadsAndProperties to D1ContactRepository`.

---

## Task 51: Full validation

- [ ] **Step 1: Run all core tests**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/core`
Expected: ALL tests pass. Count should be roughly: 6 existing + ~22 new entity/VO/rules + any use-case tests.

- [ ] **Step 2: Run all infrastructure tests**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/infrastructure`
Expected: ALL integration tests pass. Count should be roughly 1 smoke + ~13 adapter tests.

- [ ] **Step 3: Run full workspace build**

Run: `cd vendepro-backend && npx turbo build`
Expected: every package builds green. If any worker fails because of barrel-export changes, fix the import.

- [ ] **Step 4: Confirm port/adapter alignment**

Run: `cd vendepro-backend && grep -rn "new D1\(Appraisal\|Ficha\|Prefactibilidad\|Report\|VisitForm\|PasswordResetToken\|Role\|Notification\)Repository" packages/api-*/src/ || true`
Expected: no results yet (workers haven't been refactored; that's Phases 1-8).

- [ ] **Step 5: Confirm nothing leftover**

Run: `cd vendepro-backend && grep -rn "CalendarSyncService\|use-cases/reservations" packages/ --include="*.ts" || true`
Expected: no results.

- [ ] **Step 6: Final commit on branch (or PR)**

If everything is green and we're on a feature branch:

```bash
git log --oneline -30
```

Expected: ~40+ small commits.

---

## Self-review checklist

**Spec coverage:**
- ✅ Fase 0 bugs: duplicate `contact_id` (Task 2), `changed_at`/`created_at` mismatch (Task 3).
- ✅ Rename `reservations/` → `transactions/` (Task 4).
- ✅ Delete `CalendarSyncService` (Task 5).
- ✅ New entities: VisitForm, VisitFormResponse, PasswordResetToken, Role, Notification (Tasks 6-10).
- ✅ Tests for 11 existing untested entities (Tasks 11-21).
- ✅ Tests for 4 VOs (Tasks 22-25).
- ✅ Tests for 3 rules (Tasks 26-28).
- ✅ 4 new ports (Tasks 29-32).
- ✅ 5 extended ports (Tasks 33-37).
- ✅ 8 new D1 adapters (Tasks 38-45).
- ✅ 5 extended D1 adapters (Tasks 46-50).
- ✅ Miniflare setup (Task 1).
- ✅ Final validation (Task 51).

**Placeholder scan:** The pattern `[...fill in based on entity shape...]` appears in Tasks 11-21 and 38-45 because the entities and ports have idiosyncratic shapes. The executor MUST read the source before writing tests — this is called out explicitly in each task. This is not a blind placeholder; it's a guided "read then write" pattern that keeps the plan from becoming 8000 lines.

**Type consistency:** Port method names used in adapter tasks match the signatures declared in their port tasks (e.g., `findByApiKey` in Task 33 = `findByApiKey` in Task 46).
