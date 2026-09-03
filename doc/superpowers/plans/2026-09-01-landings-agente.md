# Landings de agente (Feature 07) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada agente tenga una página pública propia donde se vende — foto, bio, credenciales, zonas, FAQ y CTA de WhatsApp — en `/a/<org>/<agente>`, alimentada por un perfil que edita una sola vez.

**Architecture:** Se apoya en el stack de landings que ya está en producción. Suma una tabla `agent_profiles` 1:1 con `users`, un `kind` nuevo (`agent_profile`), 4 bloques nuevos, y un **binding vivo**: los bloques marcados con `binding: 'agent_profile'` se rellenan con los datos del perfil **en la lectura pública**, no al crear la landing. Así el agente edita su perfil una vez y todas sus landings se actualizan solas.

**Tech Stack:** TypeScript · Hono sobre Cloudflare Workers · D1 (SQLite) · Zod · Vitest · Next.js 15 (App Router) · Tailwind

**Spec:** `doc/superpowers/specs/2026-09-01-landings-agente-design.md`

## Global Constraints

- Arquitectura hexagonal: domain → application (ports/use cases) → infrastructure (adapters D1) → route en el worker. Nunca saltear la capa de aplicación.
- Todos los tests deben pasar antes de mergear a main (`cd vendepro-backend && npm test`).
- **NUNCA hacer deploys desde la terminal.** Todo va por GitHub Actions o Cloudflare Dashboard.
- Nunca tocar `vendepro-mg-salt-2026` ni `reportes-mg-db`.
- Toda entidad lleva `id` TEXT PK, `org_id`, `created_at`, `updated_at`. Fechas ISO en UTC.
- Toda query filtra por `org_id`.
- Frontend: Server Components por defecto, `'use client'` solo si hay hooks/interactividad. Todo `await res.json()` casteado `as any`. Imports específicos de `lucide-react`, sin barrel.
- Marca: `#ff007c` (pink), `#ff8017` (orange), fuente Poppins.

### Design system — obligatorio en TODA task de frontend (T11, T12, T13)

Fuente: `.claude/CLAUDE.md` y la checklist de `doc/ds-visual-rules.md`. Estas reglas
no son sugerencias: cada una salió de un ajuste ya aplicado en Dashboard/Leads/
Contactos, con su commit de referencia.

- **Componentes**: usar los de `src/components/ui` (Button, Badge, Card, Input/Field/Select/Textarea, Avatar, Heading, Text, Tabs, Modal, Alert, EmptyState, StatTile…). No recrear con `<div>`/`<button>` + clases.
- **Texto**: `Heading` (level 1–4) y `Text` (size/weight/tone). Nunca `<h1>`/`<p>` con clases sueltas. Títulos de sección (Heading 2) en semibold.
- **Color**: tokens semánticos — `primary` (hoy = brand-pink, definido en `globals.css:19`), `success/warning/danger/info/neutral`. Preferir `text-primary` sobre `text-brand-pink`: si mañana cambia el color de marca, el token semántico sigue valiendo. Nunca un color Tailwind suelto para estado (`bg-emerald-100`).
- **Regla 1 — tamaño de botón**: default (`md`). `size="sm"` solo en contexto denso (card de kanban, fila de tabla, input chico).
- **Regla 3 — íconos de encabezado**: `text-gray-600`, no `text-primary`. El rosa se reserva para CTAs y estados activos, no para decorar títulos. Excepción: íconos de integraciones externas (verde de WhatsApp, azul de Meta).
- **Regla 8 — radio y sombra**: `rounded-card` + `shadow-card` para superficies; `rounded-control` para inputs/botones; `rounded-full` para pills/avatares; `shadow-pop` para flotantes. **Nunca** `rounded-xl`, `shadow-sm` ni `shadow-lg` sueltos.
- **Regla 9 — nada a mano**: sin `<input>` nativo, sin callouts con color suelto, sin empty states armados con `<div>`. Van `Input`, `Alert tone="..."`, `EmptyState`.
- **Grises**: la app usa la escala `gray` (`border-gray-200`, `bg-gray-50`, `text-gray-600`), no `neutral`.
- **Canales de contacto**: WhatsApp/llamada **siempre** con `WhatsAppButton`/`CallButton` de `ui/ContactButtons`. Nunca armar el link `wa.me`/`tel:` a mano.
- **Al terminar cualquier task de frontend**: correr el skill `ui-ux-pro-max` sobre las pantallas nuevas y aplicar lo que devuelva. Es requisito del proyecto para todo trabajo de UI.
- Si algo no encaja en una variante existente, usar la más cercana y marcarlo `{/* ds-todo: candidato a variante "X" */}`. **No** crear variantes nuevas sobre la marcha.
- Regla #1 del proyecto: el feature no está terminado hasta que la KB lo refleja (Task 12).

---

### Task 1: Value object `AgentSlug`

**Files:**
- Create: `vendepro-backend/packages/core/src/domain/value-objects/agent-slug.ts`
- Test: `vendepro-backend/packages/core/tests/domain/agent-slug.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `AgentSlug.create(value: string): AgentSlug` (getter `.value`), `slugifyName(fullName: string): string`. Lanza `ValidationError`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/domain/agent-slug.test.ts
import { describe, it, expect } from 'vitest'
import { AgentSlug, slugifyName } from '../../src/domain/value-objects/agent-slug'

describe('AgentSlug', () => {
  it('acepta un slug válido', () => {
    expect(AgentSlug.create('andres-giunta').value).toBe('andres-giunta')
  })

  it('rechaza mayúsculas, espacios y caracteres raros', () => {
    expect(() => AgentSlug.create('Andres Giunta')).toThrow(/slug/i)
    expect(() => AgentSlug.create('andres_giunta')).toThrow(/slug/i)
    expect(() => AgentSlug.create('andrés-giunta')).toThrow(/slug/i)
  })

  it('rechaza por longitud', () => {
    expect(() => AgentSlug.create('ab')).toThrow(/slug/i)
    expect(() => AgentSlug.create('a'.repeat(61))).toThrow(/slug/i)
  })

  it('rechaza guiones al borde o duplicados', () => {
    expect(() => AgentSlug.create('-andres')).toThrow(/slug/i)
    expect(() => AgentSlug.create('andres-')).toThrow(/slug/i)
    expect(() => AgentSlug.create('andres--giunta')).toThrow(/slug/i)
  })

  it('slugifyName normaliza acentos y espacios', () => {
    expect(slugifyName('Andrés Giunta')).toBe('andres-giunta')
    expect(slugifyName('  María  José  Pérez ')).toBe('maria-jose-perez')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vendepro-backend/packages/core && npx vitest run tests/domain/agent-slug.test.ts`
Expected: FAIL — no se puede resolver el módulo `agent-slug`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/domain/value-objects/agent-slug.ts
import { ValidationError } from '../errors/validation-error'

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export class AgentSlug {
  private constructor(readonly value: string) {}

  static create(value: string): AgentSlug {
    if (typeof value !== 'string' || value.length < 3 || value.length > 60) {
      throw new ValidationError('slug inválido: debe tener entre 3 y 60 caracteres')
    }
    if (!SLUG_RE.test(value)) {
      throw new ValidationError('slug inválido: solo minúsculas, números y guiones simples entre medio')
    }
    return new AgentSlug(value)
  }
}

/** Propone un slug a partir del nombre. No garantiza unicidad — eso lo hace el índice (org_id, slug). */
export function slugifyName(fullName: string): string {
  return fullName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vendepro-backend/packages/core && npx vitest run tests/domain/agent-slug.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add vendepro-backend/packages/core/src/domain/value-objects/agent-slug.ts vendepro-backend/packages/core/tests/domain/agent-slug.test.ts
git commit -m "feat(landings-agente): value object AgentSlug"
```

---

### Task 2: Entidad `AgentProfile` + migración `048`

**Files:**
- Create: `vendepro-backend/packages/core/src/domain/entities/agent-profile.ts`
- Create: `vendepro-backend/migrations_v2/048_agent_profiles.sql`
- Test: `vendepro-backend/packages/core/tests/domain/agent-profile.test.ts`

**Interfaces:**
- Consumes: `AgentSlug` (Task 1).
- Produces: `AgentProfile.create(input)`, `AgentProfile.fromPersistence(props)`, `.update(patch)`, `.toObject()`. Getters: `user_id, org_id, slug, headline, bio, license, years_experience, zones, specialties, whatsapp, instagram, tiktok, youtube, linkedin, website, cover_image_url, stats, is_public, created_at, updated_at`. `zones`/`specialties` son `string[]`; `stats` es `Array<{label: string; value: string}>`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/domain/agent-profile.test.ts
import { describe, it, expect } from 'vitest'
import { AgentProfile } from '../../src/domain/entities/agent-profile'

const base = { user_id: 'u1', org_id: 'o1', slug: 'andres-giunta' }

describe('AgentProfile', () => {
  it('crea con defaults: no público y colecciones vacías', () => {
    const p = AgentProfile.create(base)
    expect(p.slug).toBe('andres-giunta')
    expect(p.is_public).toBe(false)
    expect(p.zones).toEqual([])
    expect(p.stats).toEqual([])
    expect(p.bio).toBeNull()
  })

  it('valida el slug al crear', () => {
    expect(() => AgentProfile.create({ ...base, slug: 'Andres Giunta' })).toThrow(/slug/i)
  })

  it('update pisa solo lo pasado y refresca updated_at', async () => {
    const p = AgentProfile.create({ ...base, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' })
    const p2 = p.update({ bio: 'Vendo casas', zones: ['Saavedra', 'Belgrano'] })
    expect(p2.bio).toBe('Vendo casas')
    expect(p2.zones).toEqual(['Saavedra', 'Belgrano'])
    expect(p2.slug).toBe('andres-giunta')
    expect(p2.updated_at).not.toBe('2026-01-01T00:00:00.000Z')
  })

  it('update valida el slug nuevo', () => {
    const p = AgentProfile.create(base)
    expect(() => p.update({ slug: 'NO VALIDO' })).toThrow(/slug/i)
  })

  it('fromPersistence parsea los *_json', () => {
    const p = AgentProfile.fromPersistence({
      ...base, headline: null, bio: null, license: null, years_experience: null,
      zones_json: '["Saavedra"]', specialties_json: null,
      whatsapp: null, instagram: null, tiktok: null, youtube: null, linkedin: null, website: null,
      cover_image_url: null, stats_json: '[{"label":"TikTok","value":"170.000"}]',
      is_public: 1, created_at: 'x', updated_at: 'y',
    })
    expect(p.zones).toEqual(['Saavedra'])
    expect(p.specialties).toEqual([])
    expect(p.stats).toEqual([{ label: 'TikTok', value: '170.000' }])
    expect(p.is_public).toBe(true)
  })

  it('fromPersistence tolera JSON corrupto y devuelve vacío', () => {
    const p = AgentProfile.fromPersistence({
      ...base, headline: null, bio: null, license: null, years_experience: null,
      zones_json: '{roto', specialties_json: null,
      whatsapp: null, instagram: null, tiktok: null, youtube: null, linkedin: null, website: null,
      cover_image_url: null, stats_json: null,
      is_public: 0, created_at: 'x', updated_at: 'y',
    })
    expect(p.zones).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vendepro-backend/packages/core && npx vitest run tests/domain/agent-profile.test.ts`
Expected: FAIL — módulo `agent-profile` no existe.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/domain/entities/agent-profile.ts
import { AgentSlug } from '../value-objects/agent-slug'

export interface AgentStat { label: string; value: string }

export interface AgentProfileProps {
  user_id: string
  org_id: string
  slug: string
  headline: string | null
  bio: string | null
  license: string | null
  years_experience: number | null
  zones: string[]
  specialties: string[]
  whatsapp: string | null
  instagram: string | null
  tiktok: string | null
  youtube: string | null
  linkedin: string | null
  website: string | null
  cover_image_url: string | null
  stats: AgentStat[]
  is_public: boolean
  created_at: string
  updated_at: string
}

/** Fila cruda de D1 — los arrays viajan como TEXT JSON. */
export interface AgentProfileRow {
  user_id: string
  org_id: string
  slug: string
  headline: string | null
  bio: string | null
  license: string | null
  years_experience: number | null
  zones_json: string | null
  specialties_json: string | null
  whatsapp: string | null
  instagram: string | null
  tiktok: string | null
  youtube: string | null
  linkedin: string | null
  website: string | null
  cover_image_url: string | null
  stats_json: string | null
  is_public: number
  created_at: string
  updated_at: string
}

export type AgentProfileCreateInput =
  Pick<AgentProfileProps, 'user_id' | 'org_id' | 'slug'>
  & Partial<Omit<AgentProfileProps, 'user_id' | 'org_id' | 'slug'>>

export type AgentProfilePatch = Partial<Omit<AgentProfileProps, 'user_id' | 'org_id' | 'created_at' | 'updated_at'>>

function parseArray<T>(raw: string | null): T[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? (v as T[]) : []
  } catch {
    return []
  }
}

