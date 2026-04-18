# Landings con IA — Plan Fase A (Backend)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar todo el backend del feature de landings (dominio, ports, use-cases, adapters D1, extensión de Groq, rutas en api-crm/api-ai/api-public) respetando la arquitectura hexagonal existente. Al terminar esta fase, la API está completa y se puede probar por curl/tests — aún sin UI.

**Architecture:** Todo el trabajo vive en `vendepro-backend/`. Domain y application en `@vendepro/core` sin dependencias de infra. D1 adapters y extensión de Groq en `@vendepro/infrastructure`. Se suman rutas a 3 workers existentes (`api-crm`, `api-ai`, `api-public`); ningún worker nuevo. Shape-guard de bloques con Zod (se agrega como dep del core).

**Tech Stack:** TypeScript 5.8, Hono, Cloudflare Workers + D1, Vitest 3.2, `@cloudflare/vitest-pool-workers` (Miniflare), Zod (nuevo), Groq (`llama-3.3-70b-versatile`).

**Spec de referencia:** `docs/superpowers/specs/2026-04-18-landings-design.md`

**Fases fuera de este plan:**
- Fase B (editor frontend) — plan separado.
- Fase C (público + analytics) — plan separado.
- Infra CF (wildcard DNS, Pages custom domain, secret Groq) — checklist manual en el spec, ejecutado por GHA o dashboard.

**Árbol de archivos afectados** (solo nuevos/modificados):

```
vendepro-backend/
  migrations_v2/
    010_landings.sql                                        (NEW)
    011_landings_seed_templates.sql                         (NEW)
  packages/
    core/
      package.json                                          (MOD — add zod)
      src/domain/value-objects/
        landing-status.ts                                   (NEW)
        landing-slug.ts                                     (NEW)
        block-schemas.ts                                    (NEW — Zod de los 8 bloques)
        index.ts                                            (MOD — exports)
      src/domain/entities/
        landing.ts                                          (NEW)
        landing-template.ts                                 (NEW)
        landing-version.ts                                  (NEW)
        landing-event.ts                                    (NEW)
        index.ts                                            (MOD — exports)
      src/domain/rules/
        landing-rules.ts                                    (NEW)
      src/application/ports/repositories/
        landing-repository.ts                               (NEW)
        landing-template-repository.ts                      (NEW)
        landing-version-repository.ts                       (NEW)
        landing-event-repository.ts                         (NEW)
        index.ts                                            (MOD — exports)
      src/application/ports/services/
        ai-service.ts                                       (MOD — + editLandingBlock/Global)
      src/application/use-cases/landings/
        create-landing-from-template.ts                     (NEW)
        update-landing-blocks.ts                            (NEW)
        reorder-blocks.ts                                   (NEW)
        add-block.ts                                        (NEW)
        remove-block.ts                                     (NEW)
        toggle-block-visibility.ts                          (NEW)
        edit-block-with-ai.ts                               (NEW)
        request-publish.ts                                  (NEW)
        publish-landing.ts                                  (NEW)
        reject-publish-request.ts                           (NEW)
        archive-landing.ts                                  (NEW)
        unarchive-landing.ts                                (NEW)
        rollback-landing.ts                                 (NEW)
        record-landing-event.ts                             (NEW)
        submit-lead-from-landing.ts                         (NEW)
        list-templates.ts                                   (NEW)
        create-template.ts                                  (NEW)
        update-template.ts                                  (NEW)
        get-public-landing.ts                               (NEW)
        get-landing-analytics.ts                            (NEW)
        list-landings.ts                                    (NEW)
        get-landing.ts                                      (NEW)
        update-landing-metadata.ts                          (NEW)
        index.ts                                            (NEW)
      src/index.ts                                          (MOD — re-export landings)
      tests/domain/
        landing-status.test.ts                              (NEW)
        landing-slug.test.ts                                (NEW)
        block-schemas.test.ts                               (NEW)
        landing.test.ts                                     (NEW)
        landing-rules.test.ts                               (NEW)
      tests/use-cases/landings/
        create-landing-from-template.test.ts                (NEW)
        update-landing-blocks.test.ts                       (NEW)
        edit-block-with-ai.test.ts                          (NEW)
        request-publish.test.ts                             (NEW)
        publish-landing.test.ts                             (NEW)
        rollback-landing.test.ts                            (NEW)
        submit-lead-from-landing.test.ts                    (NEW)
        get-public-landing.test.ts                          (NEW)
        get-landing-analytics.test.ts                       (NEW)
    infrastructure/
      src/repositories/
        d1-landing-repository.ts                            (NEW)
        d1-landing-template-repository.ts                   (NEW)
        d1-landing-version-repository.ts                    (NEW)
        d1-landing-event-repository.ts                      (NEW)
        index.ts                                            (MOD — exports)
      src/services/
        groq-ai-service.ts                                  (MOD — + editLandingBlock/Global)
      tests/repositories/
        d1-landing-repository.test.ts                       (NEW)
        d1-landing-event-repository.test.ts                 (NEW)
      tests/services/
        groq-ai-service.landings.test.ts                    (NEW)
    api-crm/
      src/index.ts                                          (MOD — + landings routes)
    api-ai/
      src/index.ts                                          (MOD — + edit-block route)
    api-public/
      src/index.ts                                          (MOD — + /l/:slug routes)
    schema.sql                                              (MOD — add 4 tables for test env)
```

---

## Task 1: Install Zod in @vendepro/core

**Files:**
- Modify: `vendepro-backend/packages/core/package.json`

- [ ] **Step 1: Add zod dependency**

Edit `vendepro-backend/packages/core/package.json`. Add `"zod": "^3.23.8"` to a new `dependencies` object (the package currently has no runtime deps — only devDependencies):

```json
{
  "name": "@vendepro/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./domain": "./src/domain/index.ts",
    "./application": "./src/application/index.ts",
    "./shared": "./src/shared/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20260317.1",
    "typescript": "^5.8.3",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 2: Install**

Run from `vendepro-backend/`: `npm install`
Expected: zod added without errors.

- [ ] **Step 3: Verify typecheck still passes**

Run from `vendepro-backend/`: `npm run typecheck -- --filter @vendepro/core`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add vendepro-backend/packages/core/package.json vendepro-backend/package-lock.json
git commit -m "chore(core): add zod dependency for landing block schemas"
```

---

## Task 2: Migration 010 — landings tables

**Files:**
- Create: `vendepro-backend/migrations_v2/010_landings.sql`

- [ ] **Step 1: Create migration file**

Create `vendepro-backend/migrations_v2/010_landings.sql`:

```sql
-- 010_landings.sql
-- Tablas para el feature de Landings con IA.
-- Las consume api-crm (/landings), api-ai (/landings/:id/edit-block) y api-public (/l/:fullSlug).

CREATE TABLE IF NOT EXISTS landing_templates (
  id TEXT PRIMARY KEY,
  org_id TEXT,                        -- NULL = global, disponible para todas las orgs
  name TEXT NOT NULL,
  kind TEXT NOT NULL,                 -- 'lead_capture' | 'property'
  description TEXT,
  preview_image_url TEXT,
  blocks_json TEXT NOT NULL,          -- JSON seed de bloques
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_landing_templates_org ON landing_templates(org_id, active, sort_order);

CREATE TABLE IF NOT EXISTS landings (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  template_id TEXT NOT NULL REFERENCES landing_templates(id),
  kind TEXT NOT NULL,                 -- 'lead_capture' | 'property'
  slug_base TEXT NOT NULL,
  slug_suffix TEXT NOT NULL,
  full_slug TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft'|'pending_review'|'published'|'archived'
  blocks_json TEXT NOT NULL,
  brand_voice TEXT,
  lead_rules_json TEXT,
  seo_title TEXT,
  seo_description TEXT,
  og_image_url TEXT,
  published_version_id TEXT,
  published_at TEXT,
  published_by TEXT,
  last_review_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_landings_org ON landings(org_id, status);
CREATE INDEX IF NOT EXISTS idx_landings_agent ON landings(org_id, agent_id);

CREATE TABLE IF NOT EXISTS landing_versions (
  id TEXT PRIMARY KEY,
  landing_id TEXT NOT NULL REFERENCES landings(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  blocks_json TEXT NOT NULL,
  label TEXT NOT NULL,                -- 'auto-save' | 'manual-save' | 'ai-edit' | 'publish'
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_landing_versions_landing ON landing_versions(landing_id, version_number DESC);

CREATE TABLE IF NOT EXISTS landing_events (
  id TEXT PRIMARY KEY,
  landing_id TEXT NOT NULL REFERENCES landings(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,                 -- denormalizado para query rápida
  event_type TEXT NOT NULL,           -- 'pageview'|'cta_click'|'form_start'|'form_submit'
  visitor_id TEXT,
  session_id TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  referrer TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_landing_events_landing ON landing_events(landing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_landing_events_visitor ON landing_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_landing_events_slug_type ON landing_events(slug, event_type);
```

- [ ] **Step 2: Apply to schema.sql (usado por tests Miniflare)**

Append the same SQL (sin los `CREATE INDEX IF NOT EXISTS` — son idempotentes pero ya están arriba) al archivo `vendepro-backend/schema.sql` si existe ese archivo. Si no existe, no hacer nada (la test env lee desde migrations_v2 directo).

Verificar con: `ls vendepro-backend/schema.sql 2>/dev/null && echo EXISTS || echo NO`

Si EXISTS: append las 4 `CREATE TABLE` al final del archivo.

- [ ] **Step 3: Commit**

```bash
git add vendepro-backend/migrations_v2/010_landings.sql vendepro-backend/schema.sql
git commit -m "feat(db): add landings, landing_templates, landing_versions, landing_events tables"
```

---

## Task 3: Migration 011 — seed 3 templates globales

**Files:**
- Create: `vendepro-backend/migrations_v2/011_landings_seed_templates.sql`

- [ ] **Step 1: Create seed migration**

Create `vendepro-backend/migrations_v2/011_landings_seed_templates.sql`:

```sql
-- 011_landings_seed_templates.sql
-- Seeds 3 templates globales (org_id = NULL) para arrancar.

INSERT INTO landing_templates (id, org_id, name, kind, description, preview_image_url, blocks_json, active, sort_order) VALUES
('tpl_emprendimiento_premium', NULL, 'Emprendimiento Premium', 'property',
 'Landing rica para emprendimientos: hero con foto, amenities, gallery y formulario.',
 NULL,
 '{"blocks":[
   {"id":"b_hero","type":"hero","visible":true,"data":{"eyebrow":"Palermo Soho · CABA","title":"Viví en el corazón de Palermo","subtitle":"40 unidades · entrega 2027","cta":{"label":"Agendar visita","href":"#form"},"background_image_url":"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600","overlay_opacity":0.55}},
   {"id":"b_amenities","type":"amenities-chips","visible":true,"data":{"title":"Amenities","chips":[{"emoji":"🏊","label":"Piscina"},{"emoji":"🏋️","label":"Gym"},{"emoji":"💼","label":"Coworking"},{"emoji":"🌳","label":"Solarium"}]}},
   {"id":"b_gallery","type":"gallery","visible":true,"data":{"layout":"mosaic","images":[{"url":"https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200","alt":"Living","source":"external"}]}},
   {"id":"b_form","type":"lead-form","visible":true,"data":{"title":"Consultanos sin compromiso","subtitle":"Te contactamos en menos de 24 hs.","fields":[{"key":"name","label":"Nombre","required":true},{"key":"phone","label":"Teléfono","required":true}],"submit_label":"Quiero más info","success_message":"¡Gracias! Te contactamos en breve."}},
   {"id":"b_footer","type":"footer","visible":true,"data":{"agency_name":"Marcela Genta Operaciones Inmobiliarias","agency_registration":"Matr. 5123"}}
 ]}',
 1, 1),

('tpl_propiedad_clasica', NULL, 'Propiedad clásica', 'property',
 'Landing simple para una propiedad con hero split, beneficios y formulario.',
 NULL,
 '{"blocks":[
   {"id":"b_hero","type":"hero-split","visible":true,"data":{"title":"Departamento 3 amb · Recoleta","subtitle":"98 m² · cochera · amenities","cta":{"label":"Ver más","href":"#form"},"media_url":"https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200","media_side":"right","accent_color":"pink"}},
   {"id":"b_benefits","type":"benefits-list","visible":true,"data":{"title":"Por qué este depto","items":[{"title":"Ubicación prime","description":"A 2 cuadras del subte D."},{"title":"Cochera fija","description":"En subsuelo del edificio."},{"title":"Amenities completos","description":"Gym, SUM, laundry."}]}},
   {"id":"b_form","type":"lead-form","visible":true,"data":{"title":"Pedir más información","fields":[{"key":"name","label":"Nombre","required":true},{"key":"phone","label":"Teléfono","required":true},{"key":"email","label":"Email","required":false}],"submit_label":"Contactar","success_message":"Recibimos tu consulta. Te contactamos a la brevedad."}},
   {"id":"b_footer","type":"footer","visible":true,"data":{}}
 ]}',
 1, 2),

('tpl_captacion_rapida', NULL, 'Captación rápida', 'lead_capture',
 'Landing agresiva para captación: tasación gratis en 24 hs.',
 NULL,
 '{"blocks":[
   {"id":"b_hero","type":"hero-split","visible":true,"data":{"title":"¿Querés vender tu propiedad?","subtitle":"Te decimos cuánto vale en 24 hs. Sin compromiso, sin letras chicas.","cta":{"label":"Pedir tasación gratis","href":"#form"},"media_url":"https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=1200","media_side":"right","accent_color":"pink"}},
   {"id":"b_benefits","type":"benefits-list","visible":true,"data":{"items":[{"title":"Tasación en 24 hs","description":"Respuesta rápida de un experto."},{"title":"Sin compromiso","description":"No hace falta firmar nada."},{"title":"15+ años en Buenos Aires","description":"Conocemos el mercado local."}]}},
   {"id":"b_form","type":"lead-form","visible":true,"data":{"title":"Pedir tasación","fields":[{"key":"name","label":"Nombre","required":true},{"key":"phone","label":"Teléfono","required":true},{"key":"address","label":"Dirección de la propiedad","required":true}],"submit_label":"Pedir tasación","success_message":"Gracias. Un asesor te contacta en menos de 24 hs."}},
   {"id":"b_footer","type":"footer","visible":true,"data":{"disclaimer":"Los datos son tratados con confidencialidad."}}
 ]}',
 1, 3);
```

- [ ] **Step 2: Commit**

```bash
git add vendepro-backend/migrations_v2/011_landings_seed_templates.sql
git commit -m "feat(db): seed 3 landing templates globales"
```

---

## Task 4: Block schemas (Zod)

**Files:**
- Create: `vendepro-backend/packages/core/src/domain/value-objects/block-schemas.ts`
- Test: `vendepro-backend/packages/core/tests/domain/block-schemas.test.ts`

- [ ] **Step 1: Write failing test**

Create `vendepro-backend/packages/core/tests/domain/block-schemas.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { BLOCK_SCHEMAS, BlockSchema, validateBlock } from '../../src/domain/value-objects/block-schemas'

describe('block-schemas', () => {
  it('valida un hero válido', () => {
    const b = { id: 'x', type: 'hero', visible: true, data: { title: 'Hola', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 } }
    expect(validateBlock(b).success).toBe(true)
  })

  it('rechaza hero sin title', () => {
    const b = { id: 'x', type: 'hero', visible: true, data: { background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 } }
    expect(validateBlock(b).success).toBe(false)
  })

  it('rechaza overlay_opacity fuera de [0,1]', () => {
    const b = { id: 'x', type: 'hero', visible: true, data: { title: 't', background_image_url: 'https://x/y.jpg', overlay_opacity: 2 } }
    expect(validateBlock(b).success).toBe(false)
  })

  it('valida lead-form con fields name y phone', () => {
    const b = { id: 'f', type: 'lead-form', visible: true, data: {
      title: 'Contacto',
      fields: [
        { key: 'name', label: 'Nombre', required: true },
        { key: 'phone', label: 'Tel', required: true },
      ],
      submit_label: 'Enviar',
      success_message: 'Gracias',
    }}
    expect(validateBlock(b).success).toBe(true)
  })

  it('rechaza lead-form sin phone', () => {
    const b = { id: 'f', type: 'lead-form', visible: true, data: {
      title: 'Contacto',
      fields: [{ key: 'name', label: 'Nombre', required: true }],
      submit_label: 'Enviar',
      success_message: 'Gracias',
    }}
    expect(validateBlock(b).success).toBe(false)
  })

  it('valida gallery con 1 imagen', () => {
    const b = { id: 'g', type: 'gallery', visible: true, data: { layout: 'grid', images: [{ url: 'https://x/1.jpg', source: 'external' }] } }
    expect(validateBlock(b).success).toBe(true)
  })

  it('rechaza gallery vacío', () => {
    const b = { id: 'g', type: 'gallery', visible: true, data: { layout: 'grid', images: [] } }
    expect(validateBlock(b).success).toBe(false)
  })

  it('rechaza block con type desconocido', () => {
    const b = { id: 'x', type: 'unknown', visible: true, data: {} }
    expect(validateBlock(b).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test (fails — file doesn't exist)**

Run: `npm test -- --filter @vendepro/core --run tests/domain/block-schemas.test.ts`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement schemas**

Create `vendepro-backend/packages/core/src/domain/value-objects/block-schemas.ts`:

```typescript
import { z } from 'zod'

// === Per-type data schemas ===

const HeroDataSchema = z.object({
  eyebrow: z.string().max(120).optional(),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).optional(),
  cta: z.object({ label: z.string().min(1).max(40), href: z.string().min(1) }).optional(),
  background_image_url: z.string().url(),
  overlay_opacity: z.number().min(0).max(1),
})

const HeroSplitDataSchema = z.object({
  eyebrow: z.string().max(120).optional(),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).optional(),
  cta: z.object({ label: z.string().min(1).max(40), href: z.string().min(1) }).optional(),
  media_url: z.string().url(),
  media_side: z.enum(['left', 'right']),
  accent_color: z.enum(['pink', 'orange', 'dark']),
})

const FeaturesGridDataSchema = z.object({
  title: z.string().max(200).optional(),
  subtitle: z.string().max(300).optional(),
  columns: z.union([z.literal(3), z.literal(4)]),
  items: z.array(z.object({
    icon: z.string().min(1).max(40),
    title: z.string().min(1).max(120),
    text: z.string().min(1).max(400),
  })).min(3).max(8),
})

const AmenitiesChipsDataSchema = z.object({
  title: z.string().max(120).optional(),
  chips: z.array(z.object({
    emoji: z.string().max(4).optional(),
    label: z.string().min(1).max(60),
  })).min(3).max(16),
})

const GalleryDataSchema = z.object({
  layout: z.enum(['mosaic', 'grid', 'carousel']),
  images: z.array(z.object({
    url: z.string().url(),
    alt: z.string().max(200).optional(),
    source: z.enum(['upload', 'external', 'property']),
    property_id: z.string().optional(),
  })).min(1).max(24),
})

const BenefitsListDataSchema = z.object({
  title: z.string().max(200).optional(),
  items: z.array(z.object({
    title: z.string().min(1).max(120),
    description: z.string().max(400).optional(),
  })).min(2).max(8),
})

const LeadFormDataSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).optional(),
  fields: z.array(z.object({
    key: z.enum(['name', 'phone', 'email', 'address', 'message']),
    label: z.string().min(1).max(60),
    required: z.boolean(),
  })).refine((fields) => {
    const keys = fields.map(f => f.key)
    return keys.includes('name') && keys.includes('phone')
  }, { message: 'lead-form debe incluir siempre los campos `name` y `phone`' }),
  submit_label: z.string().min(1).max(40),
  success_message: z.string().min(1).max(200),
  privacy_note: z.string().max(300).optional(),
})

const FooterDataSchema = z.object({
  agency_name: z.string().max(120).optional(),
  agency_registration: z.string().max(80).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional().or(z.literal('')),
  whatsapp: z.string().max(40).optional(),
  instagram: z.string().max(60).optional(),
  disclaimer: z.string().max(500).optional(),
})

// === Registry ===

export const BLOCK_TYPES = [
  'hero',
  'hero-split',
  'features-grid',
  'amenities-chips',
  'gallery',
  'benefits-list',
  'lead-form',
  'footer',
] as const

export type BlockType = typeof BLOCK_TYPES[number]

export const BLOCK_DATA_SCHEMAS: Record<BlockType, z.ZodTypeAny> = {
  'hero': HeroDataSchema,
  'hero-split': HeroSplitDataSchema,
  'features-grid': FeaturesGridDataSchema,
  'amenities-chips': AmenitiesChipsDataSchema,
  'gallery': GalleryDataSchema,
  'benefits-list': BenefitsListDataSchema,
  'lead-form': LeadFormDataSchema,
  'footer': FooterDataSchema,
}

// === Envelope schemas ===

export const BlockSchema = z.discriminatedUnion('type', BLOCK_TYPES.map((t) =>
  z.object({
    id: z.string().min(1),
    type: z.literal(t),
    visible: z.boolean(),
    data: BLOCK_DATA_SCHEMAS[t],
  })
) as any)

export type Block = z.infer<typeof BlockSchema>

export const BlocksArraySchema = z.array(BlockSchema).min(1)

export const BLOCK_SCHEMAS = BLOCK_DATA_SCHEMAS // alias para uso externo

// === Helpers ===

export function validateBlock(input: unknown): { success: true; data: Block } | { success: false; error: string } {
  const parsed = BlockSchema.safeParse(input)
  if (parsed.success) return { success: true, data: parsed.data }
  return { success: false, error: parsed.error.message }
}

export function validateBlocks(input: unknown): { success: true; data: Block[] } | { success: false; error: string } {
  const parsed = BlocksArraySchema.safeParse(input)
  if (parsed.success) return { success: true, data: parsed.data }
  return { success: false, error: parsed.error.message }
}

export function isLeadFormBlock(block: Block): boolean {
  return block.type === 'lead-form'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --filter @vendepro/core --run tests/domain/block-schemas.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add vendepro-backend/packages/core/src/domain/value-objects/block-schemas.ts vendepro-backend/packages/core/tests/domain/block-schemas.test.ts
git commit -m "feat(core): add Zod block schemas for landings (8 block types)"
```

---

## Task 5: Value objects — LandingStatus + LandingSlug

**Files:**
- Create: `vendepro-backend/packages/core/src/domain/value-objects/landing-status.ts`
- Create: `vendepro-backend/packages/core/src/domain/value-objects/landing-slug.ts`
- Test: `vendepro-backend/packages/core/tests/domain/landing-status.test.ts`
- Test: `vendepro-backend/packages/core/tests/domain/landing-slug.test.ts`

- [ ] **Step 1: Write failing tests for LandingStatus**

Create `vendepro-backend/packages/core/tests/domain/landing-status.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { LandingStatus, LANDING_STATUSES } from '../../src/domain/value-objects/landing-status'

describe('LandingStatus', () => {
  it('acepta los 4 estados válidos', () => {
    for (const s of LANDING_STATUSES) {
      expect(LandingStatus.create(s).value).toBe(s)
    }
  })

  it('rechaza estado inválido', () => {
    expect(() => LandingStatus.create('foobar')).toThrow()
  })

  it('draft → pending_review | archived permitido', () => {
    const s = LandingStatus.create('draft')
    expect(s.canTransitionTo('pending_review')).toBe(true)
    expect(s.canTransitionTo('archived')).toBe(true)
    expect(s.canTransitionTo('published')).toBe(false)
  })

  it('pending_review → published | draft permitido', () => {
    const s = LandingStatus.create('pending_review')
    expect(s.canTransitionTo('published')).toBe(true)
    expect(s.canTransitionTo('draft')).toBe(true)
    expect(s.canTransitionTo('archived')).toBe(false)
  })

  it('published → archived | draft permitido', () => {
    const s = LandingStatus.create('published')
    expect(s.canTransitionTo('archived')).toBe(true)
    expect(s.canTransitionTo('draft')).toBe(true)
  })

  it('archived → draft permitido (unarchive)', () => {
    const s = LandingStatus.create('archived')
    expect(s.canTransitionTo('draft')).toBe(true)
    expect(s.canTransitionTo('published')).toBe(false)
  })

  it('transitionTo devuelve nuevo VO con estado final', () => {
    const s = LandingStatus.create('draft').transitionTo('pending_review')
    expect(s.value).toBe('pending_review')
  })

  it('transitionTo lanza si transición inválida', () => {
    expect(() => LandingStatus.create('draft').transitionTo('published')).toThrow()
  })
})
```

- [ ] **Step 2: Implement LandingStatus**

Create `vendepro-backend/packages/core/src/domain/value-objects/landing-status.ts`:

```typescript
import { ValidationError } from '../errors/validation-error'

export const LANDING_STATUSES = ['draft', 'pending_review', 'published', 'archived'] as const
export type LandingStatusValue = typeof LANDING_STATUSES[number]

const TRANSITIONS: Record<LandingStatusValue, LandingStatusValue[]> = {
  draft:          ['pending_review', 'archived'],
  pending_review: ['published', 'draft'],           // published = admin aprueba; draft = admin rechaza
  published:      ['archived', 'draft'],            // draft = volver a editar
  archived:       ['draft'],                        // unarchive
}

export class LandingStatus {
  private constructor(readonly value: LandingStatusValue) {}

  static create(value: string): LandingStatus {
    if (!LANDING_STATUSES.includes(value as LandingStatusValue)) {
      throw new ValidationError(`Status inválido: "${value}". Permitidos: ${LANDING_STATUSES.join(', ')}`)
    }
    return new LandingStatus(value as LandingStatusValue)
  }

  canTransitionTo(next: LandingStatusValue): boolean {
    return TRANSITIONS[this.value].includes(next)
  }

  transitionTo(next: LandingStatusValue): LandingStatus {
    if (!this.canTransitionTo(next)) {
      throw new ValidationError(
        `Transición inválida de "${this.value}" a "${next}". Permitidas: ${TRANSITIONS[this.value].join(', ') || 'ninguna'}`
      )
    }
    return new LandingStatus(next)
  }

  isPublic(): boolean { return this.value === 'published' }
  equals(other: LandingStatus): boolean { return this.value === other.value }
  toString(): string { return this.value }
}
```

- [ ] **Step 3: Run status tests — expect PASS**

Run: `npm test -- --filter @vendepro/core --run tests/domain/landing-status.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 4: Write failing tests for LandingSlug**

Create `vendepro-backend/packages/core/tests/domain/landing-slug.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { LandingSlug, generateSlugSuffix, SLUG_SUFFIX_ALPHABET } from '../../src/domain/value-objects/landing-slug'

describe('LandingSlug', () => {
  it('crea a partir de slug_base + slug_suffix válidos', () => {
    const s = LandingSlug.create({ slug_base: 'palermo-soho', slug_suffix: 'k7xm3' })
    expect(s.full).toBe('palermo-soho-k7xm3')
  })

  it('rechaza slug_base con mayúsculas', () => {
    expect(() => LandingSlug.create({ slug_base: 'Palermo', slug_suffix: 'k7xm3' })).toThrow()
  })

  it('rechaza slug_base con espacios', () => {
    expect(() => LandingSlug.create({ slug_base: 'palermo soho', slug_suffix: 'k7xm3' })).toThrow()
  })

  it('rechaza slug_base demasiado corto', () => {
    expect(() => LandingSlug.create({ slug_base: 'ab', slug_suffix: 'k7xm3' })).toThrow()
  })

  it('rechaza slug_base demasiado largo', () => {
    expect(() => LandingSlug.create({ slug_base: 'a'.repeat(61), slug_suffix: 'k7xm3' })).toThrow()
  })

  it('rechaza slug_suffix con longitud distinta de 5', () => {
    expect(() => LandingSlug.create({ slug_base: 'palermo', slug_suffix: 'abcd' })).toThrow()
    expect(() => LandingSlug.create({ slug_base: 'palermo', slug_suffix: 'abcdef' })).toThrow()
  })

  it('rechaza slug_suffix con caracteres no permitidos', () => {
    expect(() => LandingSlug.create({ slug_base: 'palermo', slug_suffix: 'ABC12' })).toThrow()
  })
})

describe('generateSlugSuffix', () => {
  it('devuelve string de 5 chars del alfabeto', () => {
    const s = generateSlugSuffix()
    expect(s).toMatch(new RegExp(`^[${SLUG_SUFFIX_ALPHABET}]{5}$`))
  })

  it('es aleatorio (10 llamadas generan al menos 5 distintos)', () => {
    const set = new Set(Array.from({ length: 10 }, () => generateSlugSuffix()))
    expect(set.size).toBeGreaterThanOrEqual(5)
  })
})
```

- [ ] **Step 5: Implement LandingSlug**

Create `vendepro-backend/packages/core/src/domain/value-objects/landing-slug.ts`:

```typescript
import { ValidationError } from '../errors/validation-error'

// Alfabeto sin caracteres ambiguos (sin 0/o/1/l/i)
export const SLUG_SUFFIX_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const SLUG_BASE_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/
const SLUG_SUFFIX_LENGTH = 5
const SUFFIX_RE = new RegExp(`^[${SLUG_SUFFIX_ALPHABET}]{${SLUG_SUFFIX_LENGTH}}$`)

export interface LandingSlugProps {
  slug_base: string
  slug_suffix: string
}

export class LandingSlug {
  private constructor(
    readonly slug_base: string,
    readonly slug_suffix: string,
  ) {}

  static create(props: LandingSlugProps): LandingSlug {
    const { slug_base, slug_suffix } = props
    if (!slug_base || slug_base.length < 3 || slug_base.length > 60) {
      throw new ValidationError('slug_base debe tener entre 3 y 60 caracteres')
    }
    if (!SLUG_BASE_RE.test(slug_base)) {
      throw new ValidationError('slug_base solo acepta a-z, 0-9 y guiones (no puede empezar/terminar con guión)')
    }
    if (!SUFFIX_RE.test(slug_suffix)) {
      throw new ValidationError(`slug_suffix inválido: debe ser ${SLUG_SUFFIX_LENGTH} chars del alfabeto permitido`)
    }
    return new LandingSlug(slug_base, slug_suffix)
  }

  get full(): string {
    return `${this.slug_base}-${this.slug_suffix}`
  }

  toString(): string {
    return this.full
  }
}

export function generateSlugSuffix(): string {
  const bytes = new Uint8Array(SLUG_SUFFIX_LENGTH)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < SLUG_SUFFIX_LENGTH; i++) {
    out += SLUG_SUFFIX_ALPHABET[bytes[i] % SLUG_SUFFIX_ALPHABET.length]
  }
  return out
}
```

- [ ] **Step 6: Run slug tests — expect PASS**

Run: `npm test -- --filter @vendepro/core --run tests/domain/landing-slug.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 7: Export from index and commit**

Modify `vendepro-backend/packages/core/src/domain/value-objects/index.ts` — add:

```typescript
export * from './landing-status'
export * from './landing-slug'
export * from './block-schemas'
```

```bash
git add vendepro-backend/packages/core/src/domain/value-objects/ vendepro-backend/packages/core/tests/domain/landing-status.test.ts vendepro-backend/packages/core/tests/domain/landing-slug.test.ts
git commit -m "feat(core): add LandingStatus and LandingSlug value objects"
```

---

## Task 6: Entity — Landing

**Files:**
- Create: `vendepro-backend/packages/core/src/domain/entities/landing.ts`
- Test: `vendepro-backend/packages/core/tests/domain/landing.test.ts`

- [ ] **Step 1: Write failing test**

Create `vendepro-backend/packages/core/tests/domain/landing.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { Landing } from '../../src/domain/entities/landing'
import type { Block } from '../../src/domain/value-objects/block-schemas'

const makeHero = (id = 'b_hero'): Block => ({
  id, type: 'hero', visible: true,
  data: { title: 't', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 },
})
const makeLeadForm = (id = 'b_form'): Block => ({
  id, type: 'lead-form', visible: true,
  data: {
    title: 'Contact', fields: [
      { key: 'name', label: 'Nombre', required: true },
      { key: 'phone', label: 'Tel', required: true },
    ],
    submit_label: 'Enviar', success_message: 'ok',
  },
})

describe('Landing', () => {
  it('crea con props mínimas válidas', () => {
    const l = Landing.create({
      id: 'l1', org_id: 'o1', agent_id: 'a1', template_id: 't1',
      kind: 'property',
      slug_base: 'palermo', slug_suffix: 'k7xm3',
      blocks: [makeHero(), makeLeadForm()],
    })
    expect(l.id).toBe('l1')
    expect(l.full_slug).toBe('palermo-k7xm3')
    expect(l.status).toBe('draft')
    expect(l.blocks.length).toBe(2)
  })

  it('rechaza si no hay lead-form', () => {
    expect(() => Landing.create({
      id: 'l1', org_id: 'o1', agent_id: 'a1', template_id: 't1',
      kind: 'property',
      slug_base: 'palermo', slug_suffix: 'k7xm3',
      blocks: [makeHero()],
    })).toThrow(/lead-form/i)
  })

  it('rechaza si hay más de un lead-form', () => {
    expect(() => Landing.create({
      id: 'l1', org_id: 'o1', agent_id: 'a1', template_id: 't1',
      kind: 'property',
      slug_base: 'palermo', slug_suffix: 'k7xm3',
      blocks: [makeLeadForm('f1'), makeLeadForm('f2')],
    })).toThrow(/único/i)
  })

  it('rechaza kind inválido', () => {
    expect(() => Landing.create({
      id: 'l1', org_id: 'o1', agent_id: 'a1', template_id: 't1',
      kind: 'foobar' as any,
      slug_base: 'palermo', slug_suffix: 'k7xm3',
      blocks: [makeHero(), makeLeadForm()],
    })).toThrow(/kind/i)
  })

  it('replaceBlocks valida y actualiza', () => {
    const l = Landing.create({
      id: 'l1', org_id: 'o1', agent_id: 'a1', template_id: 't1',
      kind: 'property',
      slug_base: 'palermo', slug_suffix: 'k7xm3',
      blocks: [makeHero(), makeLeadForm()],
    })
    const next = [makeHero('new'), makeLeadForm()]
    const l2 = l.replaceBlocks(next)
    expect(l2.blocks[0].id).toBe('new')
  })

  it('transitionStatus respeta transiciones válidas', () => {
    const l = Landing.create({
      id: 'l1', org_id: 'o1', agent_id: 'a1', template_id: 't1',
      kind: 'property',
      slug_base: 'palermo', slug_suffix: 'k7xm3',
      blocks: [makeHero(), makeLeadForm()],
    })
    const l2 = l.transitionStatus('pending_review')
    expect(l2.status).toBe('pending_review')
    expect(() => l.transitionStatus('published')).toThrow()
  })

  it('markPublished setea published_version_id/at/by y status', () => {
    const l = Landing.create({
      id: 'l1', org_id: 'o1', agent_id: 'a1', template_id: 't1',
      kind: 'property',
      slug_base: 'palermo', slug_suffix: 'k7xm3',
      blocks: [makeHero(), makeLeadForm()],
    }).transitionStatus('pending_review')
    const l2 = l.markPublished({ version_id: 'v1', published_by: 'admin1', at: '2026-04-18T10:00:00Z' })
    expect(l2.status).toBe('published')
    expect(l2.published_version_id).toBe('v1')
    expect(l2.published_by).toBe('admin1')
    expect(l2.published_at).toBe('2026-04-18T10:00:00Z')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL (module not found)**

Run: `npm test -- --filter @vendepro/core --run tests/domain/landing.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement Landing entity**

Create `vendepro-backend/packages/core/src/domain/entities/landing.ts`:

```typescript
import { LandingStatus, type LandingStatusValue } from '../value-objects/landing-status'
import { LandingSlug } from '../value-objects/landing-slug'
import { validateBlocks, type Block } from '../value-objects/block-schemas'
import { ValidationError } from '../errors/validation-error'

export type LandingKind = 'lead_capture' | 'property'

export interface LeadRules {
  assigned_agent_id?: string
  tags?: string[]
  campaign?: string
  notify_channels?: Array<'email' | 'whatsapp'>
}

export interface LandingProps {
  id: string
  org_id: string
  agent_id: string
  template_id: string
  kind: LandingKind
  slug_base: string
  slug_suffix: string
  status: LandingStatusValue
  blocks: Block[]
  brand_voice: string | null
  lead_rules: LeadRules | null
  seo_title: string | null
  seo_description: string | null
  og_image_url: string | null
  published_version_id: string | null
  published_at: string | null
  published_by: string | null
  last_review_note: string | null
  created_at: string
  updated_at: string
}

export type LandingCreateInput =
  Omit<LandingProps, 'status' | 'brand_voice' | 'lead_rules' | 'seo_title' | 'seo_description' | 'og_image_url' | 'published_version_id' | 'published_at' | 'published_by' | 'last_review_note' | 'created_at' | 'updated_at'>
  & Partial<Pick<LandingProps, 'status' | 'brand_voice' | 'lead_rules' | 'seo_title' | 'seo_description' | 'og_image_url' | 'created_at' | 'updated_at'>>

const VALID_KINDS: LandingKind[] = ['lead_capture', 'property']

export class Landing {
  private constructor(private readonly props: LandingProps) {}

  static create(input: LandingCreateInput): Landing {
    if (!VALID_KINDS.includes(input.kind)) {
      throw new ValidationError(`kind inválido: "${input.kind}". Permitidos: ${VALID_KINDS.join(', ')}`)
    }
    // Valida slug (lanza si inválido)
    LandingSlug.create({ slug_base: input.slug_base, slug_suffix: input.slug_suffix })
    // Valida blocks shape
    const v = validateBlocks(input.blocks)
    if (!v.success) throw new ValidationError(`Bloques inválidos: ${v.error}`)
    // Invariante: exactamente un lead-form visible
    const leadForms = v.data.filter(b => b.type === 'lead-form')
    if (leadForms.length === 0) throw new ValidationError('La landing debe contener un bloque lead-form')
    if (leadForms.length > 1) throw new ValidationError('La landing debe tener un único bloque lead-form')

    const now = new Date().toISOString()
    return new Landing({
      id: input.id,
      org_id: input.org_id,
      agent_id: input.agent_id,
      template_id: input.template_id,
      kind: input.kind,
      slug_base: input.slug_base,
      slug_suffix: input.slug_suffix,
      status: input.status ?? 'draft',
      blocks: v.data,
      brand_voice: input.brand_voice ?? null,
      lead_rules: input.lead_rules ?? null,
      seo_title: input.seo_title ?? null,
      seo_description: input.seo_description ?? null,
      og_image_url: input.og_image_url ?? null,
      published_version_id: null,
      published_at: null,
      published_by: null,
      last_review_note: null,
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
    })
  }

  static fromPersistence(props: LandingProps): Landing {
    return new Landing(props)
  }

  // Getters
  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get agent_id() { return this.props.agent_id }
  get template_id() { return this.props.template_id }
  get kind() { return this.props.kind }
  get slug_base() { return this.props.slug_base }
  get slug_suffix() { return this.props.slug_suffix }
  get full_slug() { return `${this.props.slug_base}-${this.props.slug_suffix}` }
  get status(): LandingStatusValue { return this.props.status }
  get blocks(): Block[] { return this.props.blocks }
  get brand_voice() { return this.props.brand_voice }
  get lead_rules() { return this.props.lead_rules }
  get seo_title() { return this.props.seo_title }
  get seo_description() { return this.props.seo_description }
  get og_image_url() { return this.props.og_image_url }
  get published_version_id() { return this.props.published_version_id }
  get published_at() { return this.props.published_at }
  get published_by() { return this.props.published_by }
  get last_review_note() { return this.props.last_review_note }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  toObject(): LandingProps { return { ...this.props, blocks: [...this.props.blocks] } }

  // Mutations (return new instance — inmutabilidad)
  replaceBlocks(blocks: Block[]): Landing {
    const v = validateBlocks(blocks)
    if (!v.success) throw new ValidationError(`Bloques inválidos: ${v.error}`)
    const leadForms = v.data.filter(b => b.type === 'lead-form')
    if (leadForms.length !== 1) throw new ValidationError('La landing debe tener un único bloque lead-form')
    return new Landing({ ...this.props, blocks: v.data, updated_at: new Date().toISOString() })
  }

  transitionStatus(next: LandingStatusValue): Landing {
    const current = LandingStatus.create(this.props.status)
    const transitioned = current.transitionTo(next)
    return new Landing({ ...this.props, status: transitioned.value, updated_at: new Date().toISOString() })
  }

  markPublished(args: { version_id: string; published_by: string; at?: string }): Landing {
    const current = LandingStatus.create(this.props.status)
    const transitioned = current.transitionTo('published')
    const now = args.at ?? new Date().toISOString()
    return new Landing({
      ...this.props,
      status: transitioned.value,
      published_version_id: args.version_id,
      published_at: now,
      published_by: args.published_by,
      updated_at: now,
    })
  }

  updateMetadata(args: Partial<Pick<LandingProps, 'brand_voice' | 'lead_rules' | 'seo_title' | 'seo_description' | 'og_image_url' | 'slug_base'>>): Landing {
    const next = { ...this.props, ...args, updated_at: new Date().toISOString() }
    // Si cambió slug_base, revalidar
    if (args.slug_base !== undefined) {
      LandingSlug.create({ slug_base: next.slug_base, slug_suffix: next.slug_suffix })
    }
    return new Landing(next)
  }

  setReviewNote(note: string | null): Landing {
    return new Landing({ ...this.props, last_review_note: note, updated_at: new Date().toISOString() })
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- --filter @vendepro/core --run tests/domain/landing.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add vendepro-backend/packages/core/src/domain/entities/landing.ts vendepro-backend/packages/core/tests/domain/landing.test.ts
git commit -m "feat(core): add Landing entity with invariants and state transitions"
```

---

## Task 7: Entities — LandingTemplate, LandingVersion, LandingEvent

**Files:**
- Create: `vendepro-backend/packages/core/src/domain/entities/landing-template.ts`
- Create: `vendepro-backend/packages/core/src/domain/entities/landing-version.ts`
- Create: `vendepro-backend/packages/core/src/domain/entities/landing-event.ts`
- Modify: `vendepro-backend/packages/core/src/domain/entities/index.ts`

- [ ] **Step 1: Implement LandingTemplate**

Create `vendepro-backend/packages/core/src/domain/entities/landing-template.ts`:

```typescript
import { validateBlocks, type Block } from '../value-objects/block-schemas'
import { ValidationError } from '../errors/validation-error'
import type { LandingKind } from './landing'

export interface LandingTemplateProps {
  id: string
  org_id: string | null       // null = global
  name: string
  kind: LandingKind
  description: string | null
  preview_image_url: string | null
  blocks: Block[]
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export class LandingTemplate {
  private constructor(private readonly props: LandingTemplateProps) {}

  static create(input: Omit<LandingTemplateProps, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): LandingTemplate {
    if (!input.name || input.name.trim().length < 2) {
      throw new ValidationError('name es requerido (mín 2 chars)')
    }
    if (input.kind !== 'lead_capture' && input.kind !== 'property') {
      throw new ValidationError(`kind inválido: "${input.kind}"`)
    }
    const v = validateBlocks(input.blocks)
    if (!v.success) throw new ValidationError(`Bloques inválidos: ${v.error}`)
    const leadForms = v.data.filter(b => b.type === 'lead-form')
    if (leadForms.length !== 1) throw new ValidationError('El template debe tener un único bloque lead-form')

    const now = new Date().toISOString()
    return new LandingTemplate({
      ...input,
      blocks: v.data,
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
    })
  }

  static fromPersistence(props: LandingTemplateProps): LandingTemplate { return new LandingTemplate(props) }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get name() { return this.props.name }
  get kind() { return this.props.kind }
  get description() { return this.props.description }
  get preview_image_url() { return this.props.preview_image_url }
  get blocks(): Block[] { return this.props.blocks }
  get active() { return this.props.active }
  get sort_order() { return this.props.sort_order }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  toObject(): LandingTemplateProps { return { ...this.props, blocks: [...this.props.blocks] } }

  isGlobal(): boolean { return this.props.org_id === null }
}
```

- [ ] **Step 2: Implement LandingVersion**

Create `vendepro-backend/packages/core/src/domain/entities/landing-version.ts`:

```typescript
import { validateBlocks, type Block } from '../value-objects/block-schemas'
import { ValidationError } from '../errors/validation-error'

export type VersionLabel = 'auto-save' | 'manual-save' | 'ai-edit' | 'publish'

export interface LandingVersionProps {
  id: string
  landing_id: string
  version_number: number
  blocks: Block[]
  label: VersionLabel
  created_by: string
  created_at: string
}

const VALID_LABELS: VersionLabel[] = ['auto-save', 'manual-save', 'ai-edit', 'publish']

export class LandingVersion {
  private constructor(private readonly props: LandingVersionProps) {}

  static create(input: Omit<LandingVersionProps, 'created_at'> & { created_at?: string }): LandingVersion {
    if (!VALID_LABELS.includes(input.label)) throw new ValidationError(`label inválido: "${input.label}"`)
    if (!Number.isInteger(input.version_number) || input.version_number < 1) {
      throw new ValidationError('version_number debe ser un entero >= 1')
    }
    const v = validateBlocks(input.blocks)
    if (!v.success) throw new ValidationError(`Bloques inválidos en versión: ${v.error}`)
    return new LandingVersion({ ...input, blocks: v.data, created_at: input.created_at ?? new Date().toISOString() })
  }

  static fromPersistence(props: LandingVersionProps): LandingVersion { return new LandingVersion(props) }

  get id() { return this.props.id }
  get landing_id() { return this.props.landing_id }
  get version_number() { return this.props.version_number }
  get blocks(): Block[] { return this.props.blocks }
  get label() { return this.props.label }
  get created_by() { return this.props.created_by }
  get created_at() { return this.props.created_at }

  toObject(): LandingVersionProps { return { ...this.props, blocks: [...this.props.blocks] } }

  isImmutable(): boolean { return this.props.label === 'publish' }
}
```

- [ ] **Step 3: Implement LandingEvent**

Create `vendepro-backend/packages/core/src/domain/entities/landing-event.ts`:

```typescript
import { ValidationError } from '../errors/validation-error'

export const LANDING_EVENT_TYPES = ['pageview', 'cta_click', 'form_start', 'form_submit'] as const
export type LandingEventType = typeof LANDING_EVENT_TYPES[number]

export interface LandingEventProps {
  id: string
  landing_id: string
  slug: string
  event_type: LandingEventType
  visitor_id: string | null
  session_id: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  referrer: string | null
  user_agent: string | null
  created_at: string
}

export class LandingEvent {
  private constructor(private readonly props: LandingEventProps) {}

  static create(input: Omit<LandingEventProps, 'created_at'> & { created_at?: string }): LandingEvent {
    if (!LANDING_EVENT_TYPES.includes(input.event_type)) {
      throw new ValidationError(`event_type inválido: "${input.event_type}"`)
    }
    return new LandingEvent({ ...input, created_at: input.created_at ?? new Date().toISOString() })
  }

  static fromPersistence(props: LandingEventProps): LandingEvent { return new LandingEvent(props) }

  get id() { return this.props.id }
  get landing_id() { return this.props.landing_id }
  get slug() { return this.props.slug }
  get event_type() { return this.props.event_type }
  get visitor_id() { return this.props.visitor_id }
  get session_id() { return this.props.session_id }
  get utm_source() { return this.props.utm_source }
  get utm_medium() { return this.props.utm_medium }
  get utm_campaign() { return this.props.utm_campaign }
  get referrer() { return this.props.referrer }
  get user_agent() { return this.props.user_agent }
  get created_at() { return this.props.created_at }

  toObject(): LandingEventProps { return { ...this.props } }
}
```

- [ ] **Step 4: Export entities**

Modify `vendepro-backend/packages/core/src/domain/entities/index.ts` — append:

```typescript
export * from './landing'
export * from './landing-template'
export * from './landing-version'
export * from './landing-event'
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck -- --filter @vendepro/core`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add vendepro-backend/packages/core/src/domain/entities/
git commit -m "feat(core): add LandingTemplate, LandingVersion, LandingEvent entities"
```

---

## Task 8: Domain rules — landing-rules.ts

**Files:**
- Create: `vendepro-backend/packages/core/src/domain/rules/landing-rules.ts`
- Test: `vendepro-backend/packages/core/tests/domain/landing-rules.test.ts`

- [ ] **Step 1: Write failing test**

Create `vendepro-backend/packages/core/tests/domain/landing-rules.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { canEditLanding, canPublish, canRequestPublish, canArchive, canRollback } from '../../src/domain/rules/landing-rules'

describe('landing-rules', () => {
  describe('canEditLanding', () => {
    it('owner puede editar su landing en draft', () => {
      expect(canEditLanding({ role: 'agent', userId: 'u1' }, { agent_id: 'u1', status: 'draft' })).toBe(true)
    })
    it('owner puede editar en pending_review', () => {
      expect(canEditLanding({ role: 'agent', userId: 'u1' }, { agent_id: 'u1', status: 'pending_review' })).toBe(true)
    })
    it('agente no puede editar ajena', () => {
      expect(canEditLanding({ role: 'agent', userId: 'u2' }, { agent_id: 'u1', status: 'draft' })).toBe(false)
    })
    it('admin puede editar cualquier landing', () => {
      expect(canEditLanding({ role: 'admin', userId: 'adm' }, { agent_id: 'u1', status: 'draft' })).toBe(true)
    })
    it('nadie edita publicada sin pasarla a draft primero', () => {
      expect(canEditLanding({ role: 'agent', userId: 'u1' }, { agent_id: 'u1', status: 'published' })).toBe(false)
    })
  })

  describe('canPublish', () => {
    it('solo admin', () => {
      expect(canPublish({ role: 'admin', userId: 'adm' })).toBe(true)
      expect(canPublish({ role: 'agent', userId: 'u1' })).toBe(false)
    })
  })

  describe('canRequestPublish', () => {
    it('owner de landing en draft', () => {
      expect(canRequestPublish({ role: 'agent', userId: 'u1' }, { agent_id: 'u1', status: 'draft' })).toBe(true)
    })
    it('no desde pending_review', () => {
      expect(canRequestPublish({ role: 'agent', userId: 'u1' }, { agent_id: 'u1', status: 'pending_review' })).toBe(false)
    })
    it('admin también puede pedir publicación (edge case: flow unificado)', () => {
      expect(canRequestPublish({ role: 'admin', userId: 'a' }, { agent_id: 'u1', status: 'draft' })).toBe(true)
    })
  })

  describe('canArchive', () => {
    it('owner y admin', () => {
      expect(canArchive({ role: 'agent', userId: 'u1' }, { agent_id: 'u1' })).toBe(true)
      expect(canArchive({ role: 'agent', userId: 'u2' }, { agent_id: 'u1' })).toBe(false)
      expect(canArchive({ role: 'admin', userId: 'adm' }, { agent_id: 'u1' })).toBe(true)
    })
  })

  describe('canRollback', () => {
    it('owner en draft', () => {
      expect(canRollback({ role: 'agent', userId: 'u1' }, { agent_id: 'u1', status: 'draft' })).toBe(true)
    })
    it('agente en published: no', () => {
      expect(canRollback({ role: 'agent', userId: 'u1' }, { agent_id: 'u1', status: 'published' })).toBe(false)
    })
    it('admin siempre', () => {
      expect(canRollback({ role: 'admin', userId: 'adm' }, { agent_id: 'u1', status: 'published' })).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Implement rules**

Create `vendepro-backend/packages/core/src/domain/rules/landing-rules.ts`:

```typescript
import type { LandingStatusValue } from '../value-objects/landing-status'

export type Role = 'admin' | 'agent'

export interface Actor {
  role: Role
  userId: string
}

export interface LandingRef {
  agent_id: string
  status?: LandingStatusValue
}

export function isOwner(actor: Actor, ref: LandingRef): boolean {
  return actor.userId === ref.agent_id
}

export function canEditLanding(actor: Actor, ref: LandingRef & { status: LandingStatusValue }): boolean {
  if (ref.status === 'published' || ref.status === 'archived') return false
  if (actor.role === 'admin') return true
  return isOwner(actor, ref)
}

export function canRequestPublish(actor: Actor, ref: LandingRef & { status: LandingStatusValue }): boolean {
  if (ref.status !== 'draft') return false
  if (actor.role === 'admin') return true
  return isOwner(actor, ref)
}

export function canPublish(actor: Actor): boolean {
  return actor.role === 'admin'
}

export function canRejectPublishRequest(actor: Actor): boolean {
  return actor.role === 'admin'
}

export function canArchive(actor: Actor, ref: LandingRef): boolean {
  if (actor.role === 'admin') return true
  return isOwner(actor, ref)
}

export function canRollback(actor: Actor, ref: LandingRef & { status: LandingStatusValue }): boolean {
  if (actor.role === 'admin') return true
  if (!isOwner(actor, ref)) return false
  // Agente solo en draft/pending_review
  return ref.status === 'draft' || ref.status === 'pending_review'
}

export function canManageTemplates(actor: Actor): boolean {
  return actor.role === 'admin'
}

// Retention policy: keep latest N non-publish versions per landing + todas las `publish`
export const VERSION_RETENTION_NON_PUBLISH = 20

// AI rate limit
export const AI_EDITS_PER_MINUTE = 30

// Auto-save throttle
export const AUTOSAVE_THROTTLE_MS = 30_000
```

- [ ] **Step 3: Run test — expect PASS**

Run: `npm test -- --filter @vendepro/core --run tests/domain/landing-rules.test.ts`
Expected: PASS (~13 tests).

- [ ] **Step 4: Commit**

```bash
git add vendepro-backend/packages/core/src/domain/rules/ vendepro-backend/packages/core/tests/domain/landing-rules.test.ts
git commit -m "feat(core): add landing-rules with permission and policy helpers"
```

---

## Task 9: Repository ports

**Files:**
- Create: `vendepro-backend/packages/core/src/application/ports/repositories/landing-repository.ts`
- Create: `vendepro-backend/packages/core/src/application/ports/repositories/landing-template-repository.ts`
- Create: `vendepro-backend/packages/core/src/application/ports/repositories/landing-version-repository.ts`
- Create: `vendepro-backend/packages/core/src/application/ports/repositories/landing-event-repository.ts`
- Modify: `vendepro-backend/packages/core/src/application/ports/repositories/index.ts`

- [ ] **Step 1: Create LandingRepository port**

Create `vendepro-backend/packages/core/src/application/ports/repositories/landing-repository.ts`:

```typescript
import type { Landing } from '../../../domain/entities/landing'
import type { LandingStatusValue } from '../../../domain/value-objects/landing-status'

export interface LandingFilters {
  status?: LandingStatusValue | LandingStatusValue[]
  agent_id?: string
  kind?: 'lead_capture' | 'property'
}

export interface LandingRepository {
  findById(id: string, orgId: string): Promise<Landing | null>
  findByFullSlug(fullSlug: string): Promise<Landing | null>
  findByOrg(orgId: string, filters?: LandingFilters): Promise<Landing[]>
  save(landing: Landing): Promise<void>
  existsFullSlug(fullSlug: string): Promise<boolean>
}
```

- [ ] **Step 2: Create LandingTemplateRepository port**

Create `vendepro-backend/packages/core/src/application/ports/repositories/landing-template-repository.ts`:

```typescript
import type { LandingTemplate } from '../../../domain/entities/landing-template'
import type { LandingKind } from '../../../domain/entities/landing'

export interface LandingTemplateRepository {
  findById(id: string): Promise<LandingTemplate | null>
  /** Lista templates visibles para la org (globals + propios de org). */
  listVisibleTo(orgId: string, filters?: { kind?: LandingKind; onlyActive?: boolean }): Promise<LandingTemplate[]>
  save(template: LandingTemplate): Promise<void>
}
```

- [ ] **Step 3: Create LandingVersionRepository port**

Create `vendepro-backend/packages/core/src/application/ports/repositories/landing-version-repository.ts`:

```typescript
import type { LandingVersion } from '../../../domain/entities/landing-version'

export interface LandingVersionRepository {
  findById(id: string): Promise<LandingVersion | null>
  listByLanding(landingId: string, limit?: number): Promise<LandingVersion[]>
  save(version: LandingVersion): Promise<void>
  nextVersionNumber(landingId: string): Promise<number>
  /** Borra las versiones sobrantes que no sean `publish` respetando la retención. */
  pruneNonPublish(landingId: string, keepLatest: number): Promise<number>
}
```

- [ ] **Step 4: Create LandingEventRepository port**

Create `vendepro-backend/packages/core/src/application/ports/repositories/landing-event-repository.ts`:

```typescript
import type { LandingEvent, LandingEventType } from '../../../domain/entities/landing-event'

export interface AnalyticsRange { since: string; until: string }

export interface AnalyticsSummary {
  pageviews: number
  unique_visitors: number
  cta_clicks: number
  form_starts: number
  form_submits: number
  conversion_rate: number         // form_submits / pageviews
  pageviews_by_day: Array<{ date: string; count: number }>
  top_utm_sources: Array<{ source: string; count: number }>
}

export interface LandingEventRepository {
  save(event: LandingEvent): Promise<void>
  countByIpInWindow(ip: string, sinceIso: string): Promise<number>
  summary(landingId: string, range: AnalyticsRange): Promise<AnalyticsSummary>
  recentByType(landingId: string, type: LandingEventType, limit: number): Promise<LandingEvent[]>
}
```

- [ ] **Step 5: Update ports index**

Modify `vendepro-backend/packages/core/src/application/ports/repositories/index.ts` — append:

```typescript
export * from './landing-repository'
export * from './landing-template-repository'
export * from './landing-version-repository'
export * from './landing-event-repository'
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck -- --filter @vendepro/core`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add vendepro-backend/packages/core/src/application/ports/repositories/
git commit -m "feat(core): add landing repository ports (landing, template, version, event)"
```

---

## Task 10: Extend AIService port

**Files:**
- Modify: `vendepro-backend/packages/core/src/application/ports/services/ai-service.ts`

- [ ] **Step 1: Extend the port**

Replace `vendepro-backend/packages/core/src/application/ports/services/ai-service.ts` with:

```typescript
import type { Block, BlockType } from '../../../domain/value-objects/block-schemas'

export interface LeadIntent {
  full_name?: string
  phone?: string
  email?: string
  neighborhood?: string
  property_type?: string
  operation?: string
  notes?: string
  budget?: number
}

export interface EditBlockInput {
  blockType: BlockType
  blockData: Record<string, unknown>
  prompt: string
  brandVoice?: string | null
}

export interface EditGlobalInput {
  blocks: Block[]
  prompt: string
  brandVoice?: string | null
}

export type EditBlockResult =
  | { status: 'ok'; data: Record<string, unknown> }
  | { status: 'error'; reason: 'schema_mismatch' | 'provider_error' | 'timeout'; detail?: string }

export type EditGlobalResult =
  | { status: 'ok'; blocks: Block[] }
  | { status: 'error'; reason: 'schema_mismatch' | 'provider_error' | 'timeout'; detail?: string }

export interface AIService {
  extractLeadIntent(text: string): Promise<LeadIntent>
  transcribeAudio(audioBuffer: ArrayBuffer, mimeType: string): Promise<string>
  extractMetricsFromScreenshot(imageBase64: string): Promise<Record<string, unknown>>

  editLandingBlock(input: EditBlockInput): Promise<EditBlockResult>
  editLandingGlobal(input: EditGlobalInput): Promise<EditGlobalResult>
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck -- --filter @vendepro/core`
Expected: errors pointing to `GroqAIService` y `AnthropicAIService` no implementan los nuevos métodos.

- [ ] **Step 3: Stub los métodos en los adapters existentes para que compile**

Edit `vendepro-backend/packages/infrastructure/src/services/groq-ai-service.ts` — append inside the class:

```typescript
  async editLandingBlock(_input: import('@vendepro/core').EditBlockInput): Promise<import('@vendepro/core').EditBlockResult> {
    // Se implementa en Task 27. Stub por ahora.
    return { status: 'error', reason: 'provider_error', detail: 'not implemented yet' }
  }

  async editLandingGlobal(_input: import('@vendepro/core').EditGlobalInput): Promise<import('@vendepro/core').EditGlobalResult> {
    return { status: 'error', reason: 'provider_error', detail: 'not implemented yet' }
  }
```

Edit `vendepro-backend/packages/infrastructure/src/services/anthropic-ai-service.ts` — append the same two stubs.

- [ ] **Step 4: Typecheck everything**

Run from `vendepro-backend/`: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add vendepro-backend/packages/core/src/application/ports/services/ai-service.ts vendepro-backend/packages/infrastructure/src/services/
git commit -m "feat(core): extend AIService port with editLandingBlock + editLandingGlobal"
```

---

## Task 11: Use-case — CreateLandingFromTemplate

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/create-landing-from-template.ts`
- Test: `vendepro-backend/packages/core/tests/use-cases/landings/create-landing-from-template.test.ts`

- [ ] **Step 1: Write failing test**

Create `vendepro-backend/packages/core/tests/use-cases/landings/create-landing-from-template.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { CreateLandingFromTemplateUseCase } from '../../../src/application/use-cases/landings/create-landing-from-template'
import { LandingTemplate } from '../../../src/domain/entities/landing-template'
import { Landing } from '../../../src/domain/entities/landing'
import { LandingVersion } from '../../../src/domain/entities/landing-version'
import type { Block } from '../../../src/domain/value-objects/block-schemas'

const makeBlocks = (): Block[] => ([
  { id: 'b_hero', type: 'hero', visible: true, data: { title: 't', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 } },
  { id: 'b_form', type: 'lead-form', visible: true, data: { title: 'c', fields: [{ key: 'name', label: 'N', required: true }, { key: 'phone', label: 'T', required: true }], submit_label: 'Enviar', success_message: 'ok' } },
])

function makeDeps() {
  const templateStore = new Map<string, LandingTemplate>()
  const landingStore = new Map<string, Landing>()
  const versionStore: LandingVersion[] = []
  const existsSlugs = new Set<string>()

  const templates = {
    findById: vi.fn(async (id: string) => templateStore.get(id) ?? null),
    listVisibleTo: vi.fn(),
    save: vi.fn(),
  }
  const landings = {
    findById: vi.fn(async (id: string) => landingStore.get(id) ?? null),
    findByFullSlug: vi.fn(),
    findByOrg: vi.fn(),
    save: vi.fn(async (l: Landing) => { landingStore.set(l.id, l) }),
    existsFullSlug: vi.fn(async (fs: string) => existsSlugs.has(fs)),
  }
  const versions = {
    findById: vi.fn(),
    listByLanding: vi.fn(),
    save: vi.fn(async (v: LandingVersion) => { versionStore.push(v) }),
    nextVersionNumber: vi.fn(async () => versionStore.length + 1),
    pruneNonPublish: vi.fn(),
  }
  let counter = 0
  const idGen = { generate: vi.fn(() => `id_${++counter}`) }

  return { templates, landings, versions, idGen, templateStore, landingStore, versionStore, existsSlugs }
}

describe('CreateLandingFromTemplateUseCase', () => {
  it('crea landing en draft con copy de bloques del template y versión inicial', async () => {
    const d = makeDeps()
    d.templateStore.set('tpl_1', LandingTemplate.create({
      id: 'tpl_1', org_id: null, name: 'X', kind: 'property',
      description: null, preview_image_url: null, blocks: makeBlocks(), active: true, sort_order: 1,
    }))

    const uc = new CreateLandingFromTemplateUseCase(d.templates as any, d.landings as any, d.versions as any, d.idGen as any)
    const result = await uc.execute({
      actor: { role: 'agent', userId: 'u1' },
      orgId: 'o1',
      templateId: 'tpl_1',
      slugBase: 'palermo-soho',
      brandVoice: 'cálido',
    })

    expect(result.landingId).toBeDefined()
    expect(result.fullSlug).toMatch(/^palermo-soho-[a-z0-9]{5}$/)
    expect(d.landings.save).toHaveBeenCalledOnce()
    const saved = d.landingStore.get(result.landingId)!
    expect(saved.status).toBe('draft')
    expect(saved.kind).toBe('property')
    expect(saved.blocks.length).toBe(2)
    expect(saved.brand_voice).toBe('cálido')
    // Versión inicial manual-save
    expect(d.versionStore.length).toBe(1)
    expect(d.versionStore[0].label).toBe('manual-save')
  })

  it('reintenta si full_slug existe (collisión del suffix)', async () => {
    const d = makeDeps()
    d.templateStore.set('tpl_1', LandingTemplate.create({
      id: 'tpl_1', org_id: null, name: 'X', kind: 'lead_capture',
      description: null, preview_image_url: null, blocks: makeBlocks(), active: true, sort_order: 1,
    }))
    // Primer intento colisiona, segundo no.
    let calls = 0
    d.landings.existsFullSlug = vi.fn(async () => (++calls === 1))
    const uc = new CreateLandingFromTemplateUseCase(d.templates as any, d.landings as any, d.versions as any, d.idGen as any)
    const r = await uc.execute({ actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', templateId: 'tpl_1', slugBase: 'promo' })
    expect(r.landingId).toBeDefined()
    expect(d.landings.existsFullSlug).toHaveBeenCalledTimes(2)
  })

  it('lanza si template no existe', async () => {
    const d = makeDeps()
    const uc = new CreateLandingFromTemplateUseCase(d.templates as any, d.landings as any, d.versions as any, d.idGen as any)
    await expect(uc.execute({
      actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', templateId: 'tpl_ghost', slugBase: 'x',
    })).rejects.toThrow(/template/i)
  })

  it('respeta visibilidad multi-tenant: rechaza template de otra org', async () => {
    const d = makeDeps()
    d.templateStore.set('tpl_2', LandingTemplate.create({
      id: 'tpl_2', org_id: 'OTHER_ORG', name: 'priv', kind: 'property',
      description: null, preview_image_url: null, blocks: makeBlocks(), active: true, sort_order: 1,
    }))
    const uc = new CreateLandingFromTemplateUseCase(d.templates as any, d.landings as any, d.versions as any, d.idGen as any)
    await expect(uc.execute({
      actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', templateId: 'tpl_2', slugBase: 'x',
    })).rejects.toThrow(/template/i)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- --filter @vendepro/core --run tests/use-cases/landings/create-landing-from-template.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the use case**

Create `vendepro-backend/packages/core/src/application/use-cases/landings/create-landing-from-template.ts`:

```typescript
import { Landing, type LandingKind, type LeadRules } from '../../../domain/entities/landing'
import { LandingVersion } from '../../../domain/entities/landing-version'
import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingTemplateRepository } from '../../ports/repositories/landing-template-repository'
import type { LandingVersionRepository } from '../../ports/repositories/landing-version-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { generateSlugSuffix } from '../../../domain/value-objects/landing-slug'
import { NotFoundError } from '../../../domain/errors/not-found-error'
import type { Actor } from '../../../domain/rules/landing-rules'

export interface CreateLandingInput {
  actor: Actor
  orgId: string
  templateId: string
  slugBase: string
  brandVoice?: string | null
  leadRules?: LeadRules | null
  seoTitle?: string | null
  seoDescription?: string | null
  ogImageUrl?: string | null
}

export interface CreateLandingOutput {
  landingId: string
  fullSlug: string
}

const MAX_SLUG_COLLISION_RETRIES = 5

export class CreateLandingFromTemplateUseCase {
  constructor(
    private readonly templates: LandingTemplateRepository,
    private readonly landings: LandingRepository,
    private readonly versions: LandingVersionRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: CreateLandingInput): Promise<CreateLandingOutput> {
    const template = await this.templates.findById(input.templateId)
    if (!template) throw new NotFoundError(`Template no encontrado: ${input.templateId}`)
    // Multi-tenant: globals o de la misma org
    if (template.org_id !== null && template.org_id !== input.orgId) {
      throw new NotFoundError(`Template no accesible: ${input.templateId}`)
    }

    // Resolve slug suffix sin colisión
    let slugSuffix = generateSlugSuffix()
    let fullSlug = `${input.slugBase}-${slugSuffix}`
    let attempts = 0
    while (await this.landings.existsFullSlug(fullSlug)) {
      if (++attempts > MAX_SLUG_COLLISION_RETRIES) {
        throw new Error('No se pudo generar un slug único tras varios intentos. Probá con otro slug_base.')
      }
      slugSuffix = generateSlugSuffix()
      fullSlug = `${input.slugBase}-${slugSuffix}`
    }

    const landing = Landing.create({
      id: this.idGen.generate(),
      org_id: input.orgId,
      agent_id: input.actor.userId,
      template_id: template.id,
      kind: template.kind as LandingKind,
      slug_base: input.slugBase,
      slug_suffix: slugSuffix,
      blocks: template.blocks.map(b => ({ ...b, data: structuredClone(b.data) })),
      brand_voice: input.brandVoice ?? null,
      lead_rules: input.leadRules ?? null,
      seo_title: input.seoTitle ?? null,
      seo_description: input.seoDescription ?? null,
      og_image_url: input.ogImageUrl ?? null,
    })

    await this.landings.save(landing)

    const versionNumber = await this.versions.nextVersionNumber(landing.id)
    const version = LandingVersion.create({
      id: this.idGen.generate(),
      landing_id: landing.id,
      version_number: versionNumber,
      blocks: landing.blocks,
      label: 'manual-save',
      created_by: input.actor.userId,
    })
    await this.versions.save(version)

    return { landingId: landing.id, fullSlug: landing.full_slug }
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- --filter @vendepro/core --run tests/use-cases/landings/create-landing-from-template.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add vendepro-backend/packages/core/src/application/use-cases/landings/create-landing-from-template.ts vendepro-backend/packages/core/tests/use-cases/landings/create-landing-from-template.test.ts
git commit -m "feat(core): use-case CreateLandingFromTemplate + tests"
```

---

## Task 12: Use-cases — block manipulation (UpdateBlocks, Add, Remove, Reorder, ToggleVisibility)

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/update-landing-blocks.ts`
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/add-block.ts`
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/remove-block.ts`
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/reorder-blocks.ts`
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/toggle-block-visibility.ts`
- Test: `vendepro-backend/packages/core/tests/use-cases/landings/update-landing-blocks.test.ts`

- [ ] **Step 1: Shared helper for auto-save**

All block-manipulation use cases need to: (a) chequear permisos, (b) mutar la landing, (c) snapshot `manual-save` en versions. Implementamos cada uno; el test cubre el más complejo (update-landing-blocks).

Create `vendepro-backend/packages/core/src/application/use-cases/landings/update-landing-blocks.ts`:

```typescript
import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingVersionRepository } from '../../ports/repositories/landing-version-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { LandingVersion } from '../../../domain/entities/landing-version'
import type { Block } from '../../../domain/value-objects/block-schemas'
import { NotFoundError } from '../../../domain/errors/not-found-error'
import { UnauthorizedError } from '../../../domain/errors/unauthorized-error'
import { canEditLanding, VERSION_RETENTION_NON_PUBLISH, type Actor } from '../../../domain/rules/landing-rules'

export interface UpdateLandingBlocksInput {
  actor: Actor
  orgId: string
  landingId: string
  blocks: Block[]
  label?: 'manual-save' | 'auto-save'
}

export class UpdateLandingBlocksUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly versions: LandingVersionRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: UpdateLandingBlocksInput): Promise<{ versionId: string; versionNumber: number }> {
    const landing = await this.landings.findById(input.landingId, input.orgId)
    if (!landing) throw new NotFoundError(`Landing no encontrada: ${input.landingId}`)
    if (!canEditLanding(input.actor, { agent_id: landing.agent_id, status: landing.status })) {
      throw new UnauthorizedError('No tenés permisos para editar esta landing')
    }

    const updated = landing.replaceBlocks(input.blocks)
    await this.landings.save(updated)

    const versionNumber = await this.versions.nextVersionNumber(landing.id)
    const version = LandingVersion.create({
      id: this.idGen.generate(),
      landing_id: landing.id,
      version_number: versionNumber,
      blocks: updated.blocks,
      label: input.label ?? 'manual-save',
      created_by: input.actor.userId,
    })
    await this.versions.save(version)

    await this.versions.pruneNonPublish(landing.id, VERSION_RETENTION_NON_PUBLISH)

    return { versionId: version.id, versionNumber: version.version_number }
  }
}
```

- [ ] **Step 2: Implement add-block**

Create `vendepro-backend/packages/core/src/application/use-cases/landings/add-block.ts`:

```typescript
import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingVersionRepository } from '../../ports/repositories/landing-version-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { UpdateLandingBlocksUseCase } from './update-landing-blocks'
import type { Block } from '../../../domain/value-objects/block-schemas'
import { NotFoundError } from '../../../domain/errors/not-found-error'
import type { Actor } from '../../../domain/rules/landing-rules'

export interface AddBlockInput {
  actor: Actor
  orgId: string
  landingId: string
  block: Omit<Block, 'id'>
  insertAtIndex?: number       // por defecto, antes del lead-form (penúltimo)
}

export class AddBlockUseCase {
  private readonly update: UpdateLandingBlocksUseCase
  constructor(
    landings: LandingRepository,
    versions: LandingVersionRepository,
    private readonly idGen: IdGenerator,
  ) {
    this.update = new UpdateLandingBlocksUseCase(landings, versions, idGen)
  }

  async execute(input: AddBlockInput): Promise<{ blockId: string }> {
    const landing = await this.updateGetLanding(input)
    const newBlock: Block = { ...input.block, id: this.idGen.generate() } as Block
    const blocks = [...landing.blocks]
    const idx = input.insertAtIndex ?? Math.max(0, blocks.findIndex(b => b.type === 'lead-form'))
    blocks.splice(idx, 0, newBlock)
    await this.update.execute({ actor: input.actor, orgId: input.orgId, landingId: landing.id, blocks })
    return { blockId: newBlock.id }
  }

  private async updateGetLanding(input: AddBlockInput) {
    const landing = await (this.update as any).landings?.findById?.(input.landingId, input.orgId)
    // update holds landings privately; use-case re-reads. Alternative: re-query:
    return landing ?? (await (this.update as any).landings.findById(input.landingId, input.orgId))
      ?? (() => { throw new NotFoundError(`Landing no encontrada: ${input.landingId}`) })()
  }
}
```

**Nota:** el patrón anterior expone privados. Reescribamos más limpio recibiendo `landings` directamente:

Replace with cleaner version:

```typescript
import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingVersionRepository } from '../../ports/repositories/landing-version-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { UpdateLandingBlocksUseCase } from './update-landing-blocks'
import type { Block } from '../../../domain/value-objects/block-schemas'
import { NotFoundError } from '../../../domain/errors/not-found-error'
import type { Actor } from '../../../domain/rules/landing-rules'

export interface AddBlockInput {
  actor: Actor
  orgId: string
  landingId: string
  block: Omit<Block, 'id'>
  insertAtIndex?: number
}

export class AddBlockUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly versions: LandingVersionRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: AddBlockInput): Promise<{ blockId: string }> {
    const landing = await this.landings.findById(input.landingId, input.orgId)
    if (!landing) throw new NotFoundError(`Landing no encontrada: ${input.landingId}`)

    const newBlock: Block = { ...input.block, id: this.idGen.generate() } as Block
    const blocks = [...landing.blocks]
    const leadFormIdx = blocks.findIndex(b => b.type === 'lead-form')
    const idx = input.insertAtIndex ?? (leadFormIdx >= 0 ? leadFormIdx : blocks.length)
    blocks.splice(idx, 0, newBlock)

    const update = new UpdateLandingBlocksUseCase(this.landings, this.versions, this.idGen)
    await update.execute({ actor: input.actor, orgId: input.orgId, landingId: landing.id, blocks })
    return { blockId: newBlock.id }
  }
}
```

- [ ] **Step 3: Implement remove-block**

Create `vendepro-backend/packages/core/src/application/use-cases/landings/remove-block.ts`:

```typescript
import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingVersionRepository } from '../../ports/repositories/landing-version-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { UpdateLandingBlocksUseCase } from './update-landing-blocks'
import { NotFoundError } from '../../../domain/errors/not-found-error'
import { ValidationError } from '../../../domain/errors/validation-error'
import type { Actor } from '../../../domain/rules/landing-rules'

export class RemoveBlockUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly versions: LandingVersionRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: { actor: Actor; orgId: string; landingId: string; blockId: string }): Promise<void> {
    const landing = await this.landings.findById(input.landingId, input.orgId)
    if (!landing) throw new NotFoundError(`Landing no encontrada: ${input.landingId}`)
    const target = landing.blocks.find(b => b.id === input.blockId)
    if (!target) throw new NotFoundError(`Bloque no encontrado: ${input.blockId}`)
    if (target.type === 'lead-form') {
      throw new ValidationError('No se puede eliminar el bloque lead-form (es requerido).')
    }
    const blocks = landing.blocks.filter(b => b.id !== input.blockId)
    const update = new UpdateLandingBlocksUseCase(this.landings, this.versions, this.idGen)
    await update.execute({ actor: input.actor, orgId: input.orgId, landingId: landing.id, blocks })
  }
}
```

- [ ] **Step 4: Implement reorder-blocks**

Create `vendepro-backend/packages/core/src/application/use-cases/landings/reorder-blocks.ts`:

```typescript
import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingVersionRepository } from '../../ports/repositories/landing-version-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { UpdateLandingBlocksUseCase } from './update-landing-blocks'
import { NotFoundError } from '../../../domain/errors/not-found-error'
import { ValidationError } from '../../../domain/errors/validation-error'
import type { Actor } from '../../../domain/rules/landing-rules'

export class ReorderBlocksUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly versions: LandingVersionRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: { actor: Actor; orgId: string; landingId: string; orderedBlockIds: string[] }): Promise<void> {
    const landing = await this.landings.findById(input.landingId, input.orgId)
    if (!landing) throw new NotFoundError(`Landing no encontrada: ${input.landingId}`)

    if (input.orderedBlockIds.length !== landing.blocks.length) {
      throw new ValidationError('El orden debe incluir todos los bloques existentes (misma longitud).')
    }
    const byId = new Map(landing.blocks.map(b => [b.id, b]))
    const reordered = input.orderedBlockIds.map(id => {
      const b = byId.get(id)
      if (!b) throw new ValidationError(`ID de bloque desconocido en el orden: ${id}`)
      return b
    })
    const update = new UpdateLandingBlocksUseCase(this.landings, this.versions, this.idGen)
    await update.execute({ actor: input.actor, orgId: input.orgId, landingId: landing.id, blocks: reordered })
  }
}
```

- [ ] **Step 5: Implement toggle-block-visibility**

Create `vendepro-backend/packages/core/src/application/use-cases/landings/toggle-block-visibility.ts`:

```typescript
import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingVersionRepository } from '../../ports/repositories/landing-version-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { UpdateLandingBlocksUseCase } from './update-landing-blocks'
import { NotFoundError } from '../../../domain/errors/not-found-error'
import { ValidationError } from '../../../domain/errors/validation-error'
import type { Actor } from '../../../domain/rules/landing-rules'

export class ToggleBlockVisibilityUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly versions: LandingVersionRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: { actor: Actor; orgId: string; landingId: string; blockId: string; visible: boolean }): Promise<void> {
    const landing = await this.landings.findById(input.landingId, input.orgId)
    if (!landing) throw new NotFoundError(`Landing no encontrada: ${input.landingId}`)
    const target = landing.blocks.find(b => b.id === input.blockId)
    if (!target) throw new NotFoundError(`Bloque no encontrado: ${input.blockId}`)
    if (target.type === 'lead-form' && input.visible === false) {
      throw new ValidationError('No se puede ocultar el bloque lead-form (es requerido).')
    }
    const blocks = landing.blocks.map(b => b.id === input.blockId ? { ...b, visible: input.visible } : b)
    const update = new UpdateLandingBlocksUseCase(this.landings, this.versions, this.idGen)
    await update.execute({ actor: input.actor, orgId: input.orgId, landingId: landing.id, blocks })
  }
}
```

- [ ] **Step 6: Write test for UpdateLandingBlocksUseCase**

Create `vendepro-backend/packages/core/tests/use-cases/landings/update-landing-blocks.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { UpdateLandingBlocksUseCase } from '../../../src/application/use-cases/landings/update-landing-blocks'
import { Landing } from '../../../src/domain/entities/landing'
import { LandingVersion } from '../../../src/domain/entities/landing-version'
import type { Block } from '../../../src/domain/value-objects/block-schemas'

const baseBlocks: Block[] = [
  { id: 'b_hero', type: 'hero', visible: true, data: { title: 't', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 } },
  { id: 'b_form', type: 'lead-form', visible: true, data: { title: 'c', fields: [{ key: 'name', label: 'N', required: true }, { key: 'phone', label: 'T', required: true }], submit_label: 'Enviar', success_message: 'ok' } },
]

function setup() {
  const landing = Landing.create({
    id: 'l1', org_id: 'o1', agent_id: 'u1', template_id: 't1',
    kind: 'property', slug_base: 'pal', slug_suffix: 'abc23', blocks: baseBlocks,
  })
  const store = new Map<string, Landing>([['l1', landing]])
  const versionStore: LandingVersion[] = []
  const landings = {
    findById: vi.fn(async (id: string) => store.get(id) ?? null),
    save: vi.fn(async (l: Landing) => { store.set(l.id, l) }),
    findByFullSlug: vi.fn(), findByOrg: vi.fn(), existsFullSlug: vi.fn(),
  }
  const versions = {
    save: vi.fn(async (v: LandingVersion) => { versionStore.push(v) }),
    nextVersionNumber: vi.fn(async () => versionStore.length + 1),
    pruneNonPublish: vi.fn(async () => 0),
    findById: vi.fn(), listByLanding: vi.fn(),
  }
  const idGen = { generate: vi.fn(() => `v_${Math.random().toString(36).slice(2)}`) }
  return { landings, versions, idGen, store, versionStore }
}

describe('UpdateLandingBlocksUseCase', () => {
  it('owner puede actualizar', async () => {
    const d = setup()
    const uc = new UpdateLandingBlocksUseCase(d.landings as any, d.versions as any, d.idGen as any)
    const newBlocks = baseBlocks.map(b => b.id === 'b_hero' ? { ...b, data: { ...b.data, title: 'nuevo' } } : b) as Block[]
    const r = await uc.execute({ actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', landingId: 'l1', blocks: newBlocks })
    expect(r.versionNumber).toBe(1)
    expect(d.versionStore[0].label).toBe('manual-save')
    expect(d.versions.pruneNonPublish).toHaveBeenCalled()
  })

  it('rechaza si agente no es owner', async () => {
    const d = setup()
    const uc = new UpdateLandingBlocksUseCase(d.landings as any, d.versions as any, d.idGen as any)
    await expect(uc.execute({ actor: { role: 'agent', userId: 'u2' }, orgId: 'o1', landingId: 'l1', blocks: baseBlocks }))
      .rejects.toThrow(/permisos/i)
  })

  it('rechaza blocks sin lead-form', async () => {
    const d = setup()
    const uc = new UpdateLandingBlocksUseCase(d.landings as any, d.versions as any, d.idGen as any)
    const onlyHero = [baseBlocks[0]]
    await expect(uc.execute({ actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', landingId: 'l1', blocks: onlyHero }))
      .rejects.toThrow(/lead-form/i)
  })

  it('admin puede editar landing ajena', async () => {
    const d = setup()
    const uc = new UpdateLandingBlocksUseCase(d.landings as any, d.versions as any, d.idGen as any)
    await expect(uc.execute({ actor: { role: 'admin', userId: 'adm' }, orgId: 'o1', landingId: 'l1', blocks: baseBlocks }))
      .resolves.toBeDefined()
  })

  it('rechaza si landing no existe', async () => {
    const d = setup()
    const uc = new UpdateLandingBlocksUseCase(d.landings as any, d.versions as any, d.idGen as any)
    await expect(uc.execute({ actor: { role: 'admin', userId: 'adm' }, orgId: 'o1', landingId: 'xxx', blocks: baseBlocks }))
      .rejects.toThrow(/no encontrada/i)
  })
})
```

- [ ] **Step 7: Run tests**

Run: `npm test -- --filter @vendepro/core --run tests/use-cases/landings/update-landing-blocks.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 8: Commit**

```bash
git add vendepro-backend/packages/core/src/application/use-cases/landings/ vendepro-backend/packages/core/tests/use-cases/landings/update-landing-blocks.test.ts
git commit -m "feat(core): use-cases for block manipulation (update, add, remove, reorder, toggle)"
```

---

## Task 13: Use-case — EditBlockWithAI

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/edit-block-with-ai.ts`
- Test: `vendepro-backend/packages/core/tests/use-cases/landings/edit-block-with-ai.test.ts`

- [ ] **Step 1: Write failing test**

Create `vendepro-backend/packages/core/tests/use-cases/landings/edit-block-with-ai.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { EditBlockWithAIUseCase } from '../../../src/application/use-cases/landings/edit-block-with-ai'
import { Landing } from '../../../src/domain/entities/landing'
import type { Block } from '../../../src/domain/value-objects/block-schemas'

const blocks: Block[] = [
  { id: 'b_hero', type: 'hero', visible: true, data: { title: 'old', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 } },
  { id: 'b_form', type: 'lead-form', visible: true, data: { title: 'c', fields: [{ key: 'name', label: 'N', required: true }, { key: 'phone', label: 'T', required: true }], submit_label: 'Enviar', success_message: 'ok' } },
]

function setup(overrides?: Partial<{ aiEditBlock: any; aiEditGlobal: any }>) {
  const landing = Landing.create({
    id: 'l1', org_id: 'o1', agent_id: 'u1', template_id: 't1',
    kind: 'property', slug_base: 'pal', slug_suffix: 'abc23', blocks, brand_voice: 'cálido',
  })
  const landings = {
    findById: vi.fn(async () => landing),
    save: vi.fn(), findByFullSlug: vi.fn(), findByOrg: vi.fn(), existsFullSlug: vi.fn(),
  }
  const ai = {
    extractLeadIntent: vi.fn(), transcribeAudio: vi.fn(), extractMetricsFromScreenshot: vi.fn(),
    editLandingBlock: overrides?.aiEditBlock ?? vi.fn(async () => ({ status: 'ok', data: { title: 'nuevo', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 } })),
    editLandingGlobal: overrides?.aiEditGlobal ?? vi.fn(),
  }
  return { landings, ai, landing }
}

describe('EditBlockWithAIUseCase', () => {
  it('scope=block retorna propuesta con data nueva', async () => {
    const d = setup()
    const uc = new EditBlockWithAIUseCase(d.landings as any, d.ai as any)
    const r = await uc.execute({ actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', landingId: 'l1', prompt: 'hazlo más cálido', scope: 'block', blockId: 'b_hero' })
    expect(r.status).toBe('ok')
    if (r.status === 'ok' && r.proposal.kind === 'block') {
      expect(r.proposal.blockId).toBe('b_hero')
      expect((r.proposal.data as any).title).toBe('nuevo')
    }
  })

  it('scope=block requiere blockId', async () => {
    const d = setup()
    const uc = new EditBlockWithAIUseCase(d.landings as any, d.ai as any)
    await expect(uc.execute({ actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', landingId: 'l1', prompt: 'x', scope: 'block' } as any))
      .rejects.toThrow(/blockId/i)
  })

  it('propaga error_schema si AI falla validación', async () => {
    const d = setup({ aiEditBlock: vi.fn(async () => ({ status: 'error', reason: 'schema_mismatch' })) })
    const uc = new EditBlockWithAIUseCase(d.landings as any, d.ai as any)
    const r = await uc.execute({ actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', landingId: 'l1', prompt: 'x', scope: 'block', blockId: 'b_hero' })
    expect(r.status).toBe('error')
    if (r.status === 'error') expect(r.reason).toBe('schema_mismatch')
  })

  it('scope=global retorna array completo', async () => {
    const d = setup({ aiEditGlobal: vi.fn(async () => ({ status: 'ok', blocks: blocks.map(b => b.id === 'b_hero' ? { ...b, data: { ...b.data, title: 'G' } } : b) })) })
    const uc = new EditBlockWithAIUseCase(d.landings as any, d.ai as any)
    const r = await uc.execute({ actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', landingId: 'l1', prompt: 'x', scope: 'global' })
    expect(r.status).toBe('ok')
    if (r.status === 'ok' && r.proposal.kind === 'global') {
      expect(r.proposal.blocks.length).toBe(2)
    }
  })

  it('rechaza edits si no tiene permisos', async () => {
    const d = setup()
    const uc = new EditBlockWithAIUseCase(d.landings as any, d.ai as any)
    await expect(uc.execute({ actor: { role: 'agent', userId: 'u2' }, orgId: 'o1', landingId: 'l1', prompt: 'x', scope: 'block', blockId: 'b_hero' }))
      .rejects.toThrow(/permisos/i)
  })

  it('acota prompt a 500 chars', async () => {
    const d = setup()
    const uc = new EditBlockWithAIUseCase(d.landings as any, d.ai as any)
    const longPrompt = 'x'.repeat(600)
    await expect(uc.execute({ actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', landingId: 'l1', prompt: longPrompt, scope: 'block', blockId: 'b_hero' }))
      .rejects.toThrow(/500/i)
  })
})
```

- [ ] **Step 2: Implement the use case**

Create `vendepro-backend/packages/core/src/application/use-cases/landings/edit-block-with-ai.ts`:

```typescript
import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { AIService } from '../../ports/services/ai-service'
import type { Block } from '../../../domain/value-objects/block-schemas'
import { NotFoundError } from '../../../domain/errors/not-found-error'
import { UnauthorizedError } from '../../../domain/errors/unauthorized-error'
import { ValidationError } from '../../../domain/errors/validation-error'
import { canEditLanding, type Actor } from '../../../domain/rules/landing-rules'

export type EditScope = 'block' | 'global'

export interface EditBlockWithAIInput {
  actor: Actor
  orgId: string
  landingId: string
  prompt: string
  scope: EditScope
  blockId?: string
}

export type AIProposal =
  | { kind: 'block'; blockId: string; blockType: string; data: Record<string, unknown> }
  | { kind: 'global'; blocks: Block[] }

export type AIProposalResult =
  | { status: 'ok'; proposal: AIProposal }
  | { status: 'error'; reason: 'schema_mismatch' | 'provider_error' | 'timeout'; detail?: string }

const MAX_PROMPT_CHARS = 500

export class EditBlockWithAIUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly ai: AIService,
  ) {}

  async execute(input: EditBlockWithAIInput): Promise<AIProposalResult> {
    if (input.prompt.length > MAX_PROMPT_CHARS) {
      throw new ValidationError(`El prompt no puede superar los ${MAX_PROMPT_CHARS} caracteres.`)
    }

    const landing = await this.landings.findById(input.landingId, input.orgId)
    if (!landing) throw new NotFoundError(`Landing no encontrada: ${input.landingId}`)
    if (!canEditLanding(input.actor, { agent_id: landing.agent_id, status: landing.status })) {
      throw new UnauthorizedError('No tenés permisos para editar esta landing')
    }

    if (input.scope === 'block') {
      if (!input.blockId) throw new ValidationError('scope=block requiere blockId')
      const block = landing.blocks.find(b => b.id === input.blockId)
      if (!block) throw new NotFoundError(`Bloque no encontrado: ${input.blockId}`)

      const res = await this.ai.editLandingBlock({
        blockType: block.type,
        blockData: block.data as Record<string, unknown>,
        prompt: input.prompt,
        brandVoice: landing.brand_voice,
      })

      if (res.status === 'error') return res
      return { status: 'ok', proposal: { kind: 'block', blockId: block.id, blockType: block.type, data: res.data } }
    }

    // scope=global
    const res = await this.ai.editLandingGlobal({
      blocks: landing.blocks,
      prompt: input.prompt,
      brandVoice: landing.brand_voice,
    })
    if (res.status === 'error') return res
    return { status: 'ok', proposal: { kind: 'global', blocks: res.blocks } }
  }
}
```

- [ ] **Step 3: Run test — expect PASS**

Run: `npm test -- --filter @vendepro/core --run tests/use-cases/landings/edit-block-with-ai.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 4: Commit**

```bash
git add vendepro-backend/packages/core/src/application/use-cases/landings/edit-block-with-ai.ts vendepro-backend/packages/core/tests/use-cases/landings/edit-block-with-ai.test.ts
git commit -m "feat(core): use-case EditBlockWithAI (scope=block|global) + tests"
```

---

## Task 14: Publish flow — RequestPublish, Publish, RejectPublishRequest

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/request-publish.ts`
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/publish-landing.ts`
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/reject-publish-request.ts`
- Test: `vendepro-backend/packages/core/tests/use-cases/landings/publish-landing.test.ts`

- [ ] **Step 1: Implement RequestPublish**

Create `vendepro-backend/packages/core/src/application/use-cases/landings/request-publish.ts`:

```typescript
import type { LandingRepository } from '../../ports/repositories/landing-repository'
import { NotFoundError } from '../../../domain/errors/not-found-error'
import { UnauthorizedError } from '../../../domain/errors/unauthorized-error'
import { canRequestPublish, type Actor } from '../../../domain/rules/landing-rules'

export class RequestPublishUseCase {
  constructor(private readonly landings: LandingRepository) {}

  async execute(input: { actor: Actor; orgId: string; landingId: string }): Promise<void> {
    const landing = await this.landings.findById(input.landingId, input.orgId)
    if (!landing) throw new NotFoundError(`Landing no encontrada: ${input.landingId}`)
    if (!canRequestPublish(input.actor, { agent_id: landing.agent_id, status: landing.status })) {
      throw new UnauthorizedError('No podés solicitar publicación (debe estar en draft y ser owner o admin).')
    }
    const next = landing.transitionStatus('pending_review').setReviewNote(null)
    await this.landings.save(next)
  }
}
```

- [ ] **Step 2: Implement Publish**

Create `vendepro-backend/packages/core/src/application/use-cases/landings/publish-landing.ts`:

```typescript
import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingVersionRepository } from '../../ports/repositories/landing-version-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { LandingVersion } from '../../../domain/entities/landing-version'
import { NotFoundError } from '../../../domain/errors/not-found-error'
import { UnauthorizedError } from '../../../domain/errors/unauthorized-error'
import { ValidationError } from '../../../domain/errors/validation-error'
import { canPublish, type Actor } from '../../../domain/rules/landing-rules'

export class PublishLandingUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly versions: LandingVersionRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: { actor: Actor; orgId: string; landingId: string }): Promise<{ versionId: string }> {
    if (!canPublish(input.actor)) throw new UnauthorizedError('Solo admin puede publicar.')
    const landing = await this.landings.findById(input.landingId, input.orgId)
    if (!landing) throw new NotFoundError(`Landing no encontrada: ${input.landingId}`)
    if (landing.status !== 'pending_review' && landing.status !== 'draft') {
      throw new ValidationError(`No se puede publicar desde status "${landing.status}".`)
    }

    const versionNumber = await this.versions.nextVersionNumber(landing.id)
    const version = LandingVersion.create({
      id: this.idGen.generate(),
      landing_id: landing.id,
      version_number: versionNumber,
      blocks: landing.blocks,
      label: 'publish',
      created_by: input.actor.userId,
    })
    await this.versions.save(version)

    // Force state to pending_review first if draft (keep transitions legal)
    const ready = landing.status === 'draft' ? landing.transitionStatus('pending_review') : landing
    const published = ready.markPublished({ version_id: version.id, published_by: input.actor.userId })
    await this.landings.save(published)

    return { versionId: version.id }
  }
}
```

- [ ] **Step 3: Implement RejectPublishRequest**

Create `vendepro-backend/packages/core/src/application/use-cases/landings/reject-publish-request.ts`:

```typescript
import type { LandingRepository } from '../../ports/repositories/landing-repository'
import { NotFoundError } from '../../../domain/errors/not-found-error'
import { UnauthorizedError } from '../../../domain/errors/unauthorized-error'
import { ValidationError } from '../../../domain/errors/validation-error'
import { canRejectPublishRequest, type Actor } from '../../../domain/rules/landing-rules'

export class RejectPublishRequestUseCase {
  constructor(private readonly landings: LandingRepository) {}

  async execute(input: { actor: Actor; orgId: string; landingId: string; note?: string }): Promise<void> {
    if (!canRejectPublishRequest(input.actor)) throw new UnauthorizedError('Solo admin puede rechazar.')
    const landing = await this.landings.findById(input.landingId, input.orgId)
    if (!landing) throw new NotFoundError(`Landing no encontrada: ${input.landingId}`)
    if (landing.status !== 'pending_review') {
      throw new ValidationError(`Solo se puede rechazar una landing en pending_review (actual: ${landing.status}).`)
    }
    const next = landing.transitionStatus('draft').setReviewNote(input.note ?? null)
    await this.landings.save(next)
  }
}
```

- [ ] **Step 4: Test publish flow**

Create `vendepro-backend/packages/core/tests/use-cases/landings/publish-landing.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { RequestPublishUseCase } from '../../../src/application/use-cases/landings/request-publish'
import { PublishLandingUseCase } from '../../../src/application/use-cases/landings/publish-landing'
import { RejectPublishRequestUseCase } from '../../../src/application/use-cases/landings/reject-publish-request'
import { Landing } from '../../../src/domain/entities/landing'
import { LandingVersion } from '../../../src/domain/entities/landing-version'
import type { Block } from '../../../src/domain/value-objects/block-schemas'

const blocks: Block[] = [
  { id: 'b_h', type: 'hero', visible: true, data: { title: 't', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 } },
  { id: 'b_f', type: 'lead-form', visible: true, data: { title: 'c', fields: [{ key: 'name', label: 'N', required: true }, { key: 'phone', label: 'T', required: true }], submit_label: 'E', success_message: 'ok' } },
]

function setup(status: 'draft'|'pending_review'|'published'|'archived' = 'draft') {
  const landing = Landing.create({ id: 'l1', org_id: 'o1', agent_id: 'u1', template_id: 't1', kind: 'property', slug_base: 'pal', slug_suffix: 'abc23', blocks })
  const current = status === 'draft' ? landing : landing.transitionStatus(status === 'published' ? 'pending_review' : status)
  const store = new Map<string, Landing>([['l1', status === 'published'
    ? current.markPublished({ version_id: 'v0', published_by: 'adm' })
    : current]])
  const versionStore: LandingVersion[] = []
  const landings = {
    findById: vi.fn(async () => store.get('l1') ?? null),
    save: vi.fn(async (l: Landing) => { store.set(l.id, l) }),
    findByFullSlug: vi.fn(), findByOrg: vi.fn(), existsFullSlug: vi.fn(),
  }
  const versions = {
    save: vi.fn(async (v: LandingVersion) => { versionStore.push(v) }),
    nextVersionNumber: vi.fn(async () => versionStore.length + 1),
    pruneNonPublish: vi.fn(), findById: vi.fn(), listByLanding: vi.fn(),
  }
  let n = 0
  const idGen = { generate: vi.fn(() => `id_${++n}`) }
  return { landings, versions, idGen, store, versionStore }
}

describe('publish flow', () => {
  it('request → pending_review', async () => {
    const d = setup('draft')
    await new RequestPublishUseCase(d.landings as any).execute({ actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', landingId: 'l1' })
    expect(d.store.get('l1')!.status).toBe('pending_review')
  })

  it('publish exige admin', async () => {
    const d = setup('pending_review')
    await expect(new PublishLandingUseCase(d.landings as any, d.versions as any, d.idGen as any)
      .execute({ actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', landingId: 'l1' }))
      .rejects.toThrow(/admin/i)
  })

  it('publish crea version publish y transiciona', async () => {
    const d = setup('pending_review')
    const r = await new PublishLandingUseCase(d.landings as any, d.versions as any, d.idGen as any)
      .execute({ actor: { role: 'admin', userId: 'adm' }, orgId: 'o1', landingId: 'l1' })
    expect(d.versionStore[0].label).toBe('publish')
    const saved = d.store.get('l1')!
    expect(saved.status).toBe('published')
    expect(saved.published_version_id).toBe(r.versionId)
    expect(saved.published_by).toBe('adm')
  })

  it('reject vuelve a draft con nota', async () => {
    const d = setup('pending_review')
    await new RejectPublishRequestUseCase(d.landings as any)
      .execute({ actor: { role: 'admin', userId: 'adm' }, orgId: 'o1', landingId: 'l1', note: 'falta cambiar título' })
    const saved = d.store.get('l1')!
    expect(saved.status).toBe('draft')
    expect(saved.last_review_note).toBe('falta cambiar título')
  })

  it('reject solo desde pending_review', async () => {
    const d = setup('draft')
    await expect(new RejectPublishRequestUseCase(d.landings as any)
      .execute({ actor: { role: 'admin', userId: 'adm' }, orgId: 'o1', landingId: 'l1' }))
      .rejects.toThrow(/pending_review/i)
  })
})
```

- [ ] **Step 5: Run tests**

Run: `npm test -- --filter @vendepro/core --run tests/use-cases/landings/publish-landing.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add vendepro-backend/packages/core/src/application/use-cases/landings/ vendepro-backend/packages/core/tests/use-cases/landings/publish-landing.test.ts
git commit -m "feat(core): publish flow (request, publish, reject) + tests"
```

---

## Task 15: Use-cases — Archive, Unarchive, Rollback

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/archive-landing.ts`
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/unarchive-landing.ts`
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/rollback-landing.ts`
- Test: `vendepro-backend/packages/core/tests/use-cases/landings/rollback-landing.test.ts`

- [ ] **Step 1: Implement Archive and Unarchive**

Create `vendepro-backend/packages/core/src/application/use-cases/landings/archive-landing.ts`:

```typescript
import type { LandingRepository } from '../../ports/repositories/landing-repository'
import { NotFoundError } from '../../../domain/errors/not-found-error'
import { UnauthorizedError } from '../../../domain/errors/unauthorized-error'
import { canArchive, type Actor } from '../../../domain/rules/landing-rules'

export class ArchiveLandingUseCase {
  constructor(private readonly landings: LandingRepository) {}

  async execute(input: { actor: Actor; orgId: string; landingId: string }): Promise<void> {
    const landing = await this.landings.findById(input.landingId, input.orgId)
    if (!landing) throw new NotFoundError(`Landing no encontrada: ${input.landingId}`)
    if (!canArchive(input.actor, { agent_id: landing.agent_id })) throw new UnauthorizedError()
    const next = landing.status === 'published'
      ? landing.transitionStatus('draft').transitionStatus('archived')
      : landing.transitionStatus('archived')
    await this.landings.save(next)
  }
}
```

Wait — the status machine doesn't allow `published → archived` via a single step, right? Checking `landing-rules.ts`: `published: ['archived', 'draft']`. Yes it does. Simplify:

Replace the body with:

```typescript
  async execute(input: { actor: Actor; orgId: string; landingId: string }): Promise<void> {
    const landing = await this.landings.findById(input.landingId, input.orgId)
    if (!landing) throw new NotFoundError(`Landing no encontrada: ${input.landingId}`)
    if (!canArchive(input.actor, { agent_id: landing.agent_id })) throw new UnauthorizedError()
    // Todos los estados con transición válida a 'archived' son draft y published (según landing-status.ts)
    const from = landing.status
    if (from === 'pending_review') {
      // bajamos a draft primero (admin rechaza la solicitud implícita al archivar)
      const interim = landing.transitionStatus('draft')
      await this.landings.save(interim.transitionStatus('archived'))
    } else {
      await this.landings.save(landing.transitionStatus('archived'))
    }
  }
```

Create `vendepro-backend/packages/core/src/application/use-cases/landings/unarchive-landing.ts`:

```typescript
import type { LandingRepository } from '../../ports/repositories/landing-repository'
import { NotFoundError } from '../../../domain/errors/not-found-error'
import { UnauthorizedError } from '../../../domain/errors/unauthorized-error'
import { canArchive, type Actor } from '../../../domain/rules/landing-rules'

export class UnarchiveLandingUseCase {
  constructor(private readonly landings: LandingRepository) {}

  async execute(input: { actor: Actor; orgId: string; landingId: string }): Promise<void> {
    const landing = await this.landings.findById(input.landingId, input.orgId)
    if (!landing) throw new NotFoundError(`Landing no encontrada: ${input.landingId}`)
    if (!canArchive(input.actor, { agent_id: landing.agent_id })) throw new UnauthorizedError()
    if (landing.status !== 'archived') return
    await this.landings.save(landing.transitionStatus('draft'))
  }
}
```

- [ ] **Step 2: Implement Rollback**

Create `vendepro-backend/packages/core/src/application/use-cases/landings/rollback-landing.ts`:

```typescript
import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingVersionRepository } from '../../ports/repositories/landing-version-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { LandingVersion } from '../../../domain/entities/landing-version'
import { NotFoundError } from '../../../domain/errors/not-found-error'
import { UnauthorizedError } from '../../../domain/errors/unauthorized-error'
import { canRollback, type Actor } from '../../../domain/rules/landing-rules'

export class RollbackLandingUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly versions: LandingVersionRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: { actor: Actor; orgId: string; landingId: string; versionId: string }): Promise<{ versionNumber: number }> {
    const landing = await this.landings.findById(input.landingId, input.orgId)
    if (!landing) throw new NotFoundError(`Landing no encontrada: ${input.landingId}`)
    if (!canRollback(input.actor, { agent_id: landing.agent_id, status: landing.status })) {
      throw new UnauthorizedError('No podés hacer rollback de esta landing.')
    }
    const target = await this.versions.findById(input.versionId)
    if (!target || target.landing_id !== landing.id) {
      throw new NotFoundError(`Versión no encontrada: ${input.versionId}`)
    }
    const updated = landing.replaceBlocks(target.blocks)
    await this.landings.save(updated)

    const nextNum = await this.versions.nextVersionNumber(landing.id)
    const newVersion = LandingVersion.create({
      id: this.idGen.generate(),
      landing_id: landing.id,
      version_number: nextNum,
      blocks: updated.blocks,
      label: 'manual-save',
      created_by: input.actor.userId,
    })
    await this.versions.save(newVersion)
    return { versionNumber: newVersion.version_number }
  }
}
```

- [ ] **Step 3: Test rollback**

Create `vendepro-backend/packages/core/tests/use-cases/landings/rollback-landing.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { RollbackLandingUseCase } from '../../../src/application/use-cases/landings/rollback-landing'
import { Landing } from '../../../src/domain/entities/landing'
import { LandingVersion } from '../../../src/domain/entities/landing-version'
import type { Block } from '../../../src/domain/value-objects/block-schemas'

const blocks: Block[] = [
  { id: 'b_h', type: 'hero', visible: true, data: { title: 'actual', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 } },
  { id: 'b_f', type: 'lead-form', visible: true, data: { title: 'c', fields: [{ key: 'name', label: 'N', required: true }, { key: 'phone', label: 'T', required: true }], submit_label: 'E', success_message: 'ok' } },
]
const oldBlocks: Block[] = [
  { ...blocks[0], data: { ...blocks[0].data, title: 'viejo' } } as Block,
  blocks[1],
]

function setup() {
  const landing = Landing.create({ id: 'l1', org_id: 'o1', agent_id: 'u1', template_id: 't1', kind: 'property', slug_base: 'pal', slug_suffix: 'abc23', blocks })
  const store = new Map<string, Landing>([['l1', landing]])
  const targetVersion = LandingVersion.create({ id: 'v_old', landing_id: 'l1', version_number: 3, blocks: oldBlocks, label: 'manual-save', created_by: 'u1' })
  const verStore: LandingVersion[] = [targetVersion]
  const landings = { findById: vi.fn(async () => store.get('l1') ?? null), save: vi.fn(async (l: Landing) => { store.set(l.id, l) }), findByFullSlug: vi.fn(), findByOrg: vi.fn(), existsFullSlug: vi.fn() }
  const versions = {
    findById: vi.fn(async (id: string) => verStore.find(v => v.id === id) ?? null),
    save: vi.fn(async (v: LandingVersion) => { verStore.push(v) }),
    nextVersionNumber: vi.fn(async () => verStore.length + 1),
    pruneNonPublish: vi.fn(), listByLanding: vi.fn(),
  }
  let n = 0
  const idGen = { generate: vi.fn(() => `id_${++n}`) }
  return { landings, versions, idGen, store, verStore }
}

describe('RollbackLandingUseCase', () => {
  it('restaura bloques de la versión target y crea nueva versión', async () => {
    const d = setup()
    const uc = new RollbackLandingUseCase(d.landings as any, d.versions as any, d.idGen as any)
    const r = await uc.execute({ actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', landingId: 'l1', versionId: 'v_old' })
    expect((d.store.get('l1')!.blocks[0].data as any).title).toBe('viejo')
    expect(r.versionNumber).toBeGreaterThan(3)
    expect(d.verStore.length).toBe(2)
  })

  it('rechaza si la versión pertenece a otra landing', async () => {
    const d = setup()
    d.versions.findById = vi.fn(async () => LandingVersion.create({ id: 'v_x', landing_id: 'OTHER', version_number: 1, blocks: oldBlocks, label: 'manual-save', created_by: 'u1' }))
    const uc = new RollbackLandingUseCase(d.landings as any, d.versions as any, d.idGen as any)
    await expect(uc.execute({ actor: { role: 'agent', userId: 'u1' }, orgId: 'o1', landingId: 'l1', versionId: 'v_x' }))
      .rejects.toThrow(/no encontrada/i)
  })
})
```

- [ ] **Step 4: Run tests**

Run: `npm test -- --filter @vendepro/core --run tests/use-cases/landings/rollback-landing.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add vendepro-backend/packages/core/src/application/use-cases/landings/ vendepro-backend/packages/core/tests/use-cases/landings/rollback-landing.test.ts
git commit -m "feat(core): archive, unarchive, rollback use-cases + tests"
```

---

## Task 16: Use-cases — SubmitLeadFromLanding + RecordLandingEvent + GetPublicLanding

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/submit-lead-from-landing.ts`
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/record-landing-event.ts`
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/get-public-landing.ts`
- Test: `vendepro-backend/packages/core/tests/use-cases/landings/submit-lead-from-landing.test.ts`
- Test: `vendepro-backend/packages/core/tests/use-cases/landings/get-public-landing.test.ts`

- [ ] **Step 1: Implement GetPublicLanding**

Create `vendepro-backend/packages/core/src/application/use-cases/landings/get-public-landing.ts`:

```typescript
import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingVersionRepository } from '../../ports/repositories/landing-version-repository'
import type { Block } from '../../../domain/value-objects/block-schemas'
import { NotFoundError } from '../../../domain/errors/not-found-error'

export interface PublicLandingView {
  id: string
  full_slug: string
  kind: 'lead_capture' | 'property'
  blocks: Block[]
  seo_title: string | null
  seo_description: string | null
  og_image_url: string | null
  published_at: string
}

export class GetPublicLandingUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly versions: LandingVersionRepository,
  ) {}

  async execute(input: { fullSlug: string }): Promise<PublicLandingView> {
    const landing = await this.landings.findByFullSlug(input.fullSlug)
    if (!landing) throw new NotFoundError('Landing no encontrada')
    if (landing.status !== 'published' || !landing.published_version_id || !landing.published_at) {
      throw new NotFoundError('Landing no publicada')
    }
    const version = await this.versions.findById(landing.published_version_id)
    if (!version) throw new NotFoundError('Versión publicada no encontrada')

    return {
      id: landing.id,
      full_slug: landing.full_slug,
      kind: landing.kind,
      blocks: version.blocks.filter(b => b.visible),
      seo_title: landing.seo_title,
      seo_description: landing.seo_description,
      og_image_url: landing.og_image_url,
      published_at: landing.published_at,
    }
  }
}
```

- [ ] **Step 2: Implement RecordLandingEvent**

Create `vendepro-backend/packages/core/src/application/use-cases/landings/record-landing-event.ts`:

```typescript
import { LandingEvent, type LandingEventType } from '../../../domain/entities/landing-event'
import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingEventRepository } from '../../ports/repositories/landing-event-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { NotFoundError } from '../../../domain/errors/not-found-error'

export interface RecordEventInput {
  fullSlug: string
  eventType: LandingEventType
  visitorId?: string | null
  sessionId?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  referrer?: string | null
  userAgent?: string | null
}

export class RecordLandingEventUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly events: LandingEventRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: RecordEventInput): Promise<void> {
    const landing = await this.landings.findByFullSlug(input.fullSlug)
    if (!landing || landing.status !== 'published') {
      throw new NotFoundError('Landing no disponible')
    }
    const ev = LandingEvent.create({
      id: this.idGen.generate(),
      landing_id: landing.id,
      slug: landing.full_slug,
      event_type: input.eventType,
      visitor_id: input.visitorId ?? null,
      session_id: input.sessionId ?? null,
      utm_source: input.utmSource ?? null,
      utm_medium: input.utmMedium ?? null,
      utm_campaign: input.utmCampaign ?? null,
      referrer: input.referrer ?? null,
      user_agent: input.userAgent ?? null,
    })
    await this.events.save(ev)
  }
}
```

- [ ] **Step 3: Implement SubmitLeadFromLanding**

This use case integra con el existente `LeadRepository` y `IdGenerator`. También dispara email notification si está configurado.

Create `vendepro-backend/packages/core/src/application/use-cases/landings/submit-lead-from-landing.ts`:

```typescript
import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingEventRepository } from '../../ports/repositories/landing-event-repository'
import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { IdGenerator } from '../../ports/id-generator'
import type { EmailService } from '../../ports/services/email-service'
import { Lead } from '../../../domain/entities/lead'
import { LandingEvent } from '../../../domain/entities/landing-event'
import { NotFoundError } from '../../../domain/errors/not-found-error'
import { ValidationError } from '../../../domain/errors/validation-error'

export interface SubmitLandingFormInput {
  fullSlug: string
  fields: { name: string; phone: string; email?: string | null; address?: string | null; message?: string | null }
  visitorId?: string | null
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null; referrer?: string | null }
}

export interface SubmitLandingFormOutput {
  leadId: string
  successMessage: string
}

const DEFAULT_SUCCESS = '¡Gracias! Nos pondremos en contacto a la brevedad.'

export class SubmitLeadFromLandingUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly events: LandingEventRepository,
    private readonly leads: LeadRepository,
    private readonly idGen: IdGenerator,
    private readonly email?: EmailService,     // opcional: si hay notify_channels.email
  ) {}

  async execute(input: SubmitLandingFormInput): Promise<SubmitLandingFormOutput> {
    const landing = await this.landings.findByFullSlug(input.fullSlug)
    if (!landing || landing.status !== 'published') throw new NotFoundError('Landing no disponible')

    if (!input.fields.name?.trim()) throw new ValidationError('Nombre es requerido')
    if (!input.fields.phone?.trim()) throw new ValidationError('Teléfono es requerido')

    const rules = landing.lead_rules ?? {}
    const assignedTo = rules.assigned_agent_id ?? landing.agent_id

    const lead = Lead.create({
      id: this.idGen.generate(),
      org_id: landing.org_id,
      full_name: input.fields.name.trim(),
      phone: input.fields.phone.trim(),
      email: input.fields.email ?? null,
      source: `landing:${landing.full_slug}`,
      source_detail: rules.campaign ?? null,
      property_address: input.fields.address ?? null,
      neighborhood: null,
      property_type: 'departamento',
      operation: landing.kind === 'lead_capture' ? 'tasacion' : 'venta',
      stage: 'nuevo',
      assigned_to: assignedTo,
      notes: input.fields.message ?? null,
      estimated_value: null,
      budget: null,
      timing: null,
      personas_trabajo: null,
      mascotas: null,
      next_step: null,
      next_step_date: null,
      lost_reason: null,
      first_contact_at: null,
      contact_id: null,
    })
    await this.leads.save(lead)

    // Event form_submit
    const ev = LandingEvent.create({
      id: this.idGen.generate(),
      landing_id: landing.id,
      slug: landing.full_slug,
      event_type: 'form_submit',
      visitor_id: input.visitorId ?? null,
      session_id: null,
      utm_source: input.utm?.source ?? null,
      utm_medium: input.utm?.medium ?? null,
      utm_campaign: input.utm?.campaign ?? null,
      referrer: input.utm?.referrer ?? null,
      user_agent: null,
    })
    await this.events.save(ev)

    // Notificación si está configurada
    if (rules.notify_channels?.includes('email') && this.email) {
      try {
        await this.email.sendTransactional({
          to: assignedTo, // En la impl real el repo de users provee el email — por ahora se pasa user_id
          subject: `Nuevo lead desde landing ${landing.full_slug}`,
          html: `<p>Lead: <strong>${lead.toObject().full_name}</strong> · ${lead.toObject().phone}</p>`,
        } as any)
      } catch { /* swallow: la notificación no debe romper el submit */ }
    }

    // Success message: de haberlo configurado el lead-form del template
    const leadFormBlock = landing.blocks.find(b => b.type === 'lead-form')
    const successMessage = (leadFormBlock?.data as any)?.success_message ?? DEFAULT_SUCCESS

    return { leadId: lead.id, successMessage }
  }
}
```

**Nota sobre EmailService:** la interfaz real puede diferir — si `sendTransactional` no existe, reemplazar por el método que exponga el port (`send`, `sendEmail`, etc.). Chequear `vendepro-backend/packages/core/src/application/ports/services/email-service.ts` antes de implementar y ajustar los argumentos en consecuencia.

- [ ] **Step 4: Test submit-lead**

Create `vendepro-backend/packages/core/tests/use-cases/landings/submit-lead-from-landing.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { SubmitLeadFromLandingUseCase } from '../../../src/application/use-cases/landings/submit-lead-from-landing'
import { Landing } from '../../../src/domain/entities/landing'
import type { Block } from '../../../src/domain/value-objects/block-schemas'
import { Lead } from '../../../src/domain/entities/lead'

const blocks: Block[] = [
  { id: 'b_h', type: 'hero', visible: true, data: { title: 't', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 } },
  { id: 'b_f', type: 'lead-form', visible: true, data: { title: 'c', fields: [{ key: 'name', label: 'N', required: true }, { key: 'phone', label: 'T', required: true }], submit_label: 'E', success_message: '¡Listo!' } },
]

function setup(options?: { ruleAgent?: string }) {
  const base = Landing.create({ id: 'l1', org_id: 'o1', agent_id: 'u1', template_id: 't1', kind: 'property', slug_base: 'pal', slug_suffix: 'abc23', blocks, lead_rules: options?.ruleAgent ? { assigned_agent_id: options.ruleAgent } : null })
  const published = base.transitionStatus('pending_review').markPublished({ version_id: 'v0', published_by: 'adm' })
  const landings = { findByFullSlug: vi.fn(async () => published), findById: vi.fn(), findByOrg: vi.fn(), save: vi.fn(), existsFullSlug: vi.fn() }
  const events = { save: vi.fn(), countByIpInWindow: vi.fn(), summary: vi.fn(), recentByType: vi.fn() }
  const savedLeads: Lead[] = []
  const leads = { save: vi.fn(async (l: Lead) => { savedLeads.push(l) }), findById: vi.fn(), findByOrg: vi.fn(), delete: vi.fn(), searchByName: vi.fn(), findPendingFollowups: vi.fn(), exportAllWithAssignedName: vi.fn() }
  let n = 0
  const idGen = { generate: vi.fn(() => `id_${++n}`) }
  return { landings, events, leads, idGen, savedLeads }
}

describe('SubmitLeadFromLandingUseCase', () => {
  it('crea lead y event, retorna success message', async () => {
    const d = setup()
    const uc = new SubmitLeadFromLandingUseCase(d.landings as any, d.events as any, d.leads as any, d.idGen as any)
    const r = await uc.execute({ fullSlug: 'pal-abc23', fields: { name: 'Juan', phone: '1122334455' } })
    expect(r.successMessage).toBe('¡Listo!')
    expect(d.leads.save).toHaveBeenCalled()
    expect(d.events.save).toHaveBeenCalled()
    expect(d.savedLeads[0].toObject().source).toBe('landing:pal-abc23')
    expect(d.savedLeads[0].toObject().assigned_to).toBe('u1')
  })

  it('respeta lead_rules.assigned_agent_id', async () => {
    const d = setup({ ruleAgent: 'u_assigned' })
    const uc = new SubmitLeadFromLandingUseCase(d.landings as any, d.events as any, d.leads as any, d.idGen as any)
    await uc.execute({ fullSlug: 'pal-abc23', fields: { name: 'Ana', phone: '123' } })
    expect(d.savedLeads[0].toObject().assigned_to).toBe('u_assigned')
  })

  it('rechaza si landing no publicada', async () => {
    const d = setup()
    d.landings.findByFullSlug = vi.fn(async () => null)
    const uc = new SubmitLeadFromLandingUseCase(d.landings as any, d.events as any, d.leads as any, d.idGen as any)
    await expect(uc.execute({ fullSlug: 'xxx', fields: { name: 'x', phone: 'y' } })).rejects.toThrow()
  })

  it('requiere name y phone', async () => {
    const d = setup()
    const uc = new SubmitLeadFromLandingUseCase(d.landings as any, d.events as any, d.leads as any, d.idGen as any)
    await expect(uc.execute({ fullSlug: 'pal-abc23', fields: { name: '', phone: '1' } })).rejects.toThrow(/Nombre/)
    await expect(uc.execute({ fullSlug: 'pal-abc23', fields: { name: 'a', phone: '' } })).rejects.toThrow(/Tel/)
  })
})
```

- [ ] **Step 5: Run tests**

Run: `npm test -- --filter @vendepro/core --run tests/use-cases/landings/submit-lead-from-landing.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add vendepro-backend/packages/core/src/application/use-cases/landings/ vendepro-backend/packages/core/tests/use-cases/landings/submit-lead-from-landing.test.ts
git commit -m "feat(core): submit-lead, record-event, get-public-landing use-cases + tests"
```

---

## Task 17: Use-cases — Template management + Listings + Analytics

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/list-templates.ts`
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/create-template.ts`
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/update-template.ts`
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/list-landings.ts`
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/get-landing.ts`
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/update-landing-metadata.ts`
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/get-landing-analytics.ts`
- Create: `vendepro-backend/packages/core/src/application/use-cases/landings/index.ts`

- [ ] **Step 1: Implement listings + getter use-cases**

Create `vendepro-backend/packages/core/src/application/use-cases/landings/list-templates.ts`:

```typescript
import type { LandingTemplateRepository } from '../../ports/repositories/landing-template-repository'
import type { LandingKind } from '../../../domain/entities/landing'

export class ListTemplatesUseCase {
  constructor(private readonly templates: LandingTemplateRepository) {}
  async execute(input: { orgId: string; kind?: LandingKind }) {
    return this.templates.listVisibleTo(input.orgId, { kind: input.kind, onlyActive: true })
  }
}
```

Create `vendepro-backend/packages/core/src/application/use-cases/landings/create-template.ts`:

```typescript
import type { LandingTemplateRepository } from '../../ports/repositories/landing-template-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { LandingTemplate } from '../../../domain/entities/landing-template'
import type { LandingKind } from '../../../domain/entities/landing'
import type { Block } from '../../../domain/value-objects/block-schemas'
import { UnauthorizedError } from '../../../domain/errors/unauthorized-error'
import { canManageTemplates, type Actor } from '../../../domain/rules/landing-rules'

export class CreateTemplateUseCase {
  constructor(
    private readonly templates: LandingTemplateRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: {
    actor: Actor
    orgId: string | null           // null = global (solo sysadmin). Por ahora admin solo puede crear org-scoped
    name: string
    kind: LandingKind
    description?: string | null
    previewImageUrl?: string | null
    blocks: Block[]
    sortOrder?: number
  }): Promise<{ templateId: string }> {
    if (!canManageTemplates(input.actor)) throw new UnauthorizedError('Solo admin puede crear templates.')

    const tpl = LandingTemplate.create({
      id: this.idGen.generate(),
      org_id: input.orgId,
      name: input.name,
      kind: input.kind,
      description: input.description ?? null,
      preview_image_url: input.previewImageUrl ?? null,
      blocks: input.blocks,
      active: true,
      sort_order: input.sortOrder ?? 100,
    })
    await this.templates.save(tpl)
    return { templateId: tpl.id }
  }
}
```

Create `vendepro-backend/packages/core/src/application/use-cases/landings/update-template.ts`:

```typescript
import type { LandingTemplateRepository } from '../../ports/repositories/landing-template-repository'
import { LandingTemplate } from '../../../domain/entities/landing-template'
import type { Block } from '../../../domain/value-objects/block-schemas'
import { NotFoundError } from '../../../domain/errors/not-found-error'
import { UnauthorizedError } from '../../../domain/errors/unauthorized-error'
import { canManageTemplates, type Actor } from '../../../domain/rules/landing-rules'

export class UpdateTemplateUseCase {
  constructor(private readonly templates: LandingTemplateRepository) {}

  async execute(input: {
    actor: Actor
    orgId: string
    templateId: string
    patch: Partial<{ name: string; description: string | null; preview_image_url: string | null; blocks: Block[]; active: boolean; sort_order: number }>
  }): Promise<void> {
    if (!canManageTemplates(input.actor)) throw new UnauthorizedError()
    const tpl = await this.templates.findById(input.templateId)
    if (!tpl) throw new NotFoundError(`Template no encontrado: ${input.templateId}`)
    if (tpl.org_id !== null && tpl.org_id !== input.orgId) throw new UnauthorizedError('Fuera de alcance multi-tenant')

    const obj = tpl.toObject()
    const merged = { ...obj, ...input.patch, updated_at: new Date().toISOString() }
    const next = LandingTemplate.create(merged)
    await this.templates.save(next)
  }
}
```

Create `vendepro-backend/packages/core/src/application/use-cases/landings/list-landings.ts`:

```typescript
import type { LandingRepository, LandingFilters } from '../../ports/repositories/landing-repository'
import type { Actor } from '../../../domain/rules/landing-rules'

export class ListLandingsUseCase {
  constructor(private readonly landings: LandingRepository) {}

  async execute(input: { actor: Actor; orgId: string; scope?: 'mine' | 'org' | 'pending_review'; filters?: LandingFilters }) {
    const { actor, orgId, scope = 'mine', filters = {} } = input
    if (scope === 'org') {
      // solo admin puede ver todas
      if (actor.role !== 'admin') throw new Error('Solo admin puede listar todas las landings del org')
      return this.landings.findByOrg(orgId, filters)
    }
    if (scope === 'pending_review') {
      if (actor.role !== 'admin') throw new Error('Solo admin ve pendientes de revisión')
      return this.landings.findByOrg(orgId, { ...filters, status: 'pending_review' })
    }
    return this.landings.findByOrg(orgId, { ...filters, agent_id: actor.userId })
  }
}
```

Create `vendepro-backend/packages/core/src/application/use-cases/landings/get-landing.ts`:

```typescript
import type { LandingRepository } from '../../ports/repositories/landing-repository'
import { NotFoundError } from '../../../domain/errors/not-found-error'
import { UnauthorizedError } from '../../../domain/errors/unauthorized-error'
import type { Actor } from '../../../domain/rules/landing-rules'

export class GetLandingUseCase {
  constructor(private readonly landings: LandingRepository) {}
  async execute(input: { actor: Actor; orgId: string; landingId: string }) {
    const l = await this.landings.findById(input.landingId, input.orgId)
    if (!l) throw new NotFoundError('Landing no encontrada')
    if (input.actor.role !== 'admin' && l.agent_id !== input.actor.userId) throw new UnauthorizedError()
    return l
  }
}
```

Create `vendepro-backend/packages/core/src/application/use-cases/landings/update-landing-metadata.ts`:

```typescript
import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LeadRules } from '../../../domain/entities/landing'
import { NotFoundError } from '../../../domain/errors/not-found-error'
import { UnauthorizedError } from '../../../domain/errors/unauthorized-error'
import { canEditLanding, type Actor } from '../../../domain/rules/landing-rules'

export class UpdateLandingMetadataUseCase {
  constructor(private readonly landings: LandingRepository) {}

  async execute(input: {
    actor: Actor
    orgId: string
    landingId: string
    patch: Partial<{ brand_voice: string | null; lead_rules: LeadRules | null; seo_title: string | null; seo_description: string | null; og_image_url: string | null; slug_base: string }>
  }): Promise<void> {
    const l = await this.landings.findById(input.landingId, input.orgId)
    if (!l) throw new NotFoundError('Landing no encontrada')
    if (!canEditLanding(input.actor, { agent_id: l.agent_id, status: l.status })) throw new UnauthorizedError()

    // Si cambia slug_base, validar unicidad del nuevo full_slug
    if (input.patch.slug_base && input.patch.slug_base !== l.slug_base) {
      const nextFull = `${input.patch.slug_base}-${l.slug_suffix}`
      if (await this.landings.existsFullSlug(nextFull)) {
        throw new Error(`El slug "${input.patch.slug_base}" colisiona. Elegí otro.`)
      }
    }
    const updated = l.updateMetadata(input.patch)
    await this.landings.save(updated)
  }
}
```

Create `vendepro-backend/packages/core/src/application/use-cases/landings/get-landing-analytics.ts`:

```typescript
import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingEventRepository, AnalyticsSummary } from '../../ports/repositories/landing-event-repository'
import { NotFoundError } from '../../../domain/errors/not-found-error'
import { UnauthorizedError } from '../../../domain/errors/unauthorized-error'
import type { Actor } from '../../../domain/rules/landing-rules'

export class GetLandingAnalyticsUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly events: LandingEventRepository,
  ) {}

  async execute(input: { actor: Actor; orgId: string; landingId: string; rangeDays: 7 | 14 | 30 }): Promise<AnalyticsSummary> {
    const l = await this.landings.findById(input.landingId, input.orgId)
    if (!l) throw new NotFoundError('Landing no encontrada')
    if (input.actor.role !== 'admin' && l.agent_id !== input.actor.userId) throw new UnauthorizedError()

    const until = new Date()
    const since = new Date(until.getTime() - input.rangeDays * 24 * 60 * 60 * 1000)
    return this.events.summary(l.id, { since: since.toISOString(), until: until.toISOString() })
  }
}
```

- [ ] **Step 2: Create barrel index**

Create `vendepro-backend/packages/core/src/application/use-cases/landings/index.ts`:

```typescript
export * from './create-landing-from-template'
export * from './update-landing-blocks'
export * from './add-block'
export * from './remove-block'
export * from './reorder-blocks'
export * from './toggle-block-visibility'
export * from './edit-block-with-ai'
export * from './request-publish'
export * from './publish-landing'
export * from './reject-publish-request'
export * from './archive-landing'
export * from './unarchive-landing'
export * from './rollback-landing'
export * from './record-landing-event'
export * from './submit-lead-from-landing'
export * from './list-templates'
export * from './create-template'
export * from './update-template'
export * from './list-landings'
export * from './get-landing'
export * from './update-landing-metadata'
export * from './get-landing-analytics'
export * from './get-public-landing'
```

Modify `vendepro-backend/packages/core/src/application/use-cases/index.ts` — append `export * from './landings'`.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck -- --filter @vendepro/core`
Expected: no errors.

- [ ] **Step 4: Run all core tests**

Run: `npm test -- --filter @vendepro/core`
Expected: todos verdes.

- [ ] **Step 5: Commit**

```bash
git add vendepro-backend/packages/core/src/application/use-cases/landings/
git commit -m "feat(core): template management, listings, analytics use-cases"
```

> **Sobre la notificación por email en `SubmitLeadFromLanding`:** la interfaz actual `EmailService.send({ to: { email, name }, ... })` requiere el email del agente asignado. Obtenerlo necesita una lookup adicional a `UserRepository`. En el código de la Task 16 se dejó una llamada aproximada que fallará el typecheck: al ejecutar esta task, **eliminar el bloque de notificación por email completo** (queda como follow-up en Fase C, cuando el frontend también lo pida). La alternativa v1 es: el agente ve el lead en el CRM en tiempo real al refrescar (como con cualquier otro lead).

Patch sugerido: borrar las líneas `if (rules.notify_channels?.includes('email') && this.email) { ... }` y remover el parámetro `email?: EmailService` del constructor.

---

## Task 18: D1LandingRepository

**Files:**
- Create: `vendepro-backend/packages/infrastructure/src/repositories/d1-landing-repository.ts`
- Test: `vendepro-backend/packages/infrastructure/tests/repositories/d1-landing-repository.test.ts`

- [ ] **Step 1: Implement the adapter**

Create `vendepro-backend/packages/infrastructure/src/repositories/d1-landing-repository.ts`:

```typescript
import { Landing, type LandingKind, type LeadRules } from '@vendepro/core'
import type { LandingRepository, LandingFilters } from '@vendepro/core'
import type { LandingStatusValue } from '@vendepro/core'
import type { Block } from '@vendepro/core'

export class D1LandingRepository implements LandingRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string, orgId: string): Promise<Landing | null> {
    const row = await this.db
      .prepare(`SELECT * FROM landings WHERE id = ? AND org_id = ?`)
      .bind(id, orgId).first() as any
    return row ? this.toEntity(row) : null
  }

  async findByFullSlug(fullSlug: string): Promise<Landing | null> {
    const row = await this.db
      .prepare(`SELECT * FROM landings WHERE full_slug = ?`)
      .bind(fullSlug).first() as any
    return row ? this.toEntity(row) : null
  }

  async findByOrg(orgId: string, filters?: LandingFilters): Promise<Landing[]> {
    let q = `SELECT * FROM landings WHERE org_id = ?`
    const binds: unknown[] = [orgId]
    if (filters?.agent_id) { q += ` AND agent_id = ?`; binds.push(filters.agent_id) }
    if (filters?.kind) { q += ` AND kind = ?`; binds.push(filters.kind) }
    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        q += ` AND status IN (${filters.status.map(() => '?').join(',')})`
        binds.push(...filters.status)
      } else {
        q += ` AND status = ?`; binds.push(filters.status)
      }
    }
    q += ` ORDER BY updated_at DESC LIMIT 200`
    const rows = (await this.db.prepare(q).bind(...binds).all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async save(landing: Landing): Promise<void> {
    const o = landing.toObject()
    await this.db.prepare(`
      INSERT INTO landings (id, org_id, agent_id, template_id, kind, slug_base, slug_suffix, full_slug,
        status, blocks_json, brand_voice, lead_rules_json, seo_title, seo_description, og_image_url,
        published_version_id, published_at, published_by, last_review_note, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        slug_base=excluded.slug_base,
        slug_suffix=excluded.slug_suffix,
        full_slug=excluded.full_slug,
        status=excluded.status,
        blocks_json=excluded.blocks_json,
        brand_voice=excluded.brand_voice,
        lead_rules_json=excluded.lead_rules_json,
        seo_title=excluded.seo_title,
        seo_description=excluded.seo_description,
        og_image_url=excluded.og_image_url,
        published_version_id=excluded.published_version_id,
        published_at=excluded.published_at,
        published_by=excluded.published_by,
        last_review_note=excluded.last_review_note,
        updated_at=excluded.updated_at
    `).bind(
      o.id, o.org_id, o.agent_id, o.template_id, o.kind, o.slug_base, o.slug_suffix, `${o.slug_base}-${o.slug_suffix}`,
      o.status, JSON.stringify(o.blocks), o.brand_voice, o.lead_rules ? JSON.stringify(o.lead_rules) : null,
      o.seo_title, o.seo_description, o.og_image_url,
      o.published_version_id, o.published_at, o.published_by, o.last_review_note,
      o.created_at, o.updated_at,
    ).run()
  }

  async existsFullSlug(fullSlug: string): Promise<boolean> {
    const r = await this.db.prepare(`SELECT 1 AS ok FROM landings WHERE full_slug = ? LIMIT 1`).bind(fullSlug).first() as any
    return !!r
  }

  private toEntity(row: any): Landing {
    const blocks = JSON.parse(row.blocks_json) as Block[]
    const leadRules: LeadRules | null = row.lead_rules_json ? JSON.parse(row.lead_rules_json) : null
    return Landing.fromPersistence({
      id: row.id,
      org_id: row.org_id,
      agent_id: row.agent_id,
      template_id: row.template_id,
      kind: row.kind as LandingKind,
      slug_base: row.slug_base,
      slug_suffix: row.slug_suffix,
      status: row.status as LandingStatusValue,
      blocks,
      brand_voice: row.brand_voice,
      lead_rules: leadRules,
      seo_title: row.seo_title,
      seo_description: row.seo_description,
      og_image_url: row.og_image_url,
      published_version_id: row.published_version_id,
      published_at: row.published_at,
      published_by: row.published_by,
      last_review_note: row.last_review_note,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }
}
```

- [ ] **Step 2: Write integration test**

Create `vendepro-backend/packages/infrastructure/tests/repositories/d1-landing-repository.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1LandingRepository } from '../../src/repositories/d1-landing-repository'
import { Landing } from '@vendepro/core'

async function seedTemplate(db: D1Database, id: string) {
  await db.prepare(`INSERT INTO landing_templates (id, org_id, name, kind, blocks_json, active, sort_order)
    VALUES (?, NULL, 'T', 'property', '{"placeholder":true}', 1, 1)`).bind(id).run()
}

const HERO = { id: 'b_h', type: 'hero' as const, visible: true, data: { title: 't', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 } }
const FORM = { id: 'b_f', type: 'lead-form' as const, visible: true, data: { title: 'c', fields: [{ key: 'name' as const, label: 'N', required: true }, { key: 'phone' as const, label: 'T', required: true }], submit_label: 'E', success_message: 'ok' } }

describe('D1LandingRepository', () => {
  let env: TestEnv
  let repo: D1LandingRepository

  beforeEach(async () => {
    env = await createTestDB()
    repo = new D1LandingRepository(env.DB)
  })
  afterAll(async () => { if (env) await closeTestDB(env) })

  it('save + findById round-trip', async () => {
    const org = await seedOrg(env.DB)
    const user = await seedUser(env.DB, org.id)
    const tplId = nextId('tpl'); await seedTemplate(env.DB, tplId)
    const l = Landing.create({ id: nextId('l'), org_id: org.id, agent_id: user.id, template_id: tplId, kind: 'property', slug_base: 'pal', slug_suffix: 'abc23', blocks: [HERO, FORM] })
    await repo.save(l)
    const loaded = await repo.findById(l.id, org.id)
    expect(loaded?.full_slug).toBe('pal-abc23')
    expect(loaded?.blocks.length).toBe(2)
  })

  it('existsFullSlug retorna true cuando existe', async () => {
    const org = await seedOrg(env.DB); const user = await seedUser(env.DB, org.id)
    const tplId = nextId('tpl'); await seedTemplate(env.DB, tplId)
    const l = Landing.create({ id: nextId('l'), org_id: org.id, agent_id: user.id, template_id: tplId, kind: 'property', slug_base: 'x', slug_suffix: 'aaaaa', blocks: [HERO, FORM] })
    await repo.save(l)
    expect(await repo.existsFullSlug('x-aaaaa')).toBe(true)
    expect(await repo.existsFullSlug('nope-xxxxx')).toBe(false)
  })

  it('findByOrg filtra por status', async () => {
    const org = await seedOrg(env.DB); const user = await seedUser(env.DB, org.id)
    const tplId = nextId('tpl'); await seedTemplate(env.DB, tplId)
    const draft = Landing.create({ id: nextId('l'), org_id: org.id, agent_id: user.id, template_id: tplId, kind: 'property', slug_base: 'a', slug_suffix: 'bbbbb', blocks: [HERO, FORM] })
    const review = Landing.create({ id: nextId('l'), org_id: org.id, agent_id: user.id, template_id: tplId, kind: 'property', slug_base: 'b', slug_suffix: 'ccccc', blocks: [HERO, FORM] }).transitionStatus('pending_review')
    await repo.save(draft); await repo.save(review)
    const pend = await repo.findByOrg(org.id, { status: 'pending_review' })
    expect(pend.length).toBe(1)
    expect(pend[0].full_slug).toBe('b-ccccc')
  })
})
```

- [ ] **Step 3: Run test**

Run: `npm test -- --filter @vendepro/infrastructure --run tests/repositories/d1-landing-repository.test.ts`
Expected: PASS (3 tests). Requiere que `schema.sql` contenga las 4 tablas nuevas (hecho en Task 2).

- [ ] **Step 4: Export adapter**

Modify `vendepro-backend/packages/infrastructure/src/repositories/index.ts` — append `export * from './d1-landing-repository'`.

- [ ] **Step 5: Commit**

```bash
git add vendepro-backend/packages/infrastructure/src/repositories/d1-landing-repository.ts vendepro-backend/packages/infrastructure/tests/repositories/d1-landing-repository.test.ts vendepro-backend/packages/infrastructure/src/repositories/index.ts
git commit -m "feat(infra): D1LandingRepository with integration tests"
```

---

## Task 19: D1LandingTemplateRepository

**Files:**
- Create: `vendepro-backend/packages/infrastructure/src/repositories/d1-landing-template-repository.ts`

- [ ] **Step 1: Implement**

Create:

```typescript
import { LandingTemplate } from '@vendepro/core'
import type { LandingTemplateRepository } from '@vendepro/core'
import type { LandingKind, Block } from '@vendepro/core'

export class D1LandingTemplateRepository implements LandingTemplateRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<LandingTemplate | null> {
    const row = await this.db.prepare(`SELECT * FROM landing_templates WHERE id = ?`).bind(id).first() as any
    return row ? this.toEntity(row) : null
  }

  async listVisibleTo(orgId: string, filters?: { kind?: LandingKind; onlyActive?: boolean }): Promise<LandingTemplate[]> {
    let q = `SELECT * FROM landing_templates WHERE (org_id IS NULL OR org_id = ?)`
    const binds: unknown[] = [orgId]
    if (filters?.onlyActive) q += ` AND active = 1`
    if (filters?.kind) { q += ` AND kind = ?`; binds.push(filters.kind) }
    q += ` ORDER BY sort_order ASC, name ASC LIMIT 100`
    const rows = (await this.db.prepare(q).bind(...binds).all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async save(tpl: LandingTemplate): Promise<void> {
    const o = tpl.toObject()
    await this.db.prepare(`
      INSERT INTO landing_templates (id, org_id, name, kind, description, preview_image_url, blocks_json, active, sort_order, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, kind=excluded.kind, description=excluded.description,
        preview_image_url=excluded.preview_image_url, blocks_json=excluded.blocks_json,
        active=excluded.active, sort_order=excluded.sort_order, updated_at=excluded.updated_at
    `).bind(
      o.id, o.org_id, o.name, o.kind, o.description, o.preview_image_url, JSON.stringify(o.blocks),
      o.active ? 1 : 0, o.sort_order, o.created_at, o.updated_at,
    ).run()
  }

  private toEntity(row: any): LandingTemplate {
    return LandingTemplate.fromPersistence({
      id: row.id,
      org_id: row.org_id,
      name: row.name,
      kind: row.kind as LandingKind,
      description: row.description,
      preview_image_url: row.preview_image_url,
      blocks: JSON.parse(row.blocks_json) as Block[],
      active: !!row.active,
      sort_order: row.sort_order,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }
}
```

- [ ] **Step 2: Export + commit**

Add to `infrastructure/src/repositories/index.ts`:
```typescript
export * from './d1-landing-template-repository'
```

```bash
git add vendepro-backend/packages/infrastructure/src/repositories/
git commit -m "feat(infra): D1LandingTemplateRepository"
```

---

## Task 20: D1LandingVersionRepository

**Files:**
- Create: `vendepro-backend/packages/infrastructure/src/repositories/d1-landing-version-repository.ts`

- [ ] **Step 1: Implement**

Create:

```typescript
import { LandingVersion, type VersionLabel } from '@vendepro/core'
import type { LandingVersionRepository, Block } from '@vendepro/core'

export class D1LandingVersionRepository implements LandingVersionRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<LandingVersion | null> {
    const row = await this.db.prepare(`SELECT * FROM landing_versions WHERE id = ?`).bind(id).first() as any
    return row ? this.toEntity(row) : null
  }

  async listByLanding(landingId: string, limit = 50): Promise<LandingVersion[]> {
    const rows = (await this.db.prepare(`SELECT * FROM landing_versions WHERE landing_id = ? ORDER BY version_number DESC LIMIT ?`)
      .bind(landingId, limit).all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async save(v: LandingVersion): Promise<void> {
    const o = v.toObject()
    await this.db.prepare(`
      INSERT INTO landing_versions (id, landing_id, version_number, blocks_json, label, created_by, created_at)
      VALUES (?,?,?,?,?,?,?)
    `).bind(o.id, o.landing_id, o.version_number, JSON.stringify(o.blocks), o.label, o.created_by, o.created_at).run()
  }

  async nextVersionNumber(landingId: string): Promise<number> {
    const row = await this.db.prepare(`SELECT COALESCE(MAX(version_number), 0) AS m FROM landing_versions WHERE landing_id = ?`).bind(landingId).first() as any
    return (row?.m ?? 0) + 1
  }

  async pruneNonPublish(landingId: string, keepLatest: number): Promise<number> {
    // Mantener las últimas `keepLatest` versiones NO-publish; borrar el resto.
    const res = await this.db.prepare(`
      DELETE FROM landing_versions
      WHERE landing_id = ?
        AND label != 'publish'
        AND id NOT IN (
          SELECT id FROM landing_versions
          WHERE landing_id = ? AND label != 'publish'
          ORDER BY version_number DESC LIMIT ?
        )
    `).bind(landingId, landingId, keepLatest).run()
    return (res.meta as any)?.changes ?? 0
  }

  private toEntity(row: any): LandingVersion {
    return LandingVersion.fromPersistence({
      id: row.id,
      landing_id: row.landing_id,
      version_number: row.version_number,
      blocks: JSON.parse(row.blocks_json) as Block[],
      label: row.label as VersionLabel,
      created_by: row.created_by,
      created_at: row.created_at,
    })
  }
}
```

- [ ] **Step 2: Export + commit**

```bash
git add vendepro-backend/packages/infrastructure/src/repositories/
git commit -m "feat(infra): D1LandingVersionRepository with retention pruning"
```

---

## Task 21: D1LandingEventRepository

**Files:**
- Create: `vendepro-backend/packages/infrastructure/src/repositories/d1-landing-event-repository.ts`
- Test: `vendepro-backend/packages/infrastructure/tests/repositories/d1-landing-event-repository.test.ts`

- [ ] **Step 1: Implement adapter**

Create:

```typescript
import { LandingEvent, type LandingEventType } from '@vendepro/core'
import type { LandingEventRepository, AnalyticsRange, AnalyticsSummary } from '@vendepro/core'

export class D1LandingEventRepository implements LandingEventRepository {
  constructor(private readonly db: D1Database) {}

  async save(ev: LandingEvent): Promise<void> {
    const o = ev.toObject()
    await this.db.prepare(`
      INSERT INTO landing_events (id, landing_id, slug, event_type, visitor_id, session_id,
        utm_source, utm_medium, utm_campaign, referrer, user_agent, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(o.id, o.landing_id, o.slug, o.event_type, o.visitor_id, o.session_id,
      o.utm_source, o.utm_medium, o.utm_campaign, o.referrer, o.user_agent, o.created_at).run()
  }

  async countByIpInWindow(_ip: string, _sinceIso: string): Promise<number> {
    // Rate limiting por IP requiere almacenar IP; v1 usa visitor_id como proxy.
    // Esta query es un stub — el worker api-public rate-limit puede usar KV en vez de DB.
    return 0
  }

  async summary(landingId: string, range: AnalyticsRange): Promise<AnalyticsSummary> {
    const pv = await this.countEvents(landingId, 'pageview', range)
    const uv = await this.countUniqueVisitors(landingId, range)
    const cc = await this.countEvents(landingId, 'cta_click', range)
    const fs = await this.countEvents(landingId, 'form_start', range)
    const fsub = await this.countEvents(landingId, 'form_submit', range)
    const pageviewsByDay = await this.pageviewsByDay(landingId, range)
    const topUtm = await this.topUtmSources(landingId, range, 10)
    return {
      pageviews: pv,
      unique_visitors: uv,
      cta_clicks: cc,
      form_starts: fs,
      form_submits: fsub,
      conversion_rate: pv > 0 ? fsub / pv : 0,
      pageviews_by_day: pageviewsByDay,
      top_utm_sources: topUtm,
    }
  }

  async recentByType(landingId: string, type: LandingEventType, limit: number): Promise<LandingEvent[]> {
    const rows = (await this.db.prepare(`
      SELECT * FROM landing_events WHERE landing_id = ? AND event_type = ? ORDER BY created_at DESC LIMIT ?
    `).bind(landingId, type, limit).all()).results as any[]
    return rows.map(r => LandingEvent.fromPersistence({
      id: r.id, landing_id: r.landing_id, slug: r.slug, event_type: r.event_type,
      visitor_id: r.visitor_id, session_id: r.session_id,
      utm_source: r.utm_source, utm_medium: r.utm_medium, utm_campaign: r.utm_campaign,
      referrer: r.referrer, user_agent: r.user_agent, created_at: r.created_at,
    }))
  }

  private async countEvents(landingId: string, type: LandingEventType, range: AnalyticsRange): Promise<number> {
    const row = await this.db.prepare(`
      SELECT COUNT(*) AS c FROM landing_events WHERE landing_id = ? AND event_type = ? AND created_at >= ? AND created_at < ?
    `).bind(landingId, type, range.since, range.until).first() as any
    return row?.c ?? 0
  }

  private async countUniqueVisitors(landingId: string, range: AnalyticsRange): Promise<number> {
    const row = await this.db.prepare(`
      SELECT COUNT(DISTINCT visitor_id) AS c FROM landing_events
      WHERE landing_id = ? AND event_type = 'pageview' AND visitor_id IS NOT NULL
      AND created_at >= ? AND created_at < ?
    `).bind(landingId, range.since, range.until).first() as any
    return row?.c ?? 0
  }

  private async pageviewsByDay(landingId: string, range: AnalyticsRange) {
    const rows = (await this.db.prepare(`
      SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS count
      FROM landing_events
      WHERE landing_id = ? AND event_type = 'pageview' AND created_at >= ? AND created_at < ?
      GROUP BY substr(created_at, 1, 10)
      ORDER BY date ASC
    `).bind(landingId, range.since, range.until).all()).results as any[]
    return rows.map(r => ({ date: r.date, count: r.count }))
  }

  private async topUtmSources(landingId: string, range: AnalyticsRange, limit: number) {
    const rows = (await this.db.prepare(`
      SELECT COALESCE(utm_source, 'direct') AS source, COUNT(*) AS count
      FROM landing_events
      WHERE landing_id = ? AND created_at >= ? AND created_at < ?
      GROUP BY COALESCE(utm_source, 'direct')
      ORDER BY count DESC LIMIT ?
    `).bind(landingId, range.since, range.until, limit).all()).results as any[]
    return rows.map(r => ({ source: r.source, count: r.count }))
  }
}
```

- [ ] **Step 2: Integration test**

Create `vendepro-backend/packages/infrastructure/tests/repositories/d1-landing-event-repository.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { D1LandingEventRepository } from '../../src/repositories/d1-landing-event-repository'
import { LandingEvent } from '@vendepro/core'

function mkEvent(landingId: string, slug: string, type: any, overrides: Partial<any> = {}) {
  return LandingEvent.create({
    id: `e_${Math.random().toString(36).slice(2)}`,
    landing_id: landingId,
    slug,
    event_type: type,
    visitor_id: overrides.visitor_id ?? 'v1',
    session_id: null,
    utm_source: overrides.utm_source ?? null,
    utm_medium: null, utm_campaign: null,
    referrer: null, user_agent: null,
  })
}

describe('D1LandingEventRepository', () => {
  let env: TestEnv; let repo: D1LandingEventRepository
  beforeEach(async () => { env = await createTestDB(); repo = new D1LandingEventRepository(env.DB) })
  afterAll(async () => { if (env) await closeTestDB(env) })

  it('summary cuenta por tipo y únicos', async () => {
    // Necesita una landing row para FK? El schema usa FK pero D1 no enforza por default.
    await repo.save(mkEvent('L1', 'pal-abc23', 'pageview', { visitor_id: 'v1' }))
    await repo.save(mkEvent('L1', 'pal-abc23', 'pageview', { visitor_id: 'v1' }))
    await repo.save(mkEvent('L1', 'pal-abc23', 'pageview', { visitor_id: 'v2' }))
    await repo.save(mkEvent('L1', 'pal-abc23', 'form_submit', { visitor_id: 'v1' }))

    const s = await repo.summary('L1', { since: '2000-01-01', until: '2099-01-01' })
    expect(s.pageviews).toBe(3)
    expect(s.unique_visitors).toBe(2)
    expect(s.form_submits).toBe(1)
  })

  it('topUtm agrupa correctamente', async () => {
    await repo.save(mkEvent('L1', 'x', 'pageview', { utm_source: 'ig' }))
    await repo.save(mkEvent('L1', 'x', 'pageview', { utm_source: 'ig' }))
    await repo.save(mkEvent('L1', 'x', 'pageview', { utm_source: 'wa' }))
    const s = await repo.summary('L1', { since: '2000-01-01', until: '2099-01-01' })
    expect(s.top_utm_sources[0]).toEqual({ source: 'ig', count: 2 })
  })
})
```

- [ ] **Step 3: Run test + commit**

Run: `npm test -- --filter @vendepro/infrastructure --run tests/repositories/d1-landing-event-repository.test.ts`
Expected: PASS (2 tests).

Add `export * from './d1-landing-event-repository'` al index.

```bash
git add vendepro-backend/packages/infrastructure/src/repositories/ vendepro-backend/packages/infrastructure/tests/repositories/d1-landing-event-repository.test.ts
git commit -m "feat(infra): D1LandingEventRepository with analytics summary"
```

---

## Task 22: Extender GroqAIService con editLandingBlock + editLandingGlobal

**Files:**
- Modify: `vendepro-backend/packages/infrastructure/src/services/groq-ai-service.ts`
- Test: `vendepro-backend/packages/infrastructure/tests/services/groq-ai-service.landings.test.ts`

- [ ] **Step 1: Write failing test with mocked fetch**

Create `vendepro-backend/packages/infrastructure/tests/services/groq-ai-service.landings.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GroqAIService } from '../../src/services/groq-ai-service'

const makeOk = (content: string) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content } }] }),
})