export class AgentProfile {
  private constructor(private readonly props: AgentProfileProps) {}

  static create(input: AgentProfileCreateInput): AgentProfile {
    AgentSlug.create(input.slug)
    const now = new Date().toISOString()
    return new AgentProfile({
      user_id: input.user_id,
      org_id: input.org_id,
      slug: input.slug,
      headline: input.headline ?? null,
      bio: input.bio ?? null,
      license: input.license ?? null,
      years_experience: input.years_experience ?? null,
      zones: input.zones ?? [],
      specialties: input.specialties ?? [],
      whatsapp: input.whatsapp ?? null,
      instagram: input.instagram ?? null,
      tiktok: input.tiktok ?? null,
      youtube: input.youtube ?? null,
      linkedin: input.linkedin ?? null,
      website: input.website ?? null,
      cover_image_url: input.cover_image_url ?? null,
      stats: input.stats ?? [],
      is_public: input.is_public ?? false,
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
    })
  }

  static fromPersistence(row: AgentProfileRow): AgentProfile {
    return new AgentProfile({
      user_id: row.user_id,
      org_id: row.org_id,
      slug: row.slug,
      headline: row.headline,
      bio: row.bio,
      license: row.license,
      years_experience: row.years_experience,
      zones: parseArray<string>(row.zones_json),
      specialties: parseArray<string>(row.specialties_json),
      whatsapp: row.whatsapp,
      instagram: row.instagram,
      tiktok: row.tiktok,
      youtube: row.youtube,
      linkedin: row.linkedin,
      website: row.website,
      cover_image_url: row.cover_image_url,
      stats: parseArray<AgentStat>(row.stats_json),
      is_public: row.is_public === 1,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }

  get user_id() { return this.props.user_id }
  get org_id() { return this.props.org_id }
  get slug() { return this.props.slug }
  get headline() { return this.props.headline }
  get bio() { return this.props.bio }
  get license() { return this.props.license }
  get years_experience() { return this.props.years_experience }
  get zones() { return this.props.zones }
  get specialties() { return this.props.specialties }
  get whatsapp() { return this.props.whatsapp }
  get instagram() { return this.props.instagram }
  get tiktok() { return this.props.tiktok }
  get youtube() { return this.props.youtube }
  get linkedin() { return this.props.linkedin }
  get website() { return this.props.website }
  get cover_image_url() { return this.props.cover_image_url }
  get stats() { return this.props.stats }
  get is_public() { return this.props.is_public }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  update(patch: AgentProfilePatch): AgentProfile {
    if (patch.slug !== undefined) AgentSlug.create(patch.slug)
    return new AgentProfile({ ...this.props, ...patch, updated_at: new Date().toISOString() })
  }

  toObject(): AgentProfileProps {
    return { ...this.props, zones: [...this.props.zones], specialties: [...this.props.specialties], stats: [...this.props.stats] }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vendepro-backend/packages/core && npx vitest run tests/domain/agent-profile.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Escribir la migración**

```sql
-- vendepro-backend/migrations_v2/048_agent_profiles.sql
-- Perfil público del agente. 1:1 con users, tabla aparte para no mezclar
-- identidad/auth con datos de marketing. La consume api-admin (edición) y
-- api-public (GET /a/:orgSlug/:agentSlug).

CREATE TABLE IF NOT EXISTS agent_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  headline TEXT,               -- "Coordinador Comercial", "Martillera y Corredora"
  bio TEXT,
  license TEXT,                -- matrícula, ej "CUCICBA 3906"
  years_experience INTEGER,
  zones_json TEXT,             -- ["Villa Urquiza","Saavedra"]
  specialties_json TEXT,       -- ["Residencial","Venta"]
  whatsapp TEXT,
  instagram TEXT,
  tiktok TEXT,
  youtube TEXT,
  linkedin TEXT,
  website TEXT,
  cover_image_url TEXT,
  stats_json TEXT,             -- [{"label":"Seguidores TikTok","value":"170.000"}]
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_profiles_org_slug
  ON agent_profiles(org_id, slug);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_org
  ON agent_profiles(org_id, is_public);
```

- [ ] **Step 6: Aplicar la migración en local y verificar**

Run: `cd vendepro-backend && npx wrangler d1 migrations apply vendepro-db --local`
Luego: `npx wrangler d1 execute vendepro-db --local --command "PRAGMA table_info(agent_profiles);"`
Expected: lista las 20 columnas.

- [ ] **Step 7: Commit**

```bash
git add vendepro-backend/packages/core/src/domain/entities/agent-profile.ts vendepro-backend/packages/core/tests/domain/agent-profile.test.ts vendepro-backend/migrations_v2/048_agent_profiles.sql
git commit -m "feat(landings-agente): entidad AgentProfile + migracion 048"
```

---

### Task 3: Port + adapter D1 de `AgentProfileRepository`

**Files:**
- Create: `vendepro-backend/packages/core/src/application/ports/repositories/agent-profile-repository.ts`
- Create: `vendepro-backend/packages/infrastructure/src/repositories/d1-agent-profile-repository.ts`
- Modify: `vendepro-backend/packages/core/src/application/ports/repositories/index.ts` (exportar el port nuevo, siguiendo el patrón de los demás)

**Interfaces:**
- Consumes: `AgentProfile`, `AgentProfileRow` (Task 2).
- Produces: interfaz `AgentProfileRepository` con `findByUserId(userId: string): Promise<AgentProfile | null>`, `findByOrgAndSlug(orgId: string, slug: string): Promise<AgentProfile | null>`, `existsSlug(orgId: string, slug: string, exceptUserId?: string): Promise<boolean>`, `save(profile: AgentProfile): Promise<void>`.

- [ ] **Step 1: Escribir el port**

```typescript
// core/src/application/ports/repositories/agent-profile-repository.ts
import type { AgentProfile } from '../../../domain/entities/agent-profile'

export interface AgentProfileRepository {
  findByUserId(userId: string): Promise<AgentProfile | null>
  findByOrgAndSlug(orgId: string, slug: string): Promise<AgentProfile | null>
  /** true si el slug ya está tomado en la org por OTRO usuario. */
  existsSlug(orgId: string, slug: string, exceptUserId?: string): Promise<boolean>
  save(profile: AgentProfile): Promise<void>
}
```

- [ ] **Step 2: Exportar el port desde el index**

Abrir `core/src/application/ports/repositories/index.ts` y agregar la línea de export siguiendo exactamente el estilo de las líneas vecinas (por ejemplo, si el archivo usa `export type * from './landing-repository'`, usar la misma forma para `./agent-profile-repository`).

- [ ] **Step 3: Escribir el adapter D1**

```typescript
// infrastructure/src/repositories/d1-agent-profile-repository.ts
import { AgentProfile, type AgentProfileRow } from '@vendepro/core'
import type { AgentProfileRepository } from '@vendepro/core'

export class D1AgentProfileRepository implements AgentProfileRepository {
  constructor(private readonly db: D1Database) {}

  async findByUserId(userId: string): Promise<AgentProfile | null> {
    const row = await this.db
      .prepare('SELECT * FROM agent_profiles WHERE user_id = ?')
      .bind(userId)
      .first<AgentProfileRow>()
    return row ? AgentProfile.fromPersistence(row) : null
  }

  async findByOrgAndSlug(orgId: string, slug: string): Promise<AgentProfile | null> {
    const row = await this.db
      .prepare('SELECT * FROM agent_profiles WHERE org_id = ? AND slug = ?')
      .bind(orgId, slug)
      .first<AgentProfileRow>()
    return row ? AgentProfile.fromPersistence(row) : null
  }

  async existsSlug(orgId: string, slug: string, exceptUserId?: string): Promise<boolean> {
    const row = await this.db
      .prepare('SELECT 1 AS x FROM agent_profiles WHERE org_id = ? AND slug = ? AND user_id != ?')
      .bind(orgId, slug, exceptUserId ?? '')
      .first<{ x: number }>()
    return row !== null
  }

  async save(profile: AgentProfile): Promise<void> {
    const p = profile.toObject()
    await this.db
      .prepare(`
        INSERT INTO agent_profiles (
          user_id, org_id, slug, headline, bio, license, years_experience,
          zones_json, specialties_json, whatsapp, instagram, tiktok, youtube,
          linkedin, website, cover_image_url, stats_json, is_public,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          slug = excluded.slug,
          headline = excluded.headline,
          bio = excluded.bio,
          license = excluded.license,
          years_experience = excluded.years_experience,
          zones_json = excluded.zones_json,
          specialties_json = excluded.specialties_json,
          whatsapp = excluded.whatsapp,
          instagram = excluded.instagram,
          tiktok = excluded.tiktok,
          youtube = excluded.youtube,
          linkedin = excluded.linkedin,
          website = excluded.website,
          cover_image_url = excluded.cover_image_url,
          stats_json = excluded.stats_json,
          is_public = excluded.is_public,
          updated_at = excluded.updated_at
      `)
      .bind(
        p.user_id, p.org_id, p.slug, p.headline, p.bio, p.license, p.years_experience,
        JSON.stringify(p.zones), JSON.stringify(p.specialties), p.whatsapp, p.instagram,
        p.tiktok, p.youtube, p.linkedin, p.website, p.cover_image_url,
        JSON.stringify(p.stats), p.is_public ? 1 : 0, p.created_at, p.updated_at,
      )
      .run()
  }
}
```

> Si `@vendepro/core` no reexporta `AgentProfileRow` o el port, agregar los exports en el `index.ts` público de core siguiendo el patrón de las entidades vecinas (ej. `Landing`).

- [ ] **Step 4: Verificar que compila**

Run: `cd vendepro-backend && npx turbo build --filter @vendepro/core --filter @vendepro/infrastructure`
Expected: build OK, sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add vendepro-backend/packages/core/src/application/ports/repositories/ vendepro-backend/packages/infrastructure/src/repositories/d1-agent-profile-repository.ts
git commit -m "feat(landings-agente): port + adapter D1 de AgentProfileRepository"
```

---

### Task 4: Kind `agent_profile` + invariante de lead-form por kind

**Files:**
- Modify: `vendepro-backend/packages/core/src/domain/entities/landing.ts` (línea 6 el kind, 43 `VALID_KINDS`, 57-60 y 122-124 la invariante)
- Modify: `vendepro-backend/packages/core/src/domain/rules/landing-rules.ts`
- Modify: `vendepro-backend/packages/core/src/application/ports/repositories/landing-repository.ts` (`LandingFilters.kind`)
- Test: `vendepro-backend/packages/core/tests/domain/landing.test.ts` (agregar casos)

**Interfaces:**
- Consumes: nada de tasks previas.
- Produces: `LandingKind = 'lead_capture' | 'property' | 'agent_profile'`; `assertLeadFormInvariant(kind: LandingKind, blocks: Block[]): void` exportada desde `landing-rules.ts`.

- [ ] **Step 1: Write the failing test**

Agregar al final de `tests/domain/landing.test.ts`, dentro del `describe('Landing', ...)` existente (reusa los helpers `makeHero` / `makeLeadForm` que ya están arriba en ese archivo):

```typescript
  it('agent_profile permite cero lead-form', () => {
    const l = Landing.create({
      id: 'l1', org_id: 'o1', agent_id: 'a1', template_id: 't1',
      kind: 'agent_profile',
      slug_base: 'andres', slug_suffix: 'k7xm3',
      blocks: [makeHero()],
    })
    expect(l.kind).toBe('agent_profile')
    expect(l.blocks.length).toBe(1)
  })

  it('agent_profile permite exactamente un lead-form', () => {
    const l = Landing.create({
      id: 'l1', org_id: 'o1', agent_id: 'a1', template_id: 't1',
      kind: 'agent_profile',
      slug_base: 'andres', slug_suffix: 'k7xm3',
      blocks: [makeHero(), makeLeadForm()],
    })
    expect(l.blocks.length).toBe(2)
  })

  it('agent_profile rechaza dos lead-form', () => {
    expect(() => Landing.create({
      id: 'l1', org_id: 'o1', agent_id: 'a1', template_id: 't1',
      kind: 'agent_profile',
      slug_base: 'andres', slug_suffix: 'k7xm3',
      blocks: [makeLeadForm('f1'), makeLeadForm('f2')],
    })).toThrow(/lead-form/i)
  })

  it('replaceBlocks en agent_profile permite quedarse sin lead-form', () => {
    const l = Landing.create({
      id: 'l1', org_id: 'o1', agent_id: 'a1', template_id: 't1',
      kind: 'agent_profile',
      slug_base: 'andres', slug_suffix: 'k7xm3',
      blocks: [makeHero(), makeLeadForm()],
    })
    expect(l.replaceBlocks([makeHero()]).blocks.length).toBe(1)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vendepro-backend/packages/core && npx vitest run tests/domain/landing.test.ts`
Expected: FAIL — `kind inválido: "agent_profile"` en los 4 casos nuevos. Los tests viejos siguen pasando.

- [ ] **Step 3: Agregar la regla a `landing-rules.ts`**

```typescript
// agregar a src/domain/rules/landing-rules.ts
import type { LandingKind } from '../entities/landing'
import type { Block } from '../value-objects/block-schemas'
import { ValidationError } from '../errors/validation-error'

/**
 * Cuántos bloques lead-form admite cada kind.
 * lead_capture y property: exactamente 1 (comportamiento histórico).
 * agent_profile: 0 o 1 — un agente puede venderse solo con CTAs de WhatsApp.
 */
export function assertLeadFormInvariant(kind: LandingKind, blocks: Block[]): void {
  const count = blocks.filter(b => b.type === 'lead-form').length
  if (kind === 'agent_profile') {
    if (count > 1) throw new ValidationError('La landing debe tener a lo sumo un bloque lead-form')
    return
  }
  if (count === 0) throw new ValidationError('La landing debe contener un bloque lead-form')
  if (count > 1) throw new ValidationError('La landing debe tener un único bloque lead-form')
}
```

- [ ] **Step 4: Usar la regla en `landing.ts`**

En `src/domain/entities/landing.ts`:
1. Línea 6 → `export type LandingKind = 'lead_capture' | 'property' | 'agent_profile'`
2. Línea 43 → `const VALID_KINDS: LandingKind[] = ['lead_capture', 'property', 'agent_profile']`
3. Importar `assertLeadFormInvariant` desde `../rules/landing-rules`.
4. En `create()`, reemplazar el bloque de las líneas 57-60 (los dos `if` de `leadForms`) por:

```typescript
    assertLeadFormInvariant(input.kind, v.data)
```

5. En `replaceBlocks()`, reemplazar las líneas 123-124 (`const leadForms = ...` y su `if`) por:

```typescript
    assertLeadFormInvariant(this.props.kind, v.data)
```

- [ ] **Step 5: Actualizar `LandingFilters`**

En `core/src/application/ports/repositories/landing-repository.ts`, importar `LandingKind` desde `../../../domain/entities/landing` y cambiar el campo del filtro a `kind?: LandingKind` (hoy repite el union a mano).

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd vendepro-backend/packages/core && npx vitest run tests/domain/landing.test.ts tests/domain/landing-rules.test.ts`
Expected: PASS. **Los tests preexistentes de `lead_capture`/`property` deben seguir verdes** — si alguno se rompió, la invariante quedó mal.

- [ ] **Step 7: Commit**

```bash
git add vendepro-backend/packages/core/src/domain/entities/landing.ts vendepro-backend/packages/core/src/domain/rules/landing-rules.ts vendepro-backend/packages/core/src/application/ports/repositories/landing-repository.ts vendepro-backend/packages/core/tests/domain/landing.test.ts
git commit -m "feat(landings-agente): kind agent_profile + invariante lead-form por kind"
```

---

### Task 5: Los 4 bloques nuevos + campo `binding` en el envelope

**Files:**
- Modify: `vendepro-backend/packages/core/src/domain/value-objects/block-schemas.ts`
- Test: `vendepro-backend/packages/core/tests/domain/block-schemas.test.ts` (agregar casos)

**Interfaces:**
- Consumes: nada.
- Produces: `BLOCK_TYPES` suma `'agent-hero' | 'agent-credentials' | 'faq' | 'cta-whatsapp'`. El envelope de `BlockSchema` suma `binding?: 'agent_profile'`.

- [ ] **Step 1: Write the failing test**

Agregar a `tests/domain/block-schemas.test.ts`:

```typescript
import { validateBlock, validateBlocks } from '../../src/domain/value-objects/block-schemas'

describe('bloques de agente', () => {
  const hero = {
    id: 'b1', type: 'agent-hero', visible: true, binding: 'agent_profile',
    data: {
      name: 'Andrés Giunta', headline: 'Coordinador Comercial',
      bio: 'Vendo propiedades en Caballito', photo_url: 'https://x/f.jpg',
      ctas: [{ label: 'Quiero vender', href: 'https://wa.me/5491130045087', style: 'whatsapp' }],
      accent_color: 'pink',
    },
  }

  it('acepta agent-hero con binding', () => {
    const r = validateBlock(hero)
    expect(r.success).toBe(true)
  })

  it('acepta agent-hero sin binding', () => {
    const { binding, ...sinBinding } = hero as any
    expect(validateBlock(sinBinding).success).toBe(true)
  })

  it('rechaza un binding desconocido', () => {
    expect(validateBlock({ ...hero, binding: 'otra_cosa' }).success).toBe(false)
  })

  it('agent-hero exige photo_url url válida', () => {
    expect(validateBlock({ ...hero, data: { ...hero.data, photo_url: 'no-es-url' } }).success).toBe(false)
  })

  it('agent-hero admite hasta 3 CTAs', () => {
    const cuatro = Array.from({ length: 4 }, () => ({ label: 'x', href: 'https://x', style: 'primary' }))
    expect(validateBlock({ ...hero, data: { ...hero.data, ctas: cuatro } }).success).toBe(false)
  })

  it('acepta agent-credentials', () => {
    expect(validateBlock({
      id: 'b2', type: 'agent-credentials', visible: true, binding: 'agent_profile',
      data: {
        title: 'Credenciales', license: 'CUCICBA 3906', years_experience: 12,
        zones: ['Saavedra', 'Belgrano'], specialties: ['Residencial'],
        stats: [{ label: 'Seguidores TikTok', value: '170.000' }],
      },
    }).success).toBe(true)
  })

  it('acepta faq con 2 items y rechaza con 1', () => {
    const mk = (n: number) => ({
      id: 'b3', type: 'faq', visible: true,
      data: { title: 'Preguntas', items: Array.from({ length: n }, (_, i) => ({ question: `q${i}`, answer: `a${i}` })) },
    })
    expect(validateBlock(mk(2)).success).toBe(true)
    expect(validateBlock(mk(1)).success).toBe(false)
  })

  it('acepta cta-whatsapp', () => {
    expect(validateBlock({
      id: 'b4', type: 'cta-whatsapp', visible: true, binding: 'agent_profile',
      data: { title: '¿Querés vender?', phone: '+5491130045087', button_label: 'Escribime', message_template: 'Hola Andrés' },
    }).success).toBe(true)
  })

  it('cta-whatsapp exige phone y button_label', () => {
    expect(validateBlock({
      id: 'b4', type: 'cta-whatsapp', visible: true,
      data: { title: 'x' },
    }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vendepro-backend/packages/core && npx vitest run tests/domain/block-schemas.test.ts`
Expected: FAIL — los tipos nuevos no existen en el discriminated union.

- [ ] **Step 3: Agregar los schemas**

En `block-schemas.ts`, después de `FooterDataSchema` (línea 85):

```typescript
const AgentHeroDataSchema = z.object({
  name: z.string().min(1).max(120),
  headline: z.string().max(160).optional(),
  bio: z.string().max(1200).optional(),
  photo_url: z.string().url(),
  background_image_url: z.string().url().optional(),
  ctas: z.array(z.object({
    label: z.string().min(1).max(40),
    href: z.string().min(1),
    style: z.enum(['primary', 'secondary', 'whatsapp']),
  })).max(3),
  accent_color: z.enum(['pink', 'orange', 'dark']),
})

const AgentCredentialsDataSchema = z.object({
  title: z.string().max(200).optional(),
  license: z.string().max(80).optional(),
  years_experience: z.number().int().min(0).max(70).optional(),
  zones: z.array(z.string().min(1).max(60)).max(12),
  specialties: z.array(z.string().min(1).max(60)).max(8),
  stats: z.array(z.object({
    label: z.string().min(1).max(60),
    value: z.string().min(1).max(30),
  })).max(4),
})

const FaqDataSchema = z.object({
  title: z.string().max(200).optional(),
  items: z.array(z.object({
    question: z.string().min(1).max(200),
    answer: z.string().min(1).max(1200),
  })).min(2).max(12),
})

const CtaWhatsappDataSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).optional(),
  phone: z.string().min(1).max(40),
  message_template: z.string().max(300).optional(),
  button_label: z.string().min(1).max(40),
})
```

- [ ] **Step 4: Registrar los tipos y el binding**

1. En `BLOCK_TYPES` (línea 89) agregar al final del array: `'agent-hero'`, `'agent-credentials'`, `'faq'`, `'cta-whatsapp'`.
2. En `BLOCK_DATA_SCHEMAS` (línea 102) agregar las 4 entradas:

```typescript
  'agent-hero': AgentHeroDataSchema,
  'agent-credentials': AgentCredentialsDataSchema,
  'faq': FaqDataSchema,
  'cta-whatsapp': CtaWhatsappDataSchema,
```

3. En el envelope de `BlockSchema` (línea 115-127), agregar el campo junto a `is_variable`:

```typescript
    // Marca que este bloque se rellena en la lectura pública con los datos del
    // perfil del agente (ver agent-bindings.ts). Los campos bindeados son
    // read-only en el editor.
    binding: z.literal('agent_profile').optional(),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd vendepro-backend/packages/core && npx vitest run tests/domain/block-schemas.test.ts`
Expected: PASS, incluidos los tests preexistentes de los 8 bloques originales.

- [ ] **Step 6: Commit**

```bash
git add vendepro-backend/packages/core/src/domain/value-objects/block-schemas.ts vendepro-backend/packages/core/tests/domain/block-schemas.test.ts
git commit -m "feat(landings-agente): bloques agent-hero, agent-credentials, faq, cta-whatsapp + campo binding"
```

---

### Task 6: `AGENT_BINDINGS` + `resolveAgentBindings`

**Files:**
- Create: `vendepro-backend/packages/core/src/domain/value-objects/agent-bindings.ts`
- Test: `vendepro-backend/packages/core/tests/domain/agent-bindings.test.ts`

**Interfaces:**
- Consumes: `Block` (Task 5), `AgentProfile` (Task 2).
- Produces: `resolveAgentBindings(blocks: Block[], ctx: { user: AgentBindingUser; profile: AgentProfile }): Block[]` y el tipo `AgentBindingUser = { full_name: string; photo_url: string | null; phone: string | null }`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/domain/agent-bindings.test.ts
import { describe, it, expect } from 'vitest'
import { resolveAgentBindings } from '../../src/domain/value-objects/agent-bindings'
import { AgentProfile } from '../../src/domain/entities/agent-profile'
import type { Block } from '../../src/domain/value-objects/block-schemas'

const user = { full_name: 'Andrés Giunta', photo_url: 'https://cdn/andres.jpg', phone: '+5491100000000' }

const profile = AgentProfile.create({
  user_id: 'u1', org_id: 'o1', slug: 'andres-giunta',
  headline: 'Coordinador Comercial', bio: 'Vendo en Caballito',
  license: 'CUCICBA 3906', zones: ['Caballito'], whatsapp: '+5491130045087',
  instagram: 'el.actor.inmobiliario',
})

const heroBindeado = (): Block => ({
  id: 'b1', type: 'agent-hero', visible: true, binding: 'agent_profile',
  data: {
    name: 'PLACEHOLDER', headline: 'PLACEHOLDER', bio: 'PLACEHOLDER',
    photo_url: 'https://cdn/placeholder.jpg', ctas: [], accent_color: 'pink',
  },
} as Block)

describe('resolveAgentBindings', () => {
  it('rellena agent-hero con los datos del perfil y del user', () => {
    const [b] = resolveAgentBindings([heroBindeado()], { user, profile })
    expect((b.data as any).name).toBe('Andrés Giunta')
    expect((b.data as any).headline).toBe('Coordinador Comercial')
    expect((b.data as any).bio).toBe('Vendo en Caballito')
    expect((b.data as any).photo_url).toBe('https://cdn/andres.jpg')
  })

  it('no toca bloques sin binding', () => {
    const sinBinding = { ...heroBindeado(), binding: undefined } as Block
    const [b] = resolveAgentBindings([sinBinding], { user, profile })
    expect((b.data as any).name).toBe('PLACEHOLDER')
  })

  it('conserva el valor del bloque cuando el perfil no tiene el dato', () => {
    const sinFoto = { ...user, photo_url: null }
    const [b] = resolveAgentBindings([heroBindeado()], { user: sinFoto, profile })
    expect((b.data as any).photo_url).toBe('https://cdn/placeholder.jpg')
  })

  it('conserva el valor del bloque cuando el array del perfil está vacío', () => {
    const vacio = AgentProfile.create({ user_id: 'u1', org_id: 'o1', slug: 'x' })
    const cred: Block = {
      id: 'b2', type: 'agent-credentials', visible: true, binding: 'agent_profile',
      data: { zones: ['Fallback'], specialties: [], stats: [] },
    } as Block
    const [b] = resolveAgentBindings([cred], { user, profile: vacio })
    expect((b.data as any).zones).toEqual(['Fallback'])
  })

  it('rellena el teléfono de cta-whatsapp desde el whatsapp del perfil', () => {
    const cta: Block = {
      id: 'b3', type: 'cta-whatsapp', visible: true, binding: 'agent_profile',
      data: { title: '¿Vendemos?', phone: '+540000000000', button_label: 'Escribime' },
    } as Block
    const [b] = resolveAgentBindings([cta], { user, profile })
    expect((b.data as any).phone).toBe('+5491130045087')
  })

  it('no rompe si el merge produciría algo inválido: devuelve el bloque original', () => {
    const malo = { ...heroBindeado(), data: { ...(heroBindeado().data as any) } } as Block
    const userSinNombre = { ...user, full_name: '' }
    const [b] = resolveAgentBindings([malo], { user: userSinNombre, profile })
    expect((b.data as any).name).toBe('PLACEHOLDER')
  })

  it('no muta los bloques de entrada', () => {
    const input = [heroBindeado()]
    resolveAgentBindings(input, { user, profile })
    expect((input[0].data as any).name).toBe('PLACEHOLDER')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vendepro-backend/packages/core && npx vitest run tests/domain/agent-bindings.test.ts`
Expected: FAIL — módulo `agent-bindings` no existe.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/domain/value-objects/agent-bindings.ts
import type { Block, BlockType } from './block-schemas'
import { validateBlock } from './block-schemas'
import type { AgentProfile } from '../entities/agent-profile'

export interface AgentBindingUser {
  full_name: string
  photo_url: string | null
  phone: string | null
}

/**
 * Qué campo del bloque se llena con qué dato. Prefijo `user.` = viene de la
 * tabla users; sin prefijo = viene de agent_profiles.
 * Fuente única: la usan el resolver público y el preview del editor.
 */
export const AGENT_BINDINGS: Partial<Record<BlockType, Record<string, string>>> = {
  'agent-hero': {
    name: 'user.full_name',
    headline: 'headline',
    bio: 'bio',
    photo_url: 'user.photo_url',
    background_image_url: 'cover_image_url',
  },
  'agent-credentials': {
    license: 'license',
    years_experience: 'years_experience',
    zones: 'zones',
    specialties: 'specialties',
    stats: 'stats',
  },
  'cta-whatsapp': {
    phone: 'whatsapp',
  },
  'footer': {
    phone: 'whatsapp',
    instagram: 'instagram',
    agency_registration: 'license',
  },
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
}

function readSource(path: string, ctx: { user: AgentBindingUser; profile: AgentProfile }): unknown {
  if (path.startsWith('user.')) {
    return (ctx.user as unknown as Record<string, unknown>)[path.slice(5)]
  }
  return (ctx.profile as unknown as Record<string, unknown>)[path]
}

/**
 * Rellena los bloques marcados con `binding: 'agent_profile'` con los datos
 * vivos del agente. Un campo vacío en el perfil deja el valor del bloque, que
 * funciona como fallback editorial. Si el merge produce un bloque inválido,
 * se devuelve el original: la landing nunca se rompe por un perfil incompleto.
 */
export function resolveAgentBindings(
  blocks: Block[],
  ctx: { user: AgentBindingUser; profile: AgentProfile },
): Block[] {
  return blocks.map((block) => {
    if (block.binding !== 'agent_profile') return block
    const map = AGENT_BINDINGS[block.type]
    if (!map) return block

    const data: Record<string, unknown> = { ...(block.data as Record<string, unknown>) }
    for (const [field, path] of Object.entries(map)) {
      const value = readSource(path, ctx)
      if (!isEmpty(value)) data[field] = value
    }

    const candidate = { ...block, data }
    const parsed = validateBlock(candidate)
    return parsed.success ? parsed.data : block
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vendepro-backend/packages/core && npx vitest run tests/domain/agent-bindings.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add vendepro-backend/packages/core/src/domain/value-objects/agent-bindings.ts vendepro-backend/packages/core/tests/domain/agent-bindings.test.ts
git commit -m "feat(landings-agente): mapa AGENT_BINDINGS + resolveAgentBindings"
```

---

### Task 7: `findPublishedByAgentAndKind` en el repo de landings

**Files:**
- Modify: `vendepro-backend/packages/core/src/application/ports/repositories/landing-repository.ts`
- Modify: `vendepro-backend/packages/infrastructure/src/repositories/d1-landing-repository.ts`

**Interfaces:**
- Consumes: `LandingKind` (Task 4).
- Produces: `LandingRepository.findPublishedByAgentAndKind(orgId: string, agentId: string, kind: LandingKind): Promise<Landing | null>`.

- [ ] **Step 1: Agregar el método al port**

En `landing-repository.ts`, dentro de la interfaz:

```typescript
  /**
   * La landing publicada de un agente para un kind dado. Si hubiera más de una
   * (no debería), devuelve la publicada más recientemente.
   */
  findPublishedByAgentAndKind(orgId: string, agentId: string, kind: LandingKind): Promise<Landing | null>
```

- [ ] **Step 2: Implementar en el adapter D1**

En `d1-landing-repository.ts`, reusando el helper privado `toEntity(row)` que ya existe en ese archivo (línea 86) y que usan `findByFullSlug` y `findByOrg`. No duplicar el parseo de `blocks_json` / `lead_rules_json`:

```typescript
  async findPublishedByAgentAndKind(orgId: string, agentId: string, kind: LandingKind): Promise<Landing | null> {
    const row = await this.db
      .prepare(`
        SELECT * FROM landings
        WHERE org_id = ? AND agent_id = ? AND kind = ? AND status = 'published'
        ORDER BY published_at DESC
        LIMIT 1
      `)
      .bind(orgId, agentId, kind)
      .first() as any
    return row ? this.toEntity(row) : null
  }
```

- [ ] **Step 3: Verificar que compila**

Run: `cd vendepro-backend && npx turbo build --filter @vendepro/core --filter @vendepro/infrastructure`
Expected: build OK. Si algún fake de test implementa `LandingRepository` de forma completa, TypeScript va a exigir el método nuevo — agregarlo como `vi.fn()` en esos fakes.

- [ ] **Step 4: Run full backend test suite**

Run: `cd vendepro-backend && npm test`
Expected: PASS. Este paso caza los fakes desactualizados.

- [ ] **Step 5: Commit**

```bash
git add vendepro-backend/packages/core/src/application/ports/repositories/landing-repository.ts vendepro-backend/packages/infrastructure/src/repositories/d1-landing-repository.ts
git commit -m "feat(landings-agente): findPublishedByAgentAndKind en LandingRepository"
```

---

### Task 8: `GetPublicAgentLandingUseCase`

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/get-public-agent-landing.ts`
- Test: `vendepro-backend/packages/core/tests/use-cases/landings/get-public-agent-landing.test.ts`

**Interfaces:**
- Consumes: `AgentProfileRepository` (Task 3), `LandingRepository.findPublishedByAgentAndKind` (Task 7), `resolveAgentBindings` (Task 6), `OrganizationRepository.findBySlug` y `UserRepository.findProfileById` (ya existen).
- Produces: `GetPublicAgentLandingUseCase` con constructor `(orgs, agentProfiles, users, landings)` y `execute({ orgSlug, agentSlug }): Promise<PublicAgentLanding>`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/use-cases/landings/get-public-agent-landing.test.ts
import { describe, it, expect, vi } from 'vitest'
import { GetPublicAgentLandingUseCase } from '../../../src/application/use-cases/landings/get-public-agent-landing'
import { AgentProfile } from '../../../src/domain/entities/agent-profile'
import { Landing } from '../../../src/domain/entities/landing'
import type { Block } from '../../../src/domain/value-objects/block-schemas'

const heroBindeado = (): Block => ({
  id: 'b1', type: 'agent-hero', visible: true, binding: 'agent_profile',
  data: { name: 'X', headline: 'X', bio: 'X', photo_url: 'https://cdn/ph.jpg', ctas: [], accent_color: 'pink' },
} as Block)

function makeDeps() {
  const org = { id: 'o1', name: 'Marcela Genta', slug: 'marcela-genta', logo_url: 'https://cdn/logo.png', brand_color: '#ff007c', brand_accent_color: '#ff8017' }
  const profile = AgentProfile.create({
    user_id: 'u1', org_id: 'o1', slug: 'andres-giunta',
    headline: 'Coordinador Comercial', bio: 'Vendo en Caballito', is_public: true,
  })
  const user = { id: 'u1', org_id: 'o1', full_name: 'Andrés Giunta', photo_url: 'https://cdn/a.jpg', phone: '+5491100000000', active: true, deleted_at: null }
  const landing = Landing.create({
    id: 'l1', org_id: 'o1', agent_id: 'u1', template_id: 't1',
    kind: 'agent_profile', slug_base: 'andres', slug_suffix: 'k7xm3',
    blocks: [heroBindeado()], seo_title: 'Andrés Giunta',
  })

  return {
    org, profile, user, landing,
    orgs: { findBySlug: vi.fn(async () => org) },
    agentProfiles: { findByOrgAndSlug: vi.fn(async () => profile) },
    users: { findProfileById: vi.fn(async () => user) },
    landings: { findPublishedByAgentAndKind: vi.fn(async () => landing) },
  }
}

const build = (d: ReturnType<typeof makeDeps>) =>
  new GetPublicAgentLandingUseCase(d.orgs as any, d.agentProfiles as any, d.users as any, d.landings as any)

describe('GetPublicAgentLandingUseCase', () => {
  it('devuelve los bloques con el binding ya resuelto', async () => {
    const d = makeDeps()
    const out = await build(d).execute({ orgSlug: 'marcela-genta', agentSlug: 'andres-giunta' })
    expect((out.blocks[0].data as any).name).toBe('Andrés Giunta')
    expect((out.blocks[0].data as any).headline).toBe('Coordinador Comercial')
    expect(out.org.brand_color).toBe('#ff007c')
    expect(out.full_slug).toBe('andres-k7xm3')
    expect(out.landing_id).toBe('l1')
  })

  it('404 si la org no existe', async () => {
    const d = makeDeps()
    d.orgs.findBySlug = vi.fn(async () => null) as any
    await expect(build(d).execute({ orgSlug: 'nope', agentSlug: 'andres-giunta' })).rejects.toThrow()
  })

  it('404 si el perfil no es público', async () => {
    const d = makeDeps()
    const privado = AgentProfile.create({ user_id: 'u1', org_id: 'o1', slug: 'andres-giunta', is_public: false })
    d.agentProfiles.findByOrgAndSlug = vi.fn(async () => privado) as any
    await expect(build(d).execute({ orgSlug: 'marcela-genta', agentSlug: 'andres-giunta' })).rejects.toThrow()
  })

  it('404 si el usuario está inactivo o borrado', async () => {
    const d = makeDeps()
    d.users.findProfileById = vi.fn(async () => ({ ...d.user, active: false })) as any
    await expect(build(d).execute({ orgSlug: 'marcela-genta', agentSlug: 'andres-giunta' })).rejects.toThrow()

    const d2 = makeDeps()
    d2.users.findProfileById = vi.fn(async () => ({ ...d2.user, deleted_at: '2026-01-01' })) as any
    await expect(build(d2).execute({ orgSlug: 'marcela-genta', agentSlug: 'andres-giunta' })).rejects.toThrow()
  })

  it('404 si el usuario pertenece a otra org', async () => {
    const d = makeDeps()
    d.users.findProfileById = vi.fn(async () => ({ ...d.user, org_id: 'otra' })) as any
    await expect(build(d).execute({ orgSlug: 'marcela-genta', agentSlug: 'andres-giunta' })).rejects.toThrow()
  })

  it('404 si no hay landing publicada', async () => {
    const d = makeDeps()
    d.landings.findPublishedByAgentAndKind = vi.fn(async () => null) as any
    await expect(build(d).execute({ orgSlug: 'marcela-genta', agentSlug: 'andres-giunta' })).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vendepro-backend/packages/core && npx vitest run tests/use-cases/landings/get-public-agent-landing.test.ts`
Expected: FAIL — el use case no existe.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/application/use-cases/landings/get-public-agent-landing.ts
import type { OrganizationRepository } from '../../ports/repositories/organization-repository'
import type { AgentProfileRepository } from '../../ports/repositories/agent-profile-repository'
import type { UserRepository } from '../../ports/repositories/user-repository'
import type { LandingRepository } from '../../ports/repositories/landing-repository'
import { resolveAgentBindings } from '../../../domain/value-objects/agent-bindings'
import type { Block } from '../../../domain/value-objects/block-schemas'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface GetPublicAgentLandingInput {
  orgSlug: string
  agentSlug: string
}

export interface PublicAgentLanding {
  landing_id: string
  full_slug: string
  blocks: Block[]
  seo_title: string | null
  seo_description: string | null
  og_image_url: string | null
  org: {
    name: string
    logo_url: string | null
    brand_color: string | null
    brand_accent_color: string | null
  }
  agent: {
    full_name: string
    photo_url: string | null
    headline: string | null
  }
}

export class GetPublicAgentLandingUseCase {
  constructor(
    private readonly orgs: OrganizationRepository,
    private readonly agentProfiles: AgentProfileRepository,
    private readonly users: UserRepository,
    private readonly landings: LandingRepository,
  ) {}

  async execute(input: GetPublicAgentLandingInput): Promise<PublicAgentLanding> {
    const org = await this.orgs.findBySlug(input.orgSlug)
    if (!org) throw new NotFoundError('Landing', input.agentSlug)

    const profile = await this.agentProfiles.findByOrgAndSlug(org.id, input.agentSlug)
    if (!profile || !profile.is_public) throw new NotFoundError('Landing', input.agentSlug)

    // findProfileById NO filtra por org — la comparación de org_id es obligatoria.
    const user = await this.users.findProfileById(profile.user_id)
    if (!user || user.org_id !== org.id || !user.active || user.deleted_at) {
      throw new NotFoundError('Landing', input.agentSlug)
    }

    const landing = await this.landings.findPublishedByAgentAndKind(org.id, profile.user_id, 'agent_profile')
    if (!landing) throw new NotFoundError('Landing', input.agentSlug)

    const blocks = resolveAgentBindings(landing.blocks, {
      user: { full_name: user.full_name, photo_url: user.photo_url ?? null, phone: user.phone ?? null },
      profile,
    })

    return {
      landing_id: landing.id,
      full_slug: landing.full_slug,
      blocks: blocks.filter(b => b.visible),
      seo_title: landing.seo_title,
      seo_description: landing.seo_description,
      og_image_url: landing.og_image_url,
      org: {
        name: org.name,
        logo_url: org.logo_url ?? null,
        brand_color: org.brand_color ?? null,
        brand_accent_color: org.brand_accent_color ?? null,
      },
      agent: {
        full_name: user.full_name,
        photo_url: user.photo_url ?? null,
        headline: profile.headline,
      },
    }
  }
}
```

> Si la entidad `User` no expone `deleted_at` o `active` como getters, agregarlos siguiendo el patrón de los getters vecinos en `domain/entities/user.ts`. No leer la fila cruda desde el use case.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vendepro-backend/packages/core && npx vitest run tests/use-cases/landings/get-public-agent-landing.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add vendepro-backend/packages/core/src/application/use-cases/landings/get-public-agent-landing.ts vendepro-backend/packages/core/tests/use-cases/landings/get-public-agent-landing.test.ts
git commit -m "feat(landings-agente): GetPublicAgentLandingUseCase con binding vivo"
```

---

### Task 9: `UpdateAgentProfileUseCase` + endpoints de api-admin y api-public

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/agents/update-agent-profile.ts`
- Create: `vendepro-backend/packages/core/src/application/use-cases/agents/get-agent-profile.ts`
- Modify: `vendepro-backend/packages/api-admin/src/index.ts`
- Modify: `vendepro-backend/packages/api-public/src/index.ts`
- Test: `vendepro-backend/packages/core/tests/use-cases/agents/update-agent-profile.test.ts`

**Interfaces:**
- Consumes: `AgentProfileRepository` (Task 3), `AgentProfile`/`slugifyName` (Tasks 1-2), `GetPublicAgentLandingUseCase` (Task 8).
- Produces: `UpdateAgentProfileUseCase.execute({ orgId, userId, fullName, patch })`, `GetAgentProfileUseCase.execute({ orgId, userId, fullName })`. Endpoints `GET /profile/public`, `PUT /profile/public` (api-admin) y `GET /a/:orgSlug/:agentSlug` (api-public).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/use-cases/agents/update-agent-profile.test.ts
import { describe, it, expect, vi } from 'vitest'
import { UpdateAgentProfileUseCase } from '../../../src/application/use-cases/agents/update-agent-profile'
import { AgentProfile } from '../../../src/domain/entities/agent-profile'

function makeDeps(existing: AgentProfile | null = null, taken = false) {
  const saved: AgentProfile[] = []
  return {
    saved,
    repo: {
      findByUserId: vi.fn(async () => existing),
      findByOrgAndSlug: vi.fn(),
      existsSlug: vi.fn(async () => taken),
      save: vi.fn(async (p: AgentProfile) => { saved.push(p) }),
    },
  }
}

describe('UpdateAgentProfileUseCase', () => {
  it('crea el perfil si no existe, con slug derivado del nombre', async () => {
    const d = makeDeps(null)
    const uc = new UpdateAgentProfileUseCase(d.repo as any)
    const out = await uc.execute({ orgId: 'o1', userId: 'u1', fullName: 'Andrés Giunta', patch: { bio: 'Hola' } })
    expect(out.slug).toBe('andres-giunta')
    expect(out.bio).toBe('Hola')
    expect(d.saved).toHaveLength(1)
  })

  it('actualiza el perfil existente sin tocar el slug si no se pasa', async () => {
    const existing = AgentProfile.create({ user_id: 'u1', org_id: 'o1', slug: 'andres-giunta', bio: 'viejo' })
    const d = makeDeps(existing)
    const uc = new UpdateAgentProfileUseCase(d.repo as any)
    const out = await uc.execute({ orgId: 'o1', userId: 'u1', fullName: 'Andrés Giunta', patch: { bio: 'nuevo', is_public: true } })
    expect(out.slug).toBe('andres-giunta')
    expect(out.bio).toBe('nuevo')
    expect(out.is_public).toBe(true)
  })

  it('rechaza un slug con forma inválida', async () => {
    const d = makeDeps(null)
    const uc = new UpdateAgentProfileUseCase(d.repo as any)
    await expect(uc.execute({ orgId: 'o1', userId: 'u1', fullName: 'A B', patch: { slug: 'NO VALIDO' } })).rejects.toThrow(/slug/i)
  })

  it('rechaza un slug ya tomado en la org', async () => {
    const d = makeDeps(null, true)
    const uc = new UpdateAgentProfileUseCase(d.repo as any)
    await expect(uc.execute({ orgId: 'o1', userId: 'u1', fullName: 'A B', patch: { slug: 'tomado' } })).rejects.toThrow(/en uso|tomado|disponible/i)
  })

  it('permite conservar el slug propio (existsSlug excluye al usuario)', async () => {
    const existing = AgentProfile.create({ user_id: 'u1', org_id: 'o1', slug: 'andres-giunta' })
    const d = makeDeps(existing, false)
    const uc = new UpdateAgentProfileUseCase(d.repo as any)
    await uc.execute({ orgId: 'o1', userId: 'u1', fullName: 'Andrés Giunta', patch: { slug: 'andres-giunta' } })
    expect(d.repo.existsSlug).toHaveBeenCalledWith('o1', 'andres-giunta', 'u1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vendepro-backend/packages/core && npx vitest run tests/use-cases/agents/update-agent-profile.test.ts`
Expected: FAIL — el use case no existe.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/application/use-cases/agents/update-agent-profile.ts
import type { AgentProfileRepository } from '../../ports/repositories/agent-profile-repository'
import { AgentProfile, type AgentProfilePatch } from '../../../domain/entities/agent-profile'
import { AgentSlug, slugifyName } from '../../../domain/value-objects/agent-slug'
import { ValidationError } from '../../../domain/errors/validation-error'

export interface UpdateAgentProfileInput {
  orgId: string
  userId: string
  /** Se usa para derivar el slug la primera vez. */
  fullName: string
  patch: AgentProfilePatch
}

export class UpdateAgentProfileUseCase {
  constructor(private readonly repo: AgentProfileRepository) {}

  async execute(input: UpdateAgentProfileInput): Promise<AgentProfile> {
    const existing = await this.repo.findByUserId(input.userId)

    if (input.patch.slug !== undefined) {
      AgentSlug.create(input.patch.slug)
      const taken = await this.repo.existsSlug(input.orgId, input.patch.slug, input.userId)
      if (taken) throw new ValidationError(`El slug "${input.patch.slug}" ya está en uso en tu inmobiliaria`)
    }

    if (existing) {
      const updated = existing.update(input.patch)
      await this.repo.save(updated)
      return updated
    }

    const slug = input.patch.slug ?? slugifyName(input.fullName)
    AgentSlug.create(slug)
    if (input.patch.slug === undefined) {
      const taken = await this.repo.existsSlug(input.orgId, slug, input.userId)
      if (taken) throw new ValidationError(`El slug "${slug}" ya está en uso. Elegí otro.`)
    }

    const created = AgentProfile.create({ ...input.patch, user_id: input.userId, org_id: input.orgId, slug })
    await this.repo.save(created)
    return created
  }
}
```

```typescript
// src/application/use-cases/agents/get-agent-profile.ts
import type { AgentProfileRepository } from '../../ports/repositories/agent-profile-repository'
import { AgentProfile } from '../../../domain/entities/agent-profile'
import { slugifyName } from '../../../domain/value-objects/agent-slug'

export class GetAgentProfileUseCase {
  constructor(private readonly repo: AgentProfileRepository) {}

  /** Devuelve el perfil o uno vacío (no persistido) para que la UI tenga qué mostrar. */
  async execute(input: { orgId: string; userId: string; fullName: string }): Promise<AgentProfile> {
    const found = await this.repo.findByUserId(input.userId)
    if (found) return found
    return AgentProfile.create({ user_id: input.userId, org_id: input.orgId, slug: slugifyName(input.fullName) })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vendepro-backend/packages/core && npx vitest run tests/use-cases/agents/update-agent-profile.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Rutas en api-admin**

En `packages/api-admin/src/index.ts`, junto a las rutas `/profile` existentes, siguiendo el patrón de route handler del repo (leer `c.get('orgId')` / `c.get('userId')`, instanciar el repo D1 con `c.env.DB`, castear el body `as any`):

```typescript
app.get('/profile/public', async (c) => {
  const uc = new GetAgentProfileUseCase(new D1AgentProfileRepository(c.env.DB))
  const user = await new D1UserRepository(c.env.DB).findProfileById(c.get('userId'))
  const profile = await uc.execute({
    orgId: c.get('orgId'),
    userId: c.get('userId'),
    fullName: user?.full_name ?? '',
  })
  return c.json(profile.toObject())
})

app.put('/profile/public', async (c) => {
  const body = (await c.req.json()) as any
  const user = await new D1UserRepository(c.env.DB).findProfileById(c.get('userId'))
  const uc = new UpdateAgentProfileUseCase(new D1AgentProfileRepository(c.env.DB))
  const profile = await uc.execute({
    orgId: c.get('orgId'),
    userId: c.get('userId'),
    fullName: user?.full_name ?? '',
    patch: {
      slug: body.slug,
      headline: body.headline ?? null,
      bio: body.bio ?? null,
      license: body.license ?? null,
      years_experience: body.years_experience ?? null,
      zones: body.zones ?? [],
      specialties: body.specialties ?? [],
      whatsapp: body.whatsapp ?? null,
      instagram: body.instagram ?? null,
      tiktok: body.tiktok ?? null,
      youtube: body.youtube ?? null,
      linkedin: body.linkedin ?? null,
      website: body.website ?? null,
      cover_image_url: body.cover_image_url ?? null,
      stats: body.stats ?? [],
      is_public: body.is_public ?? false,
    },
  })
  return c.json(profile.toObject())
})
```

- [ ] **Step 6: Ruta en api-public**

En `packages/api-public/src/index.ts`, junto a `GET /l/:slug`:

```typescript
app.get('/a/:orgSlug/:agentSlug', async (c) => {
  const uc = new GetPublicAgentLandingUseCase(
    new D1OrganizationRepository(c.env.DB),
    new D1AgentProfileRepository(c.env.DB),
    new D1UserRepository(c.env.DB),
    new D1LandingRepository(c.env.DB),
  )
  const data = await uc.execute({
    orgSlug: c.req.param('orgSlug'),
    agentSlug: c.req.param('agentSlug'),
  })
  return c.json(data)
})
```

> El `NotFoundError` lo traduce a 404 el `error-handler` de infrastructure que ya está montado en el worker. No agregar try/catch propio.

- [ ] **Step 7: Verificar build y suite completa**

Run: `cd vendepro-backend && npm test && npx turbo build`
Expected: PASS + build OK de los 9 workers.

- [ ] **Step 8: Commit**

```bash
git add vendepro-backend/packages/core/src/application/use-cases/agents/ vendepro-backend/packages/core/tests/use-cases/agents/ vendepro-backend/packages/api-admin/src/index.ts vendepro-backend/packages/api-public/src/index.ts
git commit -m "feat(landings-agente): use cases de perfil + endpoints admin y publico"
```

---

### Task 10: Template de sistema seedeado (migración 049)

**Files:**
- Create: `vendepro-backend/migrations_v2/049_landing_template_agent_profile.sql`
- Create: `vendepro-backend/scripts/validate-agent-template.mjs` (script de verificación, se conserva)

**Interfaces:**
- Consumes: los 4 bloques (Task 5), el kind (Task 4), `binding` (Task 5).
- Produces: fila en `landing_templates` con `id = 'tpl_agent_profile_v1'`, `org_id = NULL`, `kind = 'agent_profile'`.

- [ ] **Step 1: Escribir el script de validación primero**

```javascript
// vendepro-backend/scripts/validate-agent-template.mjs
// Valida el blocks_json del template de agente contra el Zod real del dominio.
// Uso: node scripts/validate-agent-template.mjs
import { readFileSync } from 'node:fs'
import { validateBlocks } from '../packages/core/dist/index.js'

const sql = readFileSync(new URL('../migrations_v2/049_landing_template_agent_profile.sql', import.meta.url), 'utf8')
const match = sql.match(/'(\[[\s\S]*\])'/)
if (!match) {
  console.error('No se encontró el blocks_json en la migración')
  process.exit(1)
}
const blocks = JSON.parse(match[1].replace(/''/g, "'"))
const result = validateBlocks(blocks)
if (!result.success) {
  console.error('blocks_json INVÁLIDO:', result.error)
  process.exit(1)
}
const leadForms = blocks.filter(b => b.type === 'lead-form').length
if (leadForms > 1) {
  console.error('El template tiene más de un lead-form')
  process.exit(1)
}
console.log(`blocks_json OK — ${blocks.length} bloques, ${leadForms} lead-form`)
```

- [ ] **Step 2: Escribir la migración**

Crear `049_landing_template_agent_profile.sql` con un `INSERT OR IGNORE INTO landing_templates` (`id='tpl_agent_profile_v1'`, `org_id=NULL`, `name='Perfil de agente'`, `kind='agent_profile'`, `description='Mini-página personal del agente: bio, credenciales, servicios y contacto directo.'`, `active=1`, `sort_order=10`) cuyo `blocks_json` sea este array, en este orden. Las comillas simples del texto se escapan duplicándolas (`''`) en SQL:

```json
[
  {"id":"b_hero","type":"agent-hero","visible":true,"binding":"agent_profile",
   "data":{"name":"Tu nombre","headline":"Asesor inmobiliario","bio":"Contá en dos o tres líneas quién sos y por qué alguien debería confiarte la venta de su propiedad.","photo_url":"https://placehold.co/600x600/ff007c/ffffff?text=Foto","ctas":[{"label":"Quiero vender","href":"#contacto","style":"primary"},{"label":"Escribime","href":"#whatsapp","style":"whatsapp"}],"accent_color":"pink"}},

  {"id":"b_cred","type":"agent-credentials","visible":true,"binding":"agent_profile",
   "data":{"title":"Credenciales","license":"","zones":[],"specialties":[],"stats":[]}},

  {"id":"b_serv","type":"features-grid","visible":true,
   "data":{"title":"Qué incluye trabajar conmigo","columns":3,"items":[
     {"icon":"camera","title":"Producción profesional","text":"Fotos, video y tour 360 de la propiedad."},
     {"icon":"megaphone","title":"Plan de difusión","text":"Portales, redes y base propia de compradores."},
     {"icon":"chart","title":"Reportes de avance","text":"Sabés siempre en qué estado está tu venta."}]}},

  {"id":"b_ben","type":"benefits-list","visible":true,
   "data":{"title":"Por qué elegirme","items":[
     {"title":"Precio con datos, no con intuición","description":"Tasación apoyada en comparables reales de la zona."},
     {"title":"Un solo interlocutor","description":"Me ocupo yo de punta a punta, sin cadenas de derivaciones."}]}},

  {"id":"b_gal","type":"gallery","visible":true,
   "data":{"layout":"grid","images":[{"url":"https://placehold.co/800x600?text=Trabajo+1","alt":"Trabajo 1","source":"upload"}]}},

  {"id":"b_faq","type":"faq","visible":true,
   "data":{"title":"Preguntas frecuentes","items":[
     {"question":"¿Cuánto tarda en venderse una propiedad?","answer":"Depende del precio de salida y de la zona. Con precio bien puesto, el grueso de las consultas llega en las primeras tres semanas."},
     {"question":"¿Qué gastos tengo que afrontar?","answer":"Te paso el detalle completo antes de firmar nada: honorarios, sellos y certificados."}]}},

  {"id":"b_wa","type":"cta-whatsapp","visible":true,"binding":"agent_profile",
   "data":{"title":"¿Hablamos?","subtitle":"Respondo personalmente.","phone":"+5491100000000","message_template":"Hola, vi tu página y quiero consultarte por una propiedad","button_label":"Escribime por WhatsApp"}},

  {"id":"b_form","type":"lead-form","visible":true,
   "data":{"title":"Dejame tus datos","subtitle":"Te contacto hoy mismo.","fields":[
     {"key":"name","label":"Nombre","required":true},
     {"key":"phone","label":"Teléfono","required":true},
     {"key":"message","label":"Contame brevemente","required":false}],
    "submit_label":"Enviar","success_message":"¡Gracias! Te contacto a la brevedad.","privacy_note":"Usamos tus datos solo para responderte."}},

  {"id":"b_footer","type":"footer","visible":true,"binding":"agent_profile",
   "data":{"agency_name":"","agency_registration":"","phone":"","instagram":""}}
]
```

> `photo_url` del hero lleva un placeholder **válido** a propósito: un agente sin foto cargada conserva ese valor y la landing no se rompe.

- [ ] **Step 3: Validar el blocks_json contra el Zod real**

Run: `cd vendepro-backend && npx turbo build --filter @vendepro/core && node scripts/validate-agent-template.mjs`
Expected: `blocks_json OK — 9 bloques, 1 lead-form`. Si falla, corregir la migración hasta que pase. **No commitear una migración que no valide.**

- [ ] **Step 4: Aplicar y verificar en local**

Run: `cd vendepro-backend && npx wrangler d1 migrations apply vendepro-db --local`
Luego: `npx wrangler d1 execute vendepro-db --local --command "SELECT id, name, kind, active FROM landing_templates WHERE kind='agent_profile';"`
Expected: una fila `tpl_agent_profile_v1 | Perfil de agente | agent_profile | 1`.

- [ ] **Step 5: Commit**

```bash
git add vendepro-backend/migrations_v2/049_landing_template_agent_profile.sql vendepro-backend/scripts/validate-agent-template.mjs
git commit -m "feat(landings-agente): template de sistema Perfil de agente (migracion 049)"
```

---

### Task 11: Frontend — bloques, ruta pública `/a/[org]/[slug]` y middleware

**Files:**
- Modify: `vendepro-frontend/src/lib/landings/types.ts` (`BlockType`, `BlockDataMap`, campo `binding` en `Block`)
- Create: `vendepro-frontend/src/components/landings/blocks/AgentHeroBlock.tsx`
- Create: `vendepro-frontend/src/components/landings/blocks/AgentCredentialsBlock.tsx`
- Create: `vendepro-frontend/src/components/landings/blocks/FaqBlock.tsx`
- Create: `vendepro-frontend/src/components/landings/blocks/CtaWhatsappBlock.tsx`
- Modify: `vendepro-frontend/src/components/landings/blocks/index.ts`
- Create: `vendepro-frontend/src/app/a/[org]/[slug]/page.tsx`, `loading.tsx`, `not-found.tsx`
- Modify: `vendepro-frontend/src/lib/landings/public-api.ts` (agregar `getPublicAgentLanding`)
- Modify: `vendepro-frontend/src/middleware.ts:17` (`PUBLIC_PREFIXES`)
- Modify: `vendepro-frontend/src/app/l/[slug]/page.tsx` (canónica, Step 7)
- Modify: `vendepro-backend/packages/core/src/application/use-cases/landings/get-public-landing.ts` (devolver `kind` y `agent_public_path`, Step 7) — **es el único toque de backend de esta task**; requiere inyectarle el `AgentProfileRepository` (Task 3) y actualizar la construcción del use case en `packages/api-public/src/index.ts`

**Interfaces:**
- Consumes: el endpoint `GET /a/:orgSlug/:agentSlug` (Task 9) y los tipos de bloque (Task 5).
- Produces: `getPublicAgentLanding(orgSlug, agentSlug)` en `public-api.ts`; los 4 componentes registrados en `BLOCK_COMPONENTS` y `BLOCK_LABELS`.

- [ ] **Step 1: Extender los tipos del frontend**

En `src/lib/landings/types.ts`: agregar `'agent-hero' | 'agent-credentials' | 'faq' | 'cta-whatsapp'` al union `BlockType` (línea 4), las 4 entradas correspondientes a `BlockDataMap` (línea 90) espejando exactamente los schemas Zod de la Task 5, y el campo opcional `binding?: 'agent_profile'` al tipo `Block` (línea 101).

- [ ] **Step 2: Escribir los 4 componentes de bloque**

Cuatro archivos nuevos en `src/components/landings/blocks/`, con la misma firma que los existentes (`{ data, mode }`). Firmas reales del design system a usar: `Heading({ level, weight, as, className, children })`, `Text({ size, weight, tone, as, className, children })`, `Button({ variant, size, icon, fullWidth, ... })`, `WhatsAppButton({ phone, message, iconOnly, className })`.

```tsx
// AgentHeroBlock.tsx
'use client'
import { Heading, Text } from '@/components/ui/Typography'
import { WhatsAppButton } from '@/components/ui/ContactButtons'
import { Button } from '@/components/ui/Button'

export default function AgentHeroBlock({ data }: { data: any; mode?: 'public' | 'editor' }) {
  // `accent_color` es del dato del bloque (pink|orange|dark), no un estado de UI.
  // Se mapea a tokens; `primary` es el token semántico del rosa de marca.
  const accent = data.accent_color === 'orange' ? 'text-brand-orange' : data.accent_color === 'dark' ? 'text-ink' : 'text-primary'
  return (
    <section className="relative w-full overflow-hidden bg-white">
      {data.background_image_url && (
        <img src={data.background_image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15" />
      )}
      <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-16 md:flex-row md:py-24">
        <img
          src={data.photo_url}
          alt={data.name}
          className="h-40 w-40 shrink-0 rounded-full object-cover shadow-card md:h-56 md:w-56"
        />
        <div className="flex flex-col items-center gap-3 text-center md:items-start md:text-left">
          {data.headline && <Text size="sm" weight="semibold" className={accent}>{data.headline}</Text>}
          <Heading level={1}>{data.name}</Heading>
          {data.bio && <Text size="base" tone="muted" className="max-w-prose">{data.bio}</Text>}
          {data.ctas?.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-3 md:justify-start">
              {data.ctas.map((cta: any, i: number) =>
                cta.style === 'whatsapp'
                  ? <WhatsAppButton key={i} phone={cta.href} message={undefined} />
                  : <a key={i} href={cta.href}><Button variant={cta.style === 'primary' ? 'primary' : 'secondary'}>{cta.label}</Button></a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
```

```tsx
// AgentCredentialsBlock.tsx
import { Heading, Text } from '@/components/ui/Typography'
import { Card } from '@/components/ui/Card'

export default function AgentCredentialsBlock({ data }: { data: any; mode?: 'public' | 'editor' }) {
  const hasNothing = !data.license && !data.years_experience && !data.zones?.length && !data.specialties?.length && !data.stats?.length
  if (hasNothing) return null
  return (
    <section className="mx-auto max-w-5xl px-6 py-14">
      {data.title && <Heading level={2} weight="semibold" className="mb-6">{data.title}</Heading>}
      {data.stats?.length > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {data.stats.map((s: any, i: number) => (
            <Card key={i} className="p-4 text-center">
              <Text size="lg" weight="bold">{s.value}</Text>
              <Text size="xs" tone="muted">{s.label}</Text>
            </Card>
          ))}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {data.license && <Text size="sm"><span className="font-semibold">Matrícula:</span> {data.license}</Text>}
        {data.years_experience != null && <Text size="sm"><span className="font-semibold">Experiencia:</span> {data.years_experience} años</Text>}
        {data.zones?.length > 0 && <Text size="sm"><span className="font-semibold">Zonas:</span> {data.zones.join(' · ')}</Text>}
        {data.specialties?.length > 0 && <Text size="sm"><span className="font-semibold">Especialidades:</span> {data.specialties.join(' · ')}</Text>}
      </div>
    </section>
  )
}
```

```tsx
// FaqBlock.tsx
import { ChevronDown } from 'lucide-react'
import { Heading, Text } from '@/components/ui/Typography'

export default function FaqBlock({ data }: { data: any; mode?: 'public' | 'editor' }) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-14">
      {data.title && <Heading level={2} weight="semibold" className="mb-6">{data.title}</Heading>}
      <div className="flex flex-col gap-3">
        {data.items.map((item: any, i: number) => (
          <details key={i} className="group rounded-card border border-gray-200 p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
              <Text size="sm" weight="semibold" as="span">{item.question}</Text>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <Text size="sm" tone="muted" className="mt-3">{item.answer}</Text>
          </details>
        ))}
      </div>
    </section>
  )
}
```

```tsx
// CtaWhatsappBlock.tsx
'use client'
import { Heading, Text } from '@/components/ui/Typography'
import { WhatsAppButton } from '@/components/ui/ContactButtons'

export default function CtaWhatsappBlock({ data }: { data: any; mode?: 'public' | 'editor' }) {
  return (
    <section className="bg-gray-50 px-6 py-14">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
        <Heading level={2} weight="semibold">{data.title}</Heading>
        {data.subtitle && <Text size="base" tone="muted">{data.subtitle}</Text>}
        <WhatsAppButton phone={data.phone} message={data.message_template} className="mt-2" />
      </div>
    </section>
  )
}
```

Reglas que estos componentes ya respetan y que hay que mantener si se ajustan: `WhatsAppButton` de `ui/ContactButtons` en vez de armar el link `wa.me` a mano; `Heading`/`Text` en vez de `<h1>`/`<p>` con clases; `<details>`/`<summary>` nativos para que la FAQ funcione sin JS; mobile-first con `object-cover`; import específico de `lucide-react`.

> Verificar los nombres exactos de export de `Card` y `Button` al importarlos (named vs default) abriendo los archivos en `src/components/ui/`; el resto de las firmas ya están confirmadas arriba.

- [ ] **Step 3: Registrar los bloques**

En `src/components/landings/blocks/index.ts`, agregar los 4 imports, las 4 entradas de `BLOCK_COMPONENTS`, las 4 de `BLOCK_LABELS` (`'Hero de agente'`, `'Credenciales'`, `'Preguntas frecuentes'`, `'CTA WhatsApp'`) y sumarlos al `export {}` final. Como ambos son `Record<BlockType, …>`, TypeScript falla hasta que estén las 4 — esa es la verificación.

- [ ] **Step 4: Agregar el fetch público**

En `src/lib/landings/public-api.ts`, siguiendo el estilo de `getPublicLanding`:

```typescript
export async function getPublicAgentLanding(orgSlug: string, agentSlug: string) {
  const base = process.env.NEXT_PUBLIC_API_PUBLIC_URL ?? 'https://public.api.vendepro.com.ar'
  const res = await fetch(`${base}/a/${orgSlug}/${agentSlug}`, { next: { revalidate: 60 } })
  if (!res.ok) return null
  return (await res.json()) as any
}
```

- [ ] **Step 5: Crear la ruta pública**

`src/app/a/[org]/[slug]/page.tsx`, calcado de `src/app/l/[slug]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PublicLandingShell from '@/components/landings/public/PublicLandingShell'
import { getPublicAgentLanding } from '@/lib/landings/public-api'

interface Props { params: Promise<{ org: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { org, slug } = await params
  const data = await getPublicAgentLanding(org, slug).catch(() => null)
  if (!data) return { title: 'No disponible' }
  const title = data.seo_title ?? data.agent?.full_name ?? slug
  return {
    title,
    description: data.seo_description ?? undefined,
    openGraph: {
      title,
      description: data.seo_description ?? undefined,
      images: data.og_image_url ? [data.og_image_url] : undefined,
    },
    alternates: { canonical: `/a/${org}/${slug}` },
    robots: 'index, follow',
  }
}

export const revalidate = 60

export default async function PublicAgentLandingPage({ params }: Props) {
  const { org, slug } = await params
  const data = await getPublicAgentLanding(org, slug)
  if (!data) notFound()
  return <PublicLandingShell slug={data.full_slug} blocks={data.blocks as any} />
}
```

Crear también `loading.tsx` y `not-found.tsx` copiando los de `src/app/l/[slug]/`.

> Se le pasa `data.full_slug` (no el slug de la URL) para que los eventos de `landing_events` se registren contra la misma landing que `/l/`, sin cambiar el contrato de tracking.

- [ ] **Step 6: Abrir la ruta en el middleware**

En `src/middleware.ts:17`, agregar `'/a/'` al array `PUBLIC_PREFIXES`.

**Sin este paso la landing redirige a `/login` y el bug es silencioso.**

- [ ] **Step 7: Evitar el SEO duplicado con `/l/`**

La misma landing sigue siendo alcanzable por `/l/<full_slug>`. En
`src/app/l/[slug]/page.tsx`, dentro de `generateMetadata`, agregar la canónica
cuando la landing sea de kind `agent_profile` (el endpoint `GET /l/:slug` ya
devuelve el `kind`; si no lo devuelve, agregarlo a la respuesta del use case
`GetPublicLanding`):

```typescript
    alternates: landing.kind === 'agent_profile' && landing.agent_public_path
      ? { canonical: landing.agent_public_path }
      : undefined,
```

Donde `agent_public_path` es `/a/<orgSlug>/<agentSlug>`, calculado en
`GetPublicLandingUseCase` haciendo lookup del perfil del agente cuando el kind
es `agent_profile`. Si el agente no tiene perfil público, se devuelve `null` y
no se emite canónica.

- [ ] **Step 8: Test del bloque de FAQ**

El frontend tiene vitest + testing-library (`npm test` → `vitest run`, ver
`src/components/ui/__tests__/`). Agregar
`src/components/landings/blocks/__tests__/FaqBlock.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import FaqBlock from '../FaqBlock'

describe('FaqBlock', () => {
  it('renderiza todas las preguntas y respuestas', () => {
    render(<FaqBlock data={{ title: 'Preguntas', items: [
      { question: '¿Cuánto tarda?', answer: 'Tres semanas.' },
      { question: '¿Qué gastos hay?', answer: 'Honorarios y sellos.' },
    ] }} />)
    expect(screen.getByText('Preguntas')).toBeInTheDocument()
    expect(screen.getByText('¿Cuánto tarda?')).toBeInTheDocument()
    expect(screen.getByText('Honorarios y sellos.')).toBeInTheDocument()
  })
})
```

Run: `cd vendepro-frontend && npm test`
Expected: PASS, sin romper los tests de `ui/__tests__/`.

- [ ] **Step 9: Verificar que compila y se ve**

Run: `cd vendepro-frontend && npx next build`
Expected: build OK, con `/a/[org]/[slug]` en la lista de rutas.

Luego levantar en local (`npx next dev`) y abrir `/a/<org>/<slug>` con un perfil de prueba: debe renderizar sin redirigir a login.

- [ ] **Step 10: Pasar la revisión de UI**

Estos 4 bloques son la cara pública del feature — lo que ve un comprador que
entra desde la bio de Instagram del agente. Correr el skill `ui-ux-pro-max`
sobre ellos y aplicar lo que devuelva.

Antes de dar por cerrada la task, verificar contra `doc/ds-visual-rules.md`:
- Radio y sombra por token (`rounded-card`/`shadow-card`/`rounded-control`/`rounded-full`), nunca `rounded-xl`/`shadow-sm`/`shadow-lg` sueltos (regla 8).
- Escala `gray`, no `neutral`.
- `WhatsAppButton` de `ui/ContactButtons` en el CTA — nunca un `wa.me` a mano.
- `Heading`/`Text` en vez de tags con clases sueltas.
- Responsive real: 1 columna en mobile, sin scroll horizontal, imágenes con `object-cover` y aspecto fijo.

- [ ] **Step 11: Commit**

```bash
git add vendepro-frontend/src/lib/landings/ vendepro-frontend/src/components/landings/ vendepro-frontend/src/app/a/ vendepro-frontend/src/app/l/ vendepro-frontend/src/middleware.ts
git commit -m "feat(landings-agente): bloques de agente + ruta publica /a/[org]/[slug]"
```

---

### Task 12: Frontend — sección "Perfil público" en `/perfil`

**Files:**
- Modify: `vendepro-frontend/src/app/(dashboard)/perfil/page.tsx`
- Create: `vendepro-frontend/src/components/perfil/PerfilPublicoForm.tsx`

**Interfaces:**
- Consumes: `GET /profile/public` y `PUT /profile/public` de api-admin (Task 9).
- Produces: nada que consuman tasks posteriores.

- [ ] **Step 1: Escribir el formulario**

Crear `PerfilPublicoForm.tsx` (`'use client'`) con `apiFetch('admin', '/profile/public')` para cargar y `PUT` para guardar. Campos: headline, bio (textarea), matrícula, años de experiencia, zonas y especialidades (chips editables), redes (whatsapp, instagram, tiktok, youtube, linkedin, website), cover, stats (label/value, hasta 4), slug, y el toggle `is_public`.

Obligatorio:
- Design system: `Field`, `Input`, `Textarea`, `Button`, `Card`, `Heading`, `Text`. Nada de `<input>` con clases sueltas.
- Manejar los tres estados: loading, error y guardado OK.
- Mostrar la URL final `/a/<orgSlug>/<slug>` con botón de copiar — es el link para la bio de Instagram.
- Al editar el slug, advertir en texto visible: **"Si cambiás el slug, los links que ya repartiste dejan de funcionar."**
- Junto al toggle `is_public`, aclarar que los cambios pueden tardar hasta un minuto en verse en la página pública (`revalidate = 60`), para que no se lea como un bug.

- [ ] **Step 2: Montar la sección en `/perfil`**

Insertar `<PerfilPublicoForm />` en `src/app/(dashboard)/perfil/page.tsx` como sección nueva, debajo de los datos personales, con su `Heading` level 2 en semibold.

- [ ] **Step 3: Verificar build**

Run: `cd vendepro-frontend && npx next build`
Expected: build OK.

- [ ] **Step 4: Probar el ciclo completo a mano**

Con backend y frontend en local: cargar el perfil, guardarlo, activar `is_public`, crear la landing desde `/landings` con el template "Perfil de agente", publicarla y abrir `/a/<org>/<slug>`. Verificar que el nombre, la bio y el teléfono salen del perfil y no del template.

- [ ] **Step 5: Pasar la revisión de UI**

Correr el skill `ui-ux-pro-max` sobre las pantallas nuevas (los 4 bloques públicos + el formulario de perfil) y aplicar lo que devuelva. Es requisito del proyecto para todo trabajo de UI.

- [ ] **Step 6: Commit**

```bash
git add vendepro-frontend/src/app/\(dashboard\)/perfil/page.tsx vendepro-frontend/src/components/perfil/PerfilPublicoForm.tsx
git commit -m "feat(landings-agente): seccion Perfil publico en /perfil"
```

---

### Task 13: Editor — campos bindeados read-only y alta de la landing personal

**Files:**
- Modify: `vendepro-frontend/src/components/landings/InspectorPanel.tsx`
- Modify: `vendepro-frontend/src/components/landings/NewLandingModal.tsx`
- Create: `vendepro-frontend/src/lib/landings/agent-bindings.ts`

**Interfaces:**
- Consumes: el campo `binding` del bloque (Task 11) y el template `tpl_agent_profile_v1` (Task 10).
- Produces: `AGENT_BINDINGS` y `isBoundField(blockType, field, binding)` para el frontend.

- [ ] **Step 1: Espejar el mapa de bindings en el frontend**

El backend es la fuente de verdad, pero el editor necesita saber qué campos
bloquear sin pedirlo por red. Crear `src/lib/landings/agent-bindings.ts` con
**exactamente** el mismo contenido que
`core/src/domain/value-objects/agent-bindings.ts` (Task 6), solo el mapa:

```typescript
import type { BlockType } from './types'

/** Espejo de AGENT_BINDINGS del backend (core/src/domain/value-objects/agent-bindings.ts).
 *  Si cambia allá, cambiar acá. */
export const AGENT_BINDINGS: Partial<Record<BlockType, Record<string, string>>> = {
  'agent-hero': {
    name: 'user.full_name', headline: 'headline', bio: 'bio',
    photo_url: 'user.photo_url', background_image_url: 'cover_image_url',
  },
  'agent-credentials': {
    license: 'license', years_experience: 'years_experience',
    zones: 'zones', specialties: 'specialties', stats: 'stats',
  },
  'cta-whatsapp': { phone: 'whatsapp' },
  'footer': { phone: 'whatsapp', instagram: 'instagram', agency_registration: 'license' },
}

export function isBoundField(blockType: BlockType, field: string, binding?: string): boolean {
  if (binding !== 'agent_profile') return false
  return Boolean(AGENT_BINDINGS[blockType]?.[field])
}
```

- [ ] **Step 2: Bloquear esos campos en el inspector**

En `InspectorPanel.tsx`, para cada campo del bloque seleccionado, llamar
`isBoundField(block.type, field, block.binding)`. Si devuelve `true`:
- renderizar el input `disabled`,
- mostrar debajo, con `Text size="xs" tone="muted"`, el aviso: **"Se sincroniza con tu perfil público. Editalo en Perfil."**,
- incluir un link a `/perfil`.

> **Excepción de design system que aplica acá — leer antes de tocar el archivo.**
> `landings/InspectorPanel.tsx` está **explícitamente listado como excepción** en
> la regla 9 de `doc/ds-visual-rules.md`: es un panel de edición denso (columna
> de ~340px) donde `Input`/`Field` del DS (densidad `px-4 py-2.5`) rompen el
> layout compacto, y por eso usa inputs a mano más chicos con su propia
> abstracción local. **No "corrijas" esos inputs a `Input` del DS** — romperías
> el panel y estarías violando la regla, no cumpliéndola. Seguí la abstracción
> local que ya exista en el archivo (`inputClass` o similar) y mantené la
> consistencia con los campos vecinos.
>
> La misma excepción cubre `landings/ImageUpload.tsx` y `landings/AIChatPanel.tsx`,
> que comparten esa columna. **No** aplica a `PerfilPublicoForm` (Task 12), que
> es un formulario de página completa y sí va con `Input`/`Field` del DS.

- [ ] **Step 3: Verificar que la IA no pisa los campos bindeados**

El endpoint `POST /landings/:id/edit-block` de api-ai reescribe el `data` del
bloque. Confirmar en `packages/api-ai/src/index.ts` que, tras la edición con
IA, los campos bindeados se restauran desde el bloque original (o que el bloque
se vuelve a pasar por `resolveAgentBindings` en la lectura pública, que ya es
el caso). Como el binding se resuelve **en lectura**, un valor pisado por la IA
igual queda sobreescrito por el perfil en la página pública — verificar que es
así y dejarlo anotado en el código con un comentario, sin agregar lógica nueva.

- [ ] **Step 4: Alta de la landing personal**

En `NewLandingModal.tsx`, comprobar si la lista de templates que trae
`GET /landing-templates` ya incluye `tpl_agent_profile_v1`. Si el modal filtra
por `kind` con un union hardcodeado (`'lead_capture' | 'property'`), agregar
`'agent_profile'` con el label **"Mi perfil de agente"**. Si no filtra, el
template aparece solo y este paso es solo la verificación.

- [ ] **Step 5: Verificar**

Run: `cd vendepro-frontend && npm test && npx next build`
Expected: PASS + build OK.

Luego, en local: abrir el editor de una landing creada con el template de
agente, seleccionar el bloque `agent-hero` y confirmar que nombre, headline,
bio y foto están deshabilitados con el aviso, mientras que los CTAs y el color
de acento siguen editables.

- [ ] **Step 5b: Pasar la revisión de UI**

Correr el skill `ui-ux-pro-max` sobre el panel modificado y aplicar lo que
devuelva, **respetando la excepción de densidad del Step 2** (si la revisión
sugiere migrar los inputs del inspector al `Input` del DS, esa sugerencia no
aplica acá — dejalo anotado y seguí). Es requisito del proyecto para todo
trabajo de UI.

- [ ] **Step 6: Commit**

```bash
git add vendepro-frontend/src/lib/landings/agent-bindings.ts vendepro-frontend/src/components/landings/InspectorPanel.tsx vendepro-frontend/src/components/landings/NewLandingModal.tsx
git commit -m "feat(landings-agente): campos bindeados read-only en el editor"
```

---

### Task 14: Verificación end-to-end y KB

**Files:**
- Modify: `vendepro-kb/03-Dominios/Dominio-Landings.md`
- Modify: `vendepro-kb/03-Dominios/Dominio-Usuarios-Org.md`
- Modify: `vendepro-kb/08-Producto/Roadmap-estado-implementacion.md` (líneas 19 y 129-136)
- Modify: `vendepro-kb/02-Arquitectura/DB-overview.md`, `API-public.md`, `API-admin.md`, `Frontend-rutas.md`, `vendepro-kb/00-Indice/MOC.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la KB al día. **El feature no está terminado hasta este task** (regla #1 del proyecto).

- [ ] **Step 1: Correr las dos suites completas**

Run: `cd vendepro-backend && npm test`
Expected: PASS, sin tests salteados. Copiar el conteo real en el commit.

Run: `cd vendepro-frontend && npm test && npx next build`
Expected: PASS + build OK.

- [ ] **Step 2: Verificación end-to-end de las 5 puertas**

Con todo levantado en local:

1. Perfil cargado + landing publicada → `/a/<org>/<slug>` renderiza con datos del perfil, branding de la org y CTA de WhatsApp con el número del perfil.
2. Cambiar la bio en `/perfil`, esperar el revalidate y recargar → el texto cambia **sin haber tocado la landing**. Esta es la prueba del binding vivo.
3. `is_public = 0` → 404.
4. Landing en `draft` → 404.
5. Submit del formulario → se crea el lead asignado al agente y aparece un `pageview` en `landing_events`:
   `npx wrangler d1 execute vendepro-db --local --command "SELECT event_type, COUNT(*) FROM landing_events GROUP BY event_type;"`

- [ ] **Step 3: Actualizar la KB**

- `Dominio-Landings.md`: kind `agent_profile`, los 4 bloques nuevos (pasan de 8 a 12), el campo `binding`, la invariante de lead-form por kind, y la URL `/a/<org>/<agente>`.
- `Dominio-Usuarios-Org.md`: tabla `agent_profiles` y sus campos.
- `Roadmap-estado-implementacion.md`: Feature 07 de 🔴 a 🟢 en la tabla (línea 19) y en la sección (129-136), aclarando que **propiedades en vivo, testimonios y descargables quedan en Fase 2**. Separar el Feature 07 del 08, que sigue 🔴.
- `DB-overview.md`, `API-public.md`, `API-admin.md`, `Frontend-rutas.md`, `MOC.md`: las entradas nuevas.

- [ ] **Step 4: Commit**

```bash
git add vendepro-kb/
git commit -m "docs(kb): landings de agente (Feature 07) — dominio, DB, rutas y estado"
```

---

## Notas de ejecución

- **Orden**: las tasks 1→10 son backend y tienen dependencias estrictas. Las 11, 12 y 13 son frontend: la 11 depende de la 9 (endpoints) y de la 5 (tipos de bloque); la 12 depende de la 9; la 13 depende de la 11. La 14 cierra.
- **Paralelizable**: nada dentro del backend. Una vez listas la Task 9 y la 11, las tasks 12 y 13 pueden ir en paralelo.
- **El paso más fácil de olvidar** es el `PUBLIC_PREFIXES` del middleware (Task 11, Step 6). Si la landing redirige a `/login`, empezar por ahí.
- **Deploy**: por GitHub Actions o Cloudflare Dashboard. Nunca desde la terminal.
- Las migraciones 048 y 049 hay que aplicarlas también en remoto (`wrangler d1 migrations apply vendepro-db --remote`) desde el canal que corresponda, no desde la terminal de desarrollo.