const makeError = (status: number) => ({
  ok: false,
  status,
  json: async () => ({ error: 'upstream' }),
})

describe('GroqAIService.editLandingBlock', () => {
  const svc = new GroqAIService('TEST_KEY')
  beforeEach(() => { vi.restoreAllMocks() })

  it('retorna ok cuando JSON respeta el schema del bloque hero', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any).mockImplementationOnce(async () =>
      makeOk(JSON.stringify({ title: 'nuevo', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 })) as any
    )
    const res = await svc.editLandingBlock({
      blockType: 'hero',
      blockData: { title: 'viejo', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 },
      prompt: 'cambialo',
      brandVoice: 'formal',
    })
    expect(res.status).toBe('ok')
    if (res.status === 'ok') expect((res.data as any).title).toBe('nuevo')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('reintenta una vez si el primer JSON es inválido para el schema', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any)
      .mockImplementationOnce(async () => makeOk(JSON.stringify({ title: 'sin imagen' })) as any) // falta campos
      .mockImplementationOnce(async () => makeOk(JSON.stringify({ title: 'nuevo', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 })) as any)
    const res = await svc.editLandingBlock({
      blockType: 'hero',
      blockData: { title: 'viejo', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 },
      prompt: 'x',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(res.status).toBe('ok')
  })

  it('retorna schema_mismatch si tras retry sigue inválido', async () => {
    vi.spyOn(globalThis, 'fetch' as any)
      .mockImplementation(async () => makeOk(JSON.stringify({ title: 'solo esto' })) as any)
    const res = await svc.editLandingBlock({ blockType: 'hero', blockData: { title: 'x', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 }, prompt: 'x' })
    expect(res.status).toBe('error')
    if (res.status === 'error') expect(res.reason).toBe('schema_mismatch')
  })

  it('retorna provider_error en 5xx', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockImplementationOnce(async () => makeError(503) as any)
    const res = await svc.editLandingBlock({ blockType: 'hero', blockData: { title: 'x', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 }, prompt: 'x' })
    expect(res.status).toBe('error')
    if (res.status === 'error') expect(res.reason).toBe('provider_error')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL (methods aún son stubs)**

Run: `npm test -- --filter @vendepro/infrastructure --run tests/services/groq-ai-service.landings.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement editLandingBlock + editLandingGlobal**

Replace the stubs added in Task 10 inside `vendepro-backend/packages/infrastructure/src/services/groq-ai-service.ts` with full implementations. Replace the two stub methods with:

```typescript
  async editLandingBlock(input: import('@vendepro/core').EditBlockInput): Promise<import('@vendepro/core').EditBlockResult> {
    const { BLOCK_DATA_SCHEMAS } = await import('@vendepro/core')
    const schema = BLOCK_DATA_SCHEMAS[input.blockType]
    if (!schema) return { status: 'error', reason: 'schema_mismatch', detail: `tipo desconocido: ${input.blockType}` }

    const brandVoice = input.brandVoice?.trim() || 'neutro profesional'
    const systemPrompt = `Sos copywriter de landings inmobiliarias para Argentina (español rioplatense).
Devolvé SOLO un JSON válido con el \`data\` actualizado del bloque.
Reglas:
1. Mantené la estructura exacta del schema del bloque (no agregues ni quites campos).
2. NO cambies id ni type. Solo podés cambiar los campos de data.
3. NO cambies URLs de imágenes existentes.
4. Respondé en español rioplatense, tono: ${brandVoice}.
5. Respondé SOLO el JSON, sin explicaciones, sin markdown.`

    const userPrompt = `Block type: ${input.blockType}
Block actual: ${JSON.stringify(input.blockData)}
Pedido del usuario: ${input.prompt}`

    try {
      const raw = await this.callGroq(systemPrompt, userPrompt)
      const parsed = this.safeParseJson(raw)
      if (parsed) {
        const validated = schema.safeParse(parsed)
        if (validated.success) return { status: 'ok', data: validated.data }
        // Retry correctivo
        const retryUser = `El intento anterior no pasó validación. Error: ${validated.error.message}.
Devolvé SOLO el JSON corregido del mismo bloque.
Block actual: ${JSON.stringify(input.blockData)}
Pedido del usuario: ${input.prompt}`
        const raw2 = await this.callGroq(systemPrompt, retryUser)
        const parsed2 = this.safeParseJson(raw2)
        if (parsed2) {
          const re = schema.safeParse(parsed2)
          if (re.success) return { status: 'ok', data: re.data }
        }
      }
      return { status: 'error', reason: 'schema_mismatch' }
    } catch (e) {
      return { status: 'error', reason: 'provider_error', detail: (e as Error).message }
    }
  }

  async editLandingGlobal(input: import('@vendepro/core').EditGlobalInput): Promise<import('@vendepro/core').EditGlobalResult> {
    const { BlocksArraySchema } = await import('@vendepro/core')
    const brandVoice = input.brandVoice?.trim() || 'neutro profesional'

    const systemPrompt = `Sos copywriter de landings inmobiliarias para Argentina (español rioplatense).
Devolvé SOLO un JSON con { "blocks": [...] } — un array con los bloques actualizados.
Reglas:
1. Mantené la MISMA longitud del array, los MISMOS id y type en el MISMO orden.
2. Solo podés modificar el campo data de los bloques relevantes al pedido.
3. NO cambies URLs de imágenes.
4. Respondé en español rioplatense, tono: ${brandVoice}.
5. SOLO el JSON, sin markdown.`

    const userPrompt = `Blocks actuales: ${JSON.stringify(input.blocks)}
Pedido del usuario: ${input.prompt}`

    try {
      const raw = await this.callGroq(systemPrompt, userPrompt)
      const parsed = this.safeParseJson(raw) as { blocks?: unknown } | null
      if (parsed?.blocks) {
        const v = BlocksArraySchema.safeParse(parsed.blocks)
        if (v.success && this.preservesStructure(input.blocks, v.data as any)) {
          return { status: 'ok', blocks: v.data as any }
        }
      }
      return { status: 'error', reason: 'schema_mismatch' }
    } catch (e) {
      return { status: 'error', reason: 'provider_error', detail: (e as Error).message }
    }
  }

  private preservesStructure(original: import('@vendepro/core').Block[], next: import('@vendepro/core').Block[]): boolean {
    if (original.length !== next.length) return false
    for (let i = 0; i < original.length; i++) {
      if (original[i].id !== next[i].id || original[i].type !== next[i].type) return false
    }
    return true
  }

  private safeParseJson(raw: string): unknown | null {
    try {
      // Tolerar json con markdown wrapper por si el modelo se rebela
      const match = raw.match(/\{[\s\S]*\}/)
      return match ? JSON.parse(match[0]) : null
    } catch { return null }
  }

  private async callGroq(system: string, user: string): Promise<string> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.4,
          max_tokens: 2000,
          response_format: { type: 'json_object' },
        }),
      })
      if (!res.ok) throw new Error(`Groq ${res.status}`)
      const data = await res.json() as any
      return data.choices?.[0]?.message?.content ?? ''
    } finally {
      clearTimeout(timeout)
    }
  }
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- --filter @vendepro/infrastructure --run tests/services/groq-ai-service.landings.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add vendepro-backend/packages/infrastructure/src/services/groq-ai-service.ts vendepro-backend/packages/infrastructure/tests/services/groq-ai-service.landings.test.ts
git commit -m "feat(infra): GroqAIService editLandingBlock + editLandingGlobal with shape-guard and retry"
```

---

## Task 23: Rutas en api-crm

**Files:**
- Modify: `vendepro-backend/packages/api-crm/src/index.ts`

- [ ] **Step 1: Leer archivo actual para agregar rutas sin romper nada**

Run: `Read vendepro-backend/packages/api-crm/src/index.ts`
Ubicar el bloque de imports, el `app.use(authMiddleware)` y el último `export default app`. Agregaremos las rutas de landings entre los handlers existentes y el export.

- [ ] **Step 2: Agregar imports al tope del archivo**

Add to the imports block:

```typescript
import {
  CreateLandingFromTemplateUseCase, UpdateLandingBlocksUseCase, AddBlockUseCase,
  RemoveBlockUseCase, ReorderBlocksUseCase, ToggleBlockVisibilityUseCase,
  RequestPublishUseCase, PublishLandingUseCase, RejectPublishRequestUseCase,
  ArchiveLandingUseCase, UnarchiveLandingUseCase, RollbackLandingUseCase,
  ListTemplatesUseCase, CreateTemplateUseCase, UpdateTemplateUseCase,
  ListLandingsUseCase, GetLandingUseCase, UpdateLandingMetadataUseCase,
  GetLandingAnalyticsUseCase,
} from '@vendepro/core'
import {
  D1LandingRepository, D1LandingTemplateRepository,
  D1LandingVersionRepository, D1LandingEventRepository,
  CryptoIdGenerator,
} from '@vendepro/infrastructure'
```

- [ ] **Step 3: Add helper builder antes de las rutas**

Insert antes de los handlers:

```typescript
const landingDeps = (env: { DB: D1Database }) => ({
  landings: new D1LandingRepository(env.DB),
  templates: new D1LandingTemplateRepository(env.DB),
  versions: new D1LandingVersionRepository(env.DB),
  events: new D1LandingEventRepository(env.DB),
  idGen: new CryptoIdGenerator(),
})

const actor = (c: any) => ({ role: c.get('userRole') as 'admin' | 'agent', userId: c.get('userId') as string })
const orgId = (c: any) => c.get('orgId') as string
```

- [ ] **Step 4: Add landings routes — listado, detalle, crear, update metadata**

```typescript
// === Landings ===
app.get('/landings', async (c) => {
  const { landings } = landingDeps(c.env)
  const uc = new ListLandingsUseCase(landings)
  const scope = (c.req.query('scope') as any) || 'mine'
  const kind = c.req.query('kind') as any
  const status = c.req.query('status') as any
  const result = await uc.execute({ actor: actor(c), orgId: orgId(c), scope, filters: { kind, status } })
  return c.json({ landings: result.map(l => l.toObject()) })
})

app.get('/landings/:id', async (c) => {
  const { landings } = landingDeps(c.env)
  const uc = new GetLandingUseCase(landings)
  const l = await uc.execute({ actor: actor(c), orgId: orgId(c), landingId: c.req.param('id') })
  return c.json({ landing: l.toObject() })
})

app.post('/landings', async (c) => {
  const body = (await c.req.json()) as any
  const { landings, templates, versions, idGen } = landingDeps(c.env)
  const uc = new CreateLandingFromTemplateUseCase(templates, landings, versions, idGen)
  const r = await uc.execute({
    actor: actor(c), orgId: orgId(c),
    templateId: body.templateId,
    slugBase: body.slugBase,
    brandVoice: body.brandVoice ?? null,
    leadRules: body.leadRules ?? null,
    seoTitle: body.seoTitle ?? null,
    seoDescription: body.seoDescription ?? null,
    ogImageUrl: body.ogImageUrl ?? null,
  })
  return c.json(r, 201)
})

app.patch('/landings/:id', async (c) => {
  const body = (await c.req.json()) as any
  const { landings } = landingDeps(c.env)
  await new UpdateLandingMetadataUseCase(landings).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'), patch: body.patch,
  })
  return c.json({ ok: true })
})
```

- [ ] **Step 5: Add blocks + versions + publish + archive routes**

```typescript
app.patch('/landings/:id/blocks', async (c) => {
  const body = (await c.req.json()) as any
  const { landings, versions, idGen } = landingDeps(c.env)
  const r = await new UpdateLandingBlocksUseCase(landings, versions, idGen).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'),
    blocks: body.blocks, label: body.label ?? 'manual-save',
  })
  return c.json(r)
})

app.post('/landings/:id/blocks', async (c) => {
  const body = (await c.req.json()) as any
  const { landings, versions, idGen } = landingDeps(c.env)
  const r = await new AddBlockUseCase(landings, versions, idGen).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'),
    block: body.block, insertAtIndex: body.insertAtIndex,
  })
  return c.json(r, 201)
})

app.delete('/landings/:id/blocks/:blockId', async (c) => {
  const { landings, versions, idGen } = landingDeps(c.env)
  await new RemoveBlockUseCase(landings, versions, idGen).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'), blockId: c.req.param('blockId'),
  })
  return c.json({ ok: true })
})

app.post('/landings/:id/blocks/reorder', async (c) => {
  const body = (await c.req.json()) as any
  const { landings, versions, idGen } = landingDeps(c.env)
  await new ReorderBlocksUseCase(landings, versions, idGen).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'),
    orderedBlockIds: body.orderedBlockIds,
  })
  return c.json({ ok: true })
})

app.patch('/landings/:id/blocks/:blockId/visibility', async (c) => {
  const body = (await c.req.json()) as any
  const { landings, versions, idGen } = landingDeps(c.env)
  await new ToggleBlockVisibilityUseCase(landings, versions, idGen).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'),
    blockId: c.req.param('blockId'), visible: body.visible,
  })
  return c.json({ ok: true })
})

app.get('/landings/:id/versions', async (c) => {
  const { versions } = landingDeps(c.env)
  const list = await versions.listByLanding(c.req.param('id'), 50)
  return c.json({ versions: list.map(v => v.toObject()) })
})

app.post('/landings/:id/rollback/:versionId', async (c) => {
  const { landings, versions, idGen } = landingDeps(c.env)
  const r = await new RollbackLandingUseCase(landings, versions, idGen).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'), versionId: c.req.param('versionId'),
  })
  return c.json(r)
})

app.post('/landings/:id/request-publish', async (c) => {
  const { landings } = landingDeps(c.env)
  await new RequestPublishUseCase(landings).execute({ actor: actor(c), orgId: orgId(c), landingId: c.req.param('id') })
  return c.json({ ok: true })
})

app.post('/landings/:id/publish', async (c) => {
  const { landings, versions, idGen } = landingDeps(c.env)
  const r = await new PublishLandingUseCase(landings, versions, idGen).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'),
  })
  return c.json(r)
})

app.post('/landings/:id/reject-publish', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as any
  const { landings } = landingDeps(c.env)
  await new RejectPublishRequestUseCase(landings).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'), note: body.note,
  })
  return c.json({ ok: true })
})

app.post('/landings/:id/archive', async (c) => {
  const { landings } = landingDeps(c.env)
  await new ArchiveLandingUseCase(landings).execute({ actor: actor(c), orgId: orgId(c), landingId: c.req.param('id') })
  return c.json({ ok: true })
})

app.post('/landings/:id/unarchive', async (c) => {
  const { landings } = landingDeps(c.env)
  await new UnarchiveLandingUseCase(landings).execute({ actor: actor(c), orgId: orgId(c), landingId: c.req.param('id') })
  return c.json({ ok: true })
})

app.get('/landings/:id/analytics', async (c) => {
  const { landings, events } = landingDeps(c.env)
  const rangeDays = (parseInt(c.req.query('rangeDays') || '7', 10) as 7 | 14 | 30)
  const r = await new GetLandingAnalyticsUseCase(landings, events).execute({
    actor: actor(c), orgId: orgId(c), landingId: c.req.param('id'), rangeDays,
  })
  return c.json({ summary: r })
})
```

- [ ] **Step 6: Add template admin routes**

```typescript
// === Templates ===
app.get('/landing-templates', async (c) => {
  const { templates } = landingDeps(c.env)
  const kind = c.req.query('kind') as any
  const list = await new ListTemplatesUseCase(templates).execute({ orgId: orgId(c), kind })
  return c.json({ templates: list.map(t => t.toObject()) })
})

app.post('/landing-templates', async (c) => {
  const body = (await c.req.json()) as any
  const { templates, idGen } = landingDeps(c.env)
  const r = await new CreateTemplateUseCase(templates, idGen).execute({
    actor: actor(c), orgId: body.global === true ? null : orgId(c),
    name: body.name, kind: body.kind, description: body.description,
    previewImageUrl: body.previewImageUrl, blocks: body.blocks, sortOrder: body.sortOrder,
  })
  return c.json(r, 201)
})

app.patch('/landing-templates/:id', async (c) => {
  const body = (await c.req.json()) as any
  const { templates } = landingDeps(c.env)
  await new UpdateTemplateUseCase(templates).execute({
    actor: actor(c), orgId: orgId(c), templateId: c.req.param('id'), patch: body.patch,
  })
  return c.json({ ok: true })
})
```

- [ ] **Step 7: Typecheck + commit**

Run: `npm run typecheck -- --filter @vendepro/api-crm`
Expected: no errors.

```bash
git add vendepro-backend/packages/api-crm/src/index.ts
git commit -m "feat(api-crm): landings CRUD, blocks, publish flow, archive, analytics, templates"
```

---

## Task 24: Ruta en api-ai (edit-block)

**Files:**
- Modify: `vendepro-backend/packages/api-ai/src/index.ts`

- [ ] **Step 1: Extender el Env type**

Replace the top type in `vendepro-backend/packages/api-ai/src/index.ts`:

```typescript
type Env = { DB: D1Database; JWT_SECRET: string; ANTHROPIC_API_KEY: string; GROQ_API_KEY: string }
```

- [ ] **Step 2: Agregar imports**

```typescript
import { EditBlockWithAIUseCase, AI_EDITS_PER_MINUTE } from '@vendepro/core'
import { D1LandingRepository, GroqAIService } from '@vendepro/infrastructure'
```

- [ ] **Step 3: Agregar ruta**

Append before `export default app`:

```typescript
app.post('/landings/:id/edit-block', async (c) => {
  const body = (await c.req.json()) as any
  const landings = new D1LandingRepository(c.env.DB)
  const ai = new GroqAIService(c.env.GROQ_API_KEY)
  const uc = new EditBlockWithAIUseCase(landings, ai)
  const result = await uc.execute({
    actor: { role: c.get('userRole') as any, userId: c.get('userId') as string },
    orgId: c.get('orgId') as string,
    landingId: c.req.param('id'),
    prompt: body.prompt,
    scope: body.scope,
    blockId: body.blockId,
  })
  return c.json(result)
})
```

**Nota:** el rate limit `AI_EDITS_PER_MINUTE = 30` está expuesto en `@vendepro/core`. Por ahora el endpoint no lo aplica: el plan lo agrega como follow-up cuando Fase B lo requiera (implementación recomendada: KV namespace counting keys por `userId` con TTL de 60s).

- [ ] **Step 4: Wrangler.jsonc — declarar binding de secret**

Edit `vendepro-backend/packages/api-ai/wrangler.jsonc` — asegurarse que en `vars` o como secret referenciado está `GROQ_API_KEY` (Cloudflare secrets no se declaran en wrangler.jsonc, solo se setean con `wrangler secret put` — pero el tipo Env en el código indica que se espera). Verificar que dev.vars en local lo tenga (no commitearlo).

Si existe `vendepro-backend/packages/api-ai/.dev.vars.example`, agregarle:
```
GROQ_API_KEY=gsk_...
```

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck -- --filter @vendepro/api-ai`
Expected: no errors.

```bash
git add vendepro-backend/packages/api-ai/
git commit -m "feat(api-ai): POST /landings/:id/edit-block (Groq shape-guarded)"
```

---

## Task 25: Rutas en api-public

**Files:**
- Modify: `vendepro-backend/packages/api-public/src/index.ts`

- [ ] **Step 1: Agregar imports + helper**

Add to imports:

```typescript
import { GetPublicLandingUseCase, RecordLandingEventUseCase, SubmitLeadFromLandingUseCase } from '@vendepro/core'
import { D1LandingRepository, D1LandingVersionRepository, D1LandingEventRepository, D1LeadRepository, CryptoIdGenerator } from '@vendepro/infrastructure'
```

- [ ] **Step 2: Ruta GET /l/:slug**

Append:

```typescript
app.get('/l/:slug', async (c) => {
  const landings = new D1LandingRepository(c.env.DB)
  const versions = new D1LandingVersionRepository(c.env.DB)
  const uc = new GetPublicLandingUseCase(landings, versions)
  const view = await uc.execute({ fullSlug: c.req.param('slug') })
  c.header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600')
  return c.json({ landing: view })
})
```

- [ ] **Step 3: Ruta POST /l/:slug/submit**

```typescript
app.post('/l/:slug/submit', async (c) => {
  const body = (await c.req.json()) as any
  const landings = new D1LandingRepository(c.env.DB)
  const events = new D1LandingEventRepository(c.env.DB)
  const leads = new D1LeadRepository(c.env.DB)
  const idGen = new CryptoIdGenerator()

  const uc = new SubmitLeadFromLandingUseCase(landings, events, leads, idGen)
  const r = await uc.execute({
    fullSlug: c.req.param('slug'),
    fields: {
      name: String(body.name ?? ''),
      phone: String(body.phone ?? ''),
      email: body.email ?? null,
      address: body.address ?? null,
      message: body.message ?? null,
    },
    visitorId: body.visitorId ?? null,
    utm: body.utm ?? undefined,
  })
  c.header('Cache-Control', 'no-store')
  return c.json(r, 201)
})
```

- [ ] **Step 4: Ruta POST /l/:slug/event**

```typescript
app.post('/l/:slug/event', async (c) => {
  const body = (await c.req.json()) as any
  const landings = new D1LandingRepository(c.env.DB)
  const events = new D1LandingEventRepository(c.env.DB)
  const idGen = new CryptoIdGenerator()
  const uc = new RecordLandingEventUseCase(landings, events, idGen)
  await uc.execute({
    fullSlug: c.req.param('slug'),
    eventType: body.type,
    visitorId: body.visitorId ?? null,
    sessionId: body.sessionId ?? null,
    utmSource: body.utm?.source ?? null,
    utmMedium: body.utm?.medium ?? null,
    utmCampaign: body.utm?.campaign ?? null,
    referrer: body.utm?.referrer ?? null,
    userAgent: c.req.header('user-agent') ?? null,
  })
  return new Response(null, { status: 204 })
})
```

- [ ] **Step 5: CORS — permitir wildcard subdomain**

Verificar el middleware CORS existente en `corsMiddleware` (de `@vendepro/infrastructure`). Si el allowlist no contempla `*.landings.vendepro.com.ar`, ajustar en la fuente:

Edit `vendepro-backend/packages/infrastructure/src/middleware/cors.ts` (o donde esté definido) para aceptar origin si matchea la regex `/^https:\/\/[a-z0-9-]+\.landings\.vendepro\.com\.ar$/i`. Mantener los orígenes actuales.

- [ ] **Step 6: Typecheck + commit**

Run: `npm run typecheck -- --filter @vendepro/api-public`
Expected: no errors.

```bash
git add vendepro-backend/packages/api-public/ vendepro-backend/packages/infrastructure/src/middleware/
git commit -m "feat(api-public): GET /l/:slug, POST /l/:slug/submit, POST /l/:slug/event + CORS wildcard"
```

---

## Task 26: E2E smoke test — happy path completo

**Files:**
- Create: `vendepro-backend/packages/api-public/tests/landings.e2e.test.ts` (o en el worker de tests existente)

- [ ] **Step 1: Write smoke test que crea → publica → consulta público → submit**

Create `vendepro-backend/packages/api-public/tests/landings.e2e.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from '../../infrastructure/tests/helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../../infrastructure/tests/helpers/fixtures'
import {
  CreateLandingFromTemplateUseCase, PublishLandingUseCase, GetPublicLandingUseCase, SubmitLeadFromLandingUseCase,
} from '@vendepro/core'
import {
  D1LandingRepository, D1LandingTemplateRepository, D1LandingVersionRepository,
  D1LandingEventRepository, D1LeadRepository, CryptoIdGenerator,
} from '@vendepro/infrastructure'

async function seedGlobalTemplate(db: D1Database) {
  const id = nextId('tpl')
  const blocks = [
    { id: 'b_h', type: 'hero', visible: true, data: { title: 'T', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 } },
    { id: 'b_f', type: 'lead-form', visible: true, data: { title: 'C', fields: [{ key: 'name', label: 'N', required: true }, { key: 'phone', label: 'T', required: true }], submit_label: 'E', success_message: '¡Ok!' } },
  ]
  await db.prepare(`INSERT INTO landing_templates (id, org_id, name, kind, blocks_json, active, sort_order)
    VALUES (?, NULL, 'T', 'property', ?, 1, 1)`).bind(id, JSON.stringify({ blocks })).run()
  // ajustar: el fromPersistence de LandingTemplate espera { blocks: Block[] }. Si la impl usa JSON directo, ajustar seed.
  return { id, blocks }
}

describe('landings e2e happy path', () => {
  let env: TestEnv
  beforeAll(async () => { env = await createTestDB() })
  afterAll(async () => { if (env) await closeTestDB(env) })

  it('create → publish → public view → submit → lead creado', async () => {
    const org = await seedOrg(env.DB)
    const agent = await seedUser(env.DB, org.id, { role: 'agent' })
    const admin = await seedUser(env.DB, org.id, { role: 'admin' })
    const { id: tplId } = await seedGlobalTemplate(env.DB)

    const repos = {
      landings: new D1LandingRepository(env.DB),
      templates: new D1LandingTemplateRepository(env.DB),
      versions: new D1LandingVersionRepository(env.DB),
      events: new D1LandingEventRepository(env.DB),
      leads: new D1LeadRepository(env.DB),
      idGen: new CryptoIdGenerator(),
    }

    // 1. create
    const { landingId, fullSlug } = await new CreateLandingFromTemplateUseCase(repos.templates, repos.landings, repos.versions, repos.idGen)
      .execute({ actor: { role: 'agent', userId: agent.id }, orgId: org.id, templateId: tplId, slugBase: 'e2e' })
    expect(landingId).toBeDefined()

    // 2. Bump to pending_review (via status transition simulada desde request-publish)
    const landing = await repos.landings.findById(landingId, org.id)
    await repos.landings.save(landing!.transitionStatus('pending_review'))

    // 3. publish (admin)
    const { versionId } = await new PublishLandingUseCase(repos.landings, repos.versions, repos.idGen)
      .execute({ actor: { role: 'admin', userId: admin.id }, orgId: org.id, landingId })
    expect(versionId).toBeDefined()

    // 4. GET público
    const view = await new GetPublicLandingUseCase(repos.landings, repos.versions)
      .execute({ fullSlug })
    expect(view.blocks.length).toBeGreaterThan(0)

    // 5. submit lead
    const submit = await new SubmitLeadFromLandingUseCase(repos.landings, repos.events, repos.leads, repos.idGen)
      .execute({ fullSlug, fields: { name: 'Juan', phone: '1122' } })
    expect(submit.leadId).toBeDefined()
    expect(submit.successMessage).toBe('¡Ok!')

    // 6. verificar que hay 1 lead con source landing:<slug>
    const rows = (await env.DB.prepare(`SELECT source FROM leads WHERE id = ?`).bind(submit.leadId).all()).results as any[]
    expect(rows[0].source).toBe(`landing:${fullSlug}`)
  })
})
```

**Nota:** `seedGlobalTemplate` arriba guarda el JSON en formato que `D1LandingTemplateRepository.toEntity` espera. Si al correr el test falla por mismatch (ej: la entidad espera solo `blocks_json` con el array, no `{ blocks }`), ajustar el seed a `JSON.stringify(blocks)` (array directo) — depende de cómo quedó el adapter.

- [ ] **Step 2: Run smoke test**

Run: `npm test -- --filter @vendepro/api-public --run tests/landings.e2e.test.ts`
Expected: PASS (1 test).

- [ ] **Step 3: Run all backend tests**

Run from `vendepro-backend/`: `npm test`
Expected: todos verdes.

- [ ] **Step 4: Commit**

```bash
git add vendepro-backend/packages/api-public/tests/
git commit -m "test(e2e): landings create→publish→public→submit smoke test"
```

---

## Task 27: Infra checklist (DOCUMENTACIÓN — no código)

**Files:**
- Modify: `docs/superpowers/specs/2026-04-18-landings-design.md` (si hace falta actualizar algo) o agregar `docs/superpowers/runbooks/2026-04-18-landings-deploy.md`

- [ ] **Step 1: Crear runbook de deploy**

Create `docs/superpowers/runbooks/2026-04-18-landings-deploy.md`:

```markdown
# Landings — Runbook de deploy Fase A

## Pre-requisitos
- Migrations `010_landings.sql` y `011_landings_seed_templates.sql` en `migrations_v2/`.
- `@vendepro/core` y `@vendepro/infrastructure` actualizados en main.
- Workers afectados: `api-crm`, `api-ai`, `api-public`.

## Pasos (en orden)

### 1. Aplicar migrations a D1 producción

Desde CF Dashboard → D1 → `vendepro-db` → Console:
- Pegar contenido de `010_landings.sql` y ejecutar.
- Pegar contenido de `011_landings_seed_templates.sql` y ejecutar.

### 2. Setear secret GROQ_API_KEY en api-ai

**Vía GHA (preferido):** commit cambio en workflow que invoca `wrangler secret put GROQ_API_KEY < GH_SECRETS`. O:

**Vía CF Dashboard:** Workers → `vendepro-api-ai` → Settings → Variables and Secrets → Add `GROQ_API_KEY`.

### 3. Deploy de workers

Los 3 workers se deployan por GHA pusheando a main. Validar en Actions que:
- `vendepro-api-crm` build y deploy OK.
- `vendepro-api-ai` build y deploy OK.
- `vendepro-api-public` build y deploy OK.

### 4. Smoke test post-deploy

Con un usuario admin:
```bash
# 1. Listar templates
curl -H "Cookie: session=..." https://crm.api.vendepro.com.ar/landing-templates

# 2. Crear una landing
curl -X POST -H "Cookie: ..." -H "Content-Type: application/json" \
  -d '{"templateId":"tpl_emprendimiento_premium","slugBase":"smoke-test"}' \
  https://crm.api.vendepro.com.ar/landings

# 3. Publicar (con userRole=admin en el JWT)
curl -X POST -H "Cookie: ..." https://crm.api.vendepro.com.ar/landings/<id>/publish

# 4. Consultar pública
curl https://public.api.vendepro.com.ar/l/smoke-test-<suffix>

# 5. Submit
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"Smoke","phone":"111"}' \
  https://public.api.vendepro.com.ar/l/smoke-test-<suffix>/submit
```

### 5. Infra CF (Fase B/C — no bloquea Fase A)

- DNS wildcard `*.landings.vendepro.com.ar` → Pages `vendepro-frontend.pages.dev`. Status: Proxied.
- Pages Custom domain: agregar `*.landings.vendepro.com.ar` al proyecto `vendepro-frontend`.

Estos 2 pasos pueden quedar pendientes hasta que Fase C (público+editor) esté ready.

## Rollback

Si algo explota:
1. Revertir los commits de rutas en los 3 workers (generalmente deploys por GHA).
2. Migrations 010/011: NO revertir. Las tablas no rompen nada si no se usan.
3. Si un bug serio en shape-guard de Groq, deshabilitar la ruta `/landings/:id/edit-block` temporalmente retornando 503.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/runbooks/2026-04-18-landings-deploy.md
git commit -m "docs(runbook): landings Fase A deploy + rollback playbook"
```

---

## Self-review (post-write)

Después de escribir este plan, correr checklist:

**Spec coverage:**
- [x] Migration 4 tablas (Task 2)
- [x] Seed 3 templates (Task 3)
- [x] Zod schemas 8 bloques (Task 4)
- [x] LandingStatus, LandingSlug (Task 5)
- [x] Entities Landing/Template/Version/Event (Tasks 6, 7)
- [x] landing-rules.ts (Task 8)
- [x] Repository ports (Task 9)
- [x] AIService port ampliado (Task 10)
- [x] Use-cases: create, update-blocks, add, remove, reorder, toggle, edit-ai, request-publish, publish, reject, archive, unarchive, rollback, submit-lead, record-event, get-public, list-landings, get-landing, update-metadata, list/create/update-template, get-analytics (Tasks 11–17)
- [x] D1 adapters (Tasks 18–21)
- [x] Groq adapter ampliado con retry (Task 22)
- [x] Rutas api-crm / api-ai / api-public (Tasks 23–25)
- [x] E2E smoke (Task 26)
- [x] Runbook deploy (Task 27)

**Placeholder scan:** ninguna TBD/TODO en el plan. Todos los code blocks contienen código real.

**Consistency:** `AIService.editLandingBlock(input): EditBlockResult` es consistente entre port (Task 10), use-case (Task 13) y adapter (Task 22). `validateBlocks` vive en `block-schemas.ts` (Task 4) y se usa desde `Landing.create` (Task 6) y desde el adapter Groq (Task 22). Retención versiones `VERSION_RETENTION_NON_PUBLISH = 20` se define en `landing-rules.ts` (Task 8) y la usa `UpdateLandingBlocksUseCase` al llamar `versions.pruneNonPublish(landing.id, VERSION_RETENTION_NON_PUBLISH)` (Task 12).

**Scope:** este plan cubre solo Fase A (backend). Fase B (editor frontend) y Fase C (público + analytics frontend + infra DNS) quedan en planes separados que se escriben después de que el engineer ejecute Fase A.

---

## Siguiente plan

Al completar Fase A, escribir:
- **`2026-04-18-landings-fase-b-editor.md`** — block components, `BlockRenderer`, editor 3-panes, wizard de creación, listado admin, chat IA UI.
- **`2026-04-18-landings-fase-c-public.md`** — `middleware.ts` subdomain rewrite, `app/l/[slug]/page.tsx`, tracking JS, tablero de analytics en detalle.
- Infra DNS + Pages custom domain → ejecutado por humano (dashboard), documentado en runbook.









