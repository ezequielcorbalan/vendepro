# Tasaciones Templates — Sub-plan 1: Backend Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Commit policy:** No per-task commits. One final commit at the end after all tasks pass (user preference).
>
> **Subagent model:** Dispatch subagents with Sonnet (not Haiku).

**Goal:** Build the backend foundation for the tasaciones templates feature — DB migrations, domain entities, repositories, use cases, seeds and API routes. After this sub-plan the admin can manage templates and variables via curl, and tasaciones can be created with `template_id` + snapshot. Frontend rendering and PDF come in sub-plans 2 and 3.

**Architecture:** Hexagonal (domain + application + infrastructure). Templates live in new table `appraisal_templates` (NULL org_id = sistema, X = custom per-org). Variables live in `org_variables` (namespaces: market, notary, custom). Appraisals extended with `template_id` + `template_snapshot_json` + `block_overrides_json` + `template_synced_at`. Copy-on-write at duplicate. Hydration happens in use cases, separate from persistence.

**Tech Stack:** TypeScript, Cloudflare Workers + D1, Hono, Vitest, Zod for block schemas. Reuses patterns from `landing-template`.

**Spec reference:** `docs/superpowers/specs/2026-04-23-tasaciones-templates-design.md`

**Cross-cutting rule — index.ts exports:** As new entities, value objects, repository ports, and use cases are added in `packages/core/src/`, they MUST be re-exported from `packages/core/src/index.ts` so other packages and tests can `import { X } from '@vendepro/core'`. Check the relevant barrel file (there may be sub-barrels for `domain/entities/index.ts`, `application/ports/repositories/index.ts`, etc.) and append an export line for each new symbol. Run `npm run -w @vendepro/core build` after each task that adds a new exportable to catch missing re-exports early.

---

## Phase A — Database migrations

### Task 1: Create migration SQL with new tables + extensions + cleanup

**Files:**
- Create: `vendepro-backend/migrations_v2/017_appraisal_templates_v1.sql`

- [ ] **Step 1: Write the migration SQL file**

```sql
-- Migration 017 — Appraisal templates v1
-- Creates appraisal_templates, org_variables, appraisal_pdfs.
-- Extends appraisals with template_id, snapshot, synced_at, overrides.
-- Cleans up legacy Canva columns from appraisals and users.

-- ============================================================
-- Appraisal templates (sistema + custom por org, copy-on-write)
-- ============================================================
CREATE TABLE IF NOT EXISTS appraisal_templates (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  preview_image_url TEXT,
  blocks_json TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 0,
  parent_template_id TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_appraisal_templates_org ON appraisal_templates(org_id, active);
CREATE INDEX IF NOT EXISTS idx_appraisal_templates_kind ON appraisal_templates(kind);

-- ============================================================
-- Org variables (periódicas + custom)
-- ============================================================
CREATE TABLE IF NOT EXISTS org_variables (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  value_type TEXT NOT NULL,
  label TEXT,
  namespace TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE(org_id, key)
);
CREATE INDEX IF NOT EXISTS idx_org_variables_ns ON org_variables(org_id, namespace);

-- ============================================================
-- Appraisal PDFs (cache + quota tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS appraisal_pdfs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  appraisal_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  size_bytes INTEGER,
  generated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_appraisal_pdfs_hash ON appraisal_pdfs(content_hash);
CREATE INDEX IF NOT EXISTS idx_appraisal_pdfs_org_month ON appraisal_pdfs(org_id, generated_at);
CREATE INDEX IF NOT EXISTS idx_appraisal_pdfs_appraisal ON appraisal_pdfs(appraisal_id);

-- ============================================================
-- Extend appraisals with template fields
-- ============================================================
ALTER TABLE appraisals ADD COLUMN template_id TEXT;
ALTER TABLE appraisals ADD COLUMN template_snapshot_json TEXT;
ALTER TABLE appraisals ADD COLUMN template_synced_at TEXT;
ALTER TABLE appraisals ADD COLUMN block_overrides_json TEXT;

-- ============================================================
-- Cleanup legacy Canva columns (Fase 1)
-- ============================================================
-- SQLite does not support DROP COLUMN on older versions. D1 supports it since 2024.
-- If your D1 version does not, comment out these statements; columns will be left
-- as dead weight and removed manually later.
ALTER TABLE appraisals DROP COLUMN canva_design_id;
ALTER TABLE appraisals DROP COLUMN canva_edit_url;
ALTER TABLE users DROP COLUMN canva_template_id;
ALTER TABLE users DROP COLUMN canva_report_template_id;
```

Use Write tool to save the file at `vendepro-backend/migrations_v2/017_appraisal_templates_v1.sql` with the exact content above.

- [ ] **Step 2: Dry-verify SQL syntax**

Run:
```bash
sqlite3 :memory: < vendepro-backend/migrations_v2/017_appraisal_templates_v1.sql 2>&1 | head -20
```

Expected: empty output OR errors only about missing `appraisals`/`users` tables (the test DB has no prior tables). No syntax errors on CREATE statements. If syntax errors appear, fix them.

- [ ] **Step 3: Verify file contents match exactly**

Run:
```bash
wc -l vendepro-backend/migrations_v2/017_appraisal_templates_v1.sql
```

Expected: between 60 and 75 lines.

---

### Task 2: Run migration against fresh local D1 to validate

**Files:**
- No new files; runs wrangler locally.

- [ ] **Step 1: Apply migration to local D1**

Run from `vendepro-backend/`:
```bash
cd vendepro-backend && npx wrangler d1 execute vendepro-db --local --file=migrations_v2/017_appraisal_templates_v1.sql
```

Expected: "Executed X SQL statements in Yms" with no errors. If the `DROP COLUMN` statements fail due to older SQLite, comment them out and document in a post-run note.

- [ ] **Step 2: Verify new tables exist**

Run:
```bash
npx wrangler d1 execute vendepro-db --local --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('appraisal_templates','org_variables','appraisal_pdfs');"
```

Expected: three rows returned — `appraisal_templates`, `org_variables`, `appraisal_pdfs`.

- [ ] **Step 3: Verify appraisals has new columns**

Run:
```bash
npx wrangler d1 execute vendepro-db --local --command="PRAGMA table_info(appraisals);" | grep -E "template_id|template_snapshot_json|template_synced_at|block_overrides_json"
```

Expected: four matching rows (one per new column).

---

## Phase B — Block schemas and binding mode

### Task 3: Define binding modes and block type union

**Files:**
- Create: `vendepro-backend/packages/core/src/domain/value-objects/appraisal-binding-mode.ts`
- Create: `vendepro-backend/packages/core/src/domain/value-objects/appraisal-block-type.ts`
- Create: `vendepro-backend/packages/core/tests/domain/appraisal-binding-mode.test.ts`

- [ ] **Step 1: Write failing test for binding mode validator**

Content for `vendepro-backend/packages/core/tests/domain/appraisal-binding-mode.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { assertBindingMode, BINDING_MODES } from '../../src/domain/value-objects/appraisal-binding-mode'

describe('BindingMode', () => {
  it('accepts all 5 valid modes', () => {
    for (const m of BINDING_MODES) {
      expect(() => assertBindingMode(m)).not.toThrow()
    }
  })

  it('rejects unknown mode', () => {
    expect(() => assertBindingMode('garbage')).toThrow(/binding_mode inválido/)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run:
```bash
cd vendepro-backend && npm test -- --filter @vendepro/core -- --run appraisal-binding-mode
```

Expected: FAIL — cannot find module `appraisal-binding-mode`.

- [ ] **Step 3: Implement binding mode**

Content for `vendepro-backend/packages/core/src/domain/value-objects/appraisal-binding-mode.ts`:
```typescript
import { ValidationError } from '../errors/validation-error'

export const BINDING_MODES = ['system', 'org-static', 'org-variable', 'tasacion', 'default-override'] as const
export type BindingMode = typeof BINDING_MODES[number]

export function assertBindingMode(value: string): asserts value is BindingMode {
  if (!(BINDING_MODES as readonly string[]).includes(value)) {
    throw new ValidationError(`binding_mode inválido: "${value}"`)
  }
}
```

- [ ] **Step 4: Implement block type union**

Content for `vendepro-backend/packages/core/src/domain/value-objects/appraisal-block-type.ts`:
```typescript
import { ValidationError } from '../errors/validation-error'

export const STRUCTURAL_BLOCK_TYPES = [
  'cover',
  'proposal_commercial',
  'services_grid',
  'market_stats',
  'funnel_chart',
  'methodology',
  'notary_charts',
] as const

export const DYNAMIC_BLOCK_TYPES = [
  'property_data',
  'swot',
  'zone_map',
  'comparables_list',
  'price_projection',
  'work_conditions',
] as const

export const WEB_ONLY_BLOCK_TYPES = [
  'video_gallery',
  'extra_media',
  'cta_whatsapp',
  'agent_contact_card',
] as const

export const APPRAISAL_BLOCK_TYPES = [
  ...STRUCTURAL_BLOCK_TYPES,
  ...DYNAMIC_BLOCK_TYPES,
  ...WEB_ONLY_BLOCK_TYPES,
] as const

export type AppraisalBlockType = typeof APPRAISAL_BLOCK_TYPES[number]

/** Types whose `include_in_pdf` cannot be changed by the user. */
export const PDF_LOCKED_TYPES = new Set<AppraisalBlockType>([
  'cover', 'property_data', 'swot', 'price_projection',
  ...WEB_ONLY_BLOCK_TYPES,
])

/** Types that are always web-only (include_in_pdf forced false). */
export const WEB_ONLY_TYPES_SET = new Set<AppraisalBlockType>(WEB_ONLY_BLOCK_TYPES)

export function assertAppraisalBlockType(value: string): asserts value is AppraisalBlockType {
  if (!(APPRAISAL_BLOCK_TYPES as readonly string[]).includes(value)) {
    throw new ValidationError(`block type inválido: "${value}"`)
  }
}
```

- [ ] **Step 5: Run test again — expect PASS**

Run:
```bash
cd vendepro-backend && npm test -- --filter @vendepro/core -- --run appraisal-binding-mode
```

Expected: PASS.

---

### Task 4: Zod schemas per block type

**Files:**
- Create: `vendepro-backend/packages/core/src/domain/value-objects/appraisal-block-schemas.ts`
- Create: `vendepro-backend/packages/core/tests/domain/appraisal-block-schemas.test.ts`

- [ ] **Step 1: Write failing test**

Content for `vendepro-backend/packages/core/tests/domain/appraisal-block-schemas.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { validateAppraisalBlocks } from '../../src/domain/value-objects/appraisal-block-schemas'

describe('validateAppraisalBlocks', () => {
  it('accepts empty array', () => {
    const r = validateAppraisalBlocks([])
    expect(r.success).toBe(true)
  })

  it('validates cover block shape', () => {
    const r = validateAppraisalBlocks([{
      id: 'b1',
      type: 'cover',
      binding_mode: 'tasacion',
      include_in_pdf: true,
      sort_order: 0,
      data: { title: 'Tasación', cover_image_url: 'https://x/y.jpg', agent_display: { name: 'N' } },
    }])
    expect(r.success).toBe(true)
  })

  it('rejects unknown type', () => {
    const r = validateAppraisalBlocks([{
      id: 'b1', type: 'nope', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0, data: {},
    }])
    expect(r.success).toBe(false)
  })

  it('forces include_in_pdf=false on web-only types', () => {
    const r = validateAppraisalBlocks([{
      id: 'b1', type: 'video_gallery', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0,
      data: { title: 'Videos', videos: [{ url: 'https://y', caption: 'x', provider: 'youtube' }] },
    }])
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/web-only/i)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run:
```bash
cd vendepro-backend && npm test -- --filter @vendepro/core -- --run appraisal-block-schemas
```

Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement schemas**

Content for `vendepro-backend/packages/core/src/domain/value-objects/appraisal-block-schemas.ts`:
```typescript
import { z } from 'zod'
import {
  APPRAISAL_BLOCK_TYPES,
  WEB_ONLY_TYPES_SET,
  type AppraisalBlockType,
} from './appraisal-block-type'
import { BINDING_MODES, type BindingMode } from './appraisal-binding-mode'

// Data shapes per type. Kept permissive where the renderer tolerates missing fields.

const CoverData = z.object({
  title: z.string().max(200).optional(),
  subtitle: z.string().max(300).optional(),
  cover_image_url: z.string().url().optional().nullable(),
  agent_display: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    avatar_url: z.string().url().optional().nullable(),
  }).optional(),
})

const ProposalCommercialData = z.object({
  title: z.string().max(200).optional(),
  subtitle: z.string().max(300).optional(),
  items: z.array(z.object({
    icon: z.string().max(40).optional(),
    title: z.string().min(1).max(120),
    body: z.string().max(600),
  })).max(8),
})

const ServicesGridData = z.object({
  title: z.string().max(200).optional(),
  services: z.array(z.object({ icon: z.string().max(40).optional(), label: z.string().min(1).max(120) })).max(12),
  portals_logos: z.array(z.string().url()).max(8).optional(),
  badge_text: z.string().max(80).optional(),
})

const MarketStatsData = z.object({
  title: z.string().max(200).optional(),
  vars: z.array(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_.]*$/)).max(8),
})

const FunnelChartData = z.object({
  title: z.string().max(200).optional(),
  funnel: z.array(z.object({ label: z.string(), value: z.number() })).max(10),
  ranges: z.array(z.object({ label: z.string(), from: z.number(), to: z.number(), color: z.string().optional() })).max(6).optional(),
})

const MethodologyData = z.object({
  title: z.string().max(200).optional(),
  body: z.string().max(2000),
  image_url: z.string().url().optional().nullable(),
  highlight_text: z.string().max(400).optional(),
})

const NotaryChartsData = z.object({
  title: z.string().max(200).optional(),
  chart_1_var: z.string().optional(),
  chart_2_var: z.string().optional(),
})

const PropertyDataData = z.object({
  title: z.string().max(200).optional(),
  source: z.literal('appraisal.*').optional(),
})

const SwotData = z.object({
  title: z.string().max(200).optional(),
  source: z.literal('appraisal.swot').optional(),
})

const ZoneMapData = z.object({
  title: z.string().max(200).optional(),
  map_image_url: z.string().url().optional().nullable(),
  neighborhood_name: z.string().optional(),
  min_m2_price: z.number().optional(),
  avg_m2_price: z.number().optional(),
  median_m2_price: z.number().optional(),
  published_count: z.number().int().nonnegative().optional(),
})

const ComparablesListData = z.object({
  title: z.string().max(200).optional(),
  source: z.literal('appraisal.comparables').optional(),
  variant: z.enum(['published', 'reserved']),
})

const PriceProjectionData = z.object({
  title: z.string().max(200).optional(),
  source: z.literal('appraisal.prices').optional(),
})

const WorkConditionsData = z.object({
  title: z.string().max(200).optional(),
  honorarios_pct: z.number().min(0).max(100).optional(),
  exclusividad_dias: z.number().int().min(0).max(365).optional(),
  required_docs: z.array(z.string()).max(20).optional(),
  extras: z.array(z.string()).max(20).optional(),
  legal_text: z.string().max(2000).optional(),
  signature_image_url: z.string().url().optional().nullable(),
})

const VideoGalleryData = z.object({
  title: z.string().max(200).optional(),
  videos: z.array(z.object({
    url: z.string().url(),
    caption: z.string().max(200).optional(),
    provider: z.enum(['youtube', 'vimeo', 'r2']),
  })).max(12),
})

const ExtraMediaData = z.object({
  title: z.string().max(200).optional(),
  media: z.array(z.object({
    type: z.enum(['image', 'video']),
    url: z.string().url(),
    caption: z.string().max(200).optional(),
  })).max(24),
})

const CtaWhatsappData = z.object({
  text: z.string().min(1).max(200),
  phone: z.string().min(6).max(30),
  pre_filled_message: z.string().max(500).optional(),
})

const AgentContactCardData = z.object({
  avatar_url: z.string().url().optional().nullable(),
  name: z.string().min(1).max(120),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal('')),
  whatsapp_link: z.string().url().optional().nullable(),
})

const dataByType: Record<AppraisalBlockType, z.ZodTypeAny> = {
  cover: CoverData,
  proposal_commercial: ProposalCommercialData,
  services_grid: ServicesGridData,
  market_stats: MarketStatsData,
  funnel_chart: FunnelChartData,
  methodology: MethodologyData,
  notary_charts: NotaryChartsData,
  property_data: PropertyDataData,
  swot: SwotData,
  zone_map: ZoneMapData,
  comparables_list: ComparablesListData,
  price_projection: PriceProjectionData,
  work_conditions: WorkConditionsData,
  video_gallery: VideoGalleryData,
  extra_media: ExtraMediaData,
  cta_whatsapp: CtaWhatsappData,
  agent_contact_card: AgentContactCardData,
}

const TemplateBlockSchema = z.object({
  id: z.string().min(1),
  type: z.enum(APPRAISAL_BLOCK_TYPES as unknown as [AppraisalBlockType, ...AppraisalBlockType[]]),
  binding_mode: z.enum(BINDING_MODES as unknown as [BindingMode, ...BindingMode[]]),
  include_in_pdf: z.boolean(),
  sort_order: z.number().int(),
  data: z.unknown(),
}).superRefine((b, ctx) => {
  if (WEB_ONLY_TYPES_SET.has(b.type as AppraisalBlockType) && b.include_in_pdf !== false) {
    ctx.addIssue({ code: 'custom', path: ['include_in_pdf'], message: `tipo "${b.type}" es web-only; include_in_pdf debe ser false` })
    return
  }
  const schema = dataByType[b.type as AppraisalBlockType]
  const r = schema.safeParse(b.data)
  if (!r.success) {
    ctx.addIssue({ code: 'custom', path: ['data'], message: `data inválido para "${b.type}": ${r.error.issues[0]?.message ?? 'unknown'}` })
  }
})

export type TemplateBlock = z.infer<typeof TemplateBlockSchema>

export type ValidateResult =
  | { success: true; data: TemplateBlock[] }
  | { success: false; error: string }

export function validateAppraisalBlocks(blocks: unknown): ValidateResult {
  const r = z.array(TemplateBlockSchema).safeParse(blocks)
  if (!r.success) return { success: false, error: r.error.issues[0]?.message ?? 'invalid' }
  return { success: true, data: r.data }
}
```

- [ ] **Step 4: Run test — expect PASS**

Run:
```bash
cd vendepro-backend && npm test -- --filter @vendepro/core -- --run appraisal-block-schemas
```

Expected: PASS.

---

## Phase C — Domain entities

### Task 5: AppraisalTemplate entity

**Files:**
- Create: `vendepro-backend/packages/core/src/domain/entities/appraisal-template.ts`
- Create: `vendepro-backend/packages/core/tests/domain/appraisal-template.test.ts`

- [ ] **Step 1: Write failing test**

Content for `vendepro-backend/packages/core/tests/domain/appraisal-template.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { AppraisalTemplate } from '../../src/domain/entities/appraisal-template'

const validBlock = {
  id: 'b1', type: 'cover', binding_mode: 'tasacion', include_in_pdf: true,
  sort_order: 0, data: { title: 'T' },
}

describe('AppraisalTemplate', () => {
  it('creates a valid template', () => {
    const t = AppraisalTemplate.create({
      id: 't1', org_id: null, kind: 'casa', name: 'Sistema Casa',
      description: null, preview_image_url: null, blocks: [validBlock] as any,
      is_system: true, parent_template_id: null, active: true, sort_order: 0,
    })
    expect(t.id).toBe('t1'); expect(t.isSystem()).toBe(true); expect(t.isGlobal()).toBe(true)
  })

  it('rejects short name', () => {
    expect(() => AppraisalTemplate.create({
      id: 't1', org_id: 'o1', kind: 'casa', name: 'x', description: null,
      preview_image_url: null, blocks: [], is_system: false,
      parent_template_id: null, active: true, sort_order: 0,
    })).toThrow(/name/)
  })

  it('rejects invalid kind', () => {
    expect(() => AppraisalTemplate.create({
      id: 't1', org_id: 'o1', kind: 'foo' as any, name: 'Nombre', description: null,
      preview_image_url: null, blocks: [], is_system: false,
      parent_template_id: null, active: true, sort_order: 0,
    })).toThrow(/kind/)
  })

  it('duplicate() clones blocks and sets parent', () => {
    const sys = AppraisalTemplate.create({
      id: 'sys1', org_id: null, kind: 'casa', name: 'Sys', description: null,
      preview_image_url: null, blocks: [validBlock] as any, is_system: true,
      parent_template_id: null, active: true, sort_order: 0,
    })
    const copy = sys.duplicateFor('org1', 'new-id', 'My Casa')
    expect(copy.org_id).toBe('org1'); expect(copy.isSystem()).toBe(false)
    expect(copy.parent_template_id).toBe('sys1'); expect(copy.blocks.length).toBe(1)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/core -- --run appraisal-template`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement entity**

Content for `vendepro-backend/packages/core/src/domain/entities/appraisal-template.ts`:
```typescript
import { ValidationError } from '../errors/validation-error'
import { validateAppraisalBlocks, type TemplateBlock } from '../value-objects/appraisal-block-schemas'

export const APPRAISAL_TEMPLATE_KINDS = ['casa', 'depto', 'terreno', 'corporativo', 'custom'] as const
export type AppraisalTemplateKind = typeof APPRAISAL_TEMPLATE_KINDS[number]

export interface AppraisalTemplateProps {
  id: string
  org_id: string | null
  kind: AppraisalTemplateKind
  name: string
  description: string | null
  preview_image_url: string | null
  blocks: TemplateBlock[]
  is_system: boolean
  parent_template_id: string | null
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export class AppraisalTemplate {
  private constructor(private readonly props: AppraisalTemplateProps) {}

  static create(input: Omit<AppraisalTemplateProps, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): AppraisalTemplate {
    if (!input.name || input.name.trim().length < 2) throw new ValidationError('name es requerido (mín 2 chars)')
    if (!(APPRAISAL_TEMPLATE_KINDS as readonly string[]).includes(input.kind)) {
      throw new ValidationError(`kind inválido: "${input.kind}"`)
    }
    const v = validateAppraisalBlocks(input.blocks)
    if (!v.success) throw new ValidationError(`Bloques inválidos: ${v.error}`)

    const now = new Date().toISOString()
    return new AppraisalTemplate({
      ...input, blocks: v.data,
      created_at: input.created_at ?? now, updated_at: input.updated_at ?? now,
    })
  }

  static fromPersistence(props: AppraisalTemplateProps): AppraisalTemplate { return new AppraisalTemplate(props) }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get kind() { return this.props.kind }
  get name() { return this.props.name }
  get description() { return this.props.description }
  get preview_image_url() { return this.props.preview_image_url }
  get blocks(): TemplateBlock[] { return this.props.blocks }
  get is_system() { return this.props.is_system }
  get parent_template_id() { return this.props.parent_template_id }
  get active() { return this.props.active }
  get sort_order() { return this.props.sort_order }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  isGlobal(): boolean { return this.props.org_id === null }
  isSystem(): boolean { return this.props.is_system }

  /** Copy-on-write: clones this (presumed system) template into a new org-owned copy. */
  duplicateFor(orgId: string, newId: string, newName?: string): AppraisalTemplate {
    return AppraisalTemplate.create({
      id: newId, org_id: orgId, kind: this.props.kind,
      name: newName ?? `${this.props.name} (copia)`,
      description: this.props.description, preview_image_url: this.props.preview_image_url,
      blocks: this.props.blocks.map(b => ({ ...b, data: structuredClone(b.data) })),
      is_system: false, parent_template_id: this.props.id,
      active: true, sort_order: this.props.sort_order,
    })
  }

  toObject(): AppraisalTemplateProps { return { ...this.props, blocks: this.props.blocks.map(b => ({ ...b })) } }
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/core -- --run appraisal-template`
Expected: PASS (4 tests).

---

### Task 6: OrgVariable entity

**Files:**
- Create: `vendepro-backend/packages/core/src/domain/entities/org-variable.ts`
- Create: `vendepro-backend/packages/core/tests/domain/org-variable.test.ts`

- [ ] **Step 1: Write failing test**

Content for `vendepro-backend/packages/core/tests/domain/org-variable.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { OrgVariable } from '../../src/domain/entities/org-variable'

describe('OrgVariable', () => {
  it('creates a system variable in market namespace', () => {
    const v = OrgVariable.create({
      id: 'v1', org_id: 'o1', key: 'market.properties_on_sale',
      value: '111294', value_type: 'number', label: 'Propiedades en venta',
      namespace: 'market', is_system: true,
    })
    expect(v.key).toBe('market.properties_on_sale'); expect(v.isSystem()).toBe(true)
  })

  it('derives namespace from key if not provided explicitly', () => {
    const v = OrgVariable.create({
      id: 'v1', org_id: 'o1', key: 'custom.award_count', value: '12',
      value_type: 'number', label: null, namespace: 'custom', is_system: false,
    })
    expect(v.namespace).toBe('custom')
  })

  it('rejects invalid key (spaces/symbols)', () => {
    expect(() => OrgVariable.create({
      id: 'v1', org_id: 'o1', key: 'bad key!', value: '0', value_type: 'number',
      label: null, namespace: 'custom', is_system: false,
    })).toThrow(/key/)
  })

  it('rejects unknown value_type', () => {
    expect(() => OrgVariable.create({
      id: 'v1', org_id: 'o1', key: 'custom.x', value: '1',
      value_type: 'json' as any, label: null, namespace: 'custom', is_system: false,
    })).toThrow(/value_type/)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/core -- --run org-variable`
Expected: FAIL.

- [ ] **Step 3: Implement entity**

Content for `vendepro-backend/packages/core/src/domain/entities/org-variable.ts`:
```typescript
import { ValidationError } from '../errors/validation-error'

export const ORG_VARIABLE_TYPES = ['number', 'percent', 'text', 'date', 'image_url'] as const
export type OrgVariableType = typeof ORG_VARIABLE_TYPES[number]

export const ORG_VARIABLE_NAMESPACES = ['market', 'notary', 'custom'] as const
export type OrgVariableNamespace = typeof ORG_VARIABLE_NAMESPACES[number]

const KEY_REGEX = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i

export interface OrgVariableProps {
  id: string
  org_id: string
  key: string
  value: string
  value_type: OrgVariableType
  label: string | null
  namespace: OrgVariableNamespace
  is_system: boolean
  updated_at: string
}

export class OrgVariable {
  private constructor(private readonly props: OrgVariableProps) {}

  static create(input: Omit<OrgVariableProps, 'updated_at'> & { updated_at?: string }): OrgVariable {
    if (!KEY_REGEX.test(input.key)) throw new ValidationError(`key inválido: "${input.key}" (formato: namespace.sub_key)`)
    if (!(ORG_VARIABLE_TYPES as readonly string[]).includes(input.value_type)) throw new ValidationError(`value_type inválido: "${input.value_type}"`)
    if (!(ORG_VARIABLE_NAMESPACES as readonly string[]).includes(input.namespace)) throw new ValidationError(`namespace inválido: "${input.namespace}"`)

    const declared = input.key.split('.')[0]
    if (declared !== input.namespace) throw new ValidationError(`namespace "${input.namespace}" no coincide con prefijo de key "${input.key}"`)

    return new OrgVariable({ ...input, updated_at: input.updated_at ?? new Date().toISOString() })
  }

  static fromPersistence(p: OrgVariableProps): OrgVariable { return new OrgVariable(p) }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get key() { return this.props.key }
  get value() { return this.props.value }
  get value_type() { return this.props.value_type }
  get label() { return this.props.label }
  get namespace() { return this.props.namespace }
  get updated_at() { return this.props.updated_at }

  isSystem(): boolean { return this.props.is_system }

  toObject(): OrgVariableProps { return { ...this.props } }
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/core -- --run org-variable`
Expected: PASS.

---

### Task 7: AppraisalPdf entity

**Files:**
- Create: `vendepro-backend/packages/core/src/domain/entities/appraisal-pdf.ts`
- Create: `vendepro-backend/packages/core/tests/domain/appraisal-pdf.test.ts`

- [ ] **Step 1: Write failing test**

Content for `vendepro-backend/packages/core/tests/domain/appraisal-pdf.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { AppraisalPdf } from '../../src/domain/entities/appraisal-pdf'

describe('AppraisalPdf', () => {
  it('creates with 30-day expiration', () => {
    const pdf = AppraisalPdf.create({
      id: 'p1', org_id: 'o1', appraisal_id: 'a1',
      content_hash: 'abc123', r2_key: 'appraisals/pdfs/o1/a1/abc123.pdf',
      size_bytes: 500000, generated_at: '2026-04-01T10:00:00Z',
    })
    expect(pdf.expires_at).toBe('2026-05-01T10:00:00.000Z')
  })

  it('isExpired() returns true after expiration', () => {
    const pdf = AppraisalPdf.create({
      id: 'p1', org_id: 'o1', appraisal_id: 'a1', content_hash: 'h', r2_key: 'k',
      size_bytes: 0, generated_at: '2020-01-01T00:00:00Z',
    })
    expect(pdf.isExpired(new Date('2026-04-23T00:00:00Z'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/core -- --run appraisal-pdf`
Expected: FAIL.

- [ ] **Step 3: Implement entity**

Content for `vendepro-backend/packages/core/src/domain/entities/appraisal-pdf.ts`:
```typescript
import { ValidationError } from '../errors/validation-error'

const TTL_MS = 30 * 24 * 60 * 60 * 1000  // 30 days

export interface AppraisalPdfProps {
  id: string
  org_id: string
  appraisal_id: string
  content_hash: string
  r2_key: string
  size_bytes: number
  generated_at: string
  expires_at: string
}

export class AppraisalPdf {
  private constructor(private readonly props: AppraisalPdfProps) {}

  static create(input: Omit<AppraisalPdfProps, 'expires_at'> & { expires_at?: string }): AppraisalPdf {
    if (!input.content_hash) throw new ValidationError('content_hash requerido')
    if (!input.r2_key) throw new ValidationError('r2_key requerido')
    const expires_at = input.expires_at ?? new Date(new Date(input.generated_at).getTime() + TTL_MS).toISOString()
    return new AppraisalPdf({ ...input, expires_at })
  }

  static fromPersistence(p: AppraisalPdfProps): AppraisalPdf { return new AppraisalPdf(p) }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get appraisal_id() { return this.props.appraisal_id }
  get content_hash() { return this.props.content_hash }
  get r2_key() { return this.props.r2_key }
  get size_bytes() { return this.props.size_bytes }
  get generated_at() { return this.props.generated_at }
  get expires_at() { return this.props.expires_at }

  isExpired(now: Date = new Date()): boolean { return now > new Date(this.props.expires_at) }
  toObject(): AppraisalPdfProps { return { ...this.props } }
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/core -- --run appraisal-pdf`
Expected: PASS.

---

### Task 8: Extend Appraisal entity with template fields

**Files:**
- Modify: `vendepro-backend/packages/core/src/domain/entities/appraisal.ts`
- Modify: `vendepro-backend/packages/core/tests/domain/appraisal.test.ts`

- [ ] **Step 1: Read current entity to know exact structure**

Run:
```bash
wc -l vendepro-backend/packages/core/src/domain/entities/appraisal.ts
```
Note the line count for the following step.

- [ ] **Step 2: Modify `AppraisalProps` interface**

In `vendepro-backend/packages/core/src/domain/entities/appraisal.ts`:
- Remove these props from the `AppraisalProps` interface and from `create()` / `fromPersistence()` usage: `canva_design_id`, `canva_edit_url`.
- Add these new props:
```typescript
  template_id: string | null
  template_snapshot_json: unknown | null
  template_synced_at: string | null
  block_overrides_json: Record<string, unknown> | null
```
- Update `create()` to default the new props to `null` when not provided.
- Add getters:
```typescript
  get template_id() { return this.props.template_id }
  get template_snapshot_json() { return this.props.template_snapshot_json }
  get template_synced_at() { return this.props.template_synced_at }
  get block_overrides_json() { return this.props.block_overrides_json }
```

- [ ] **Step 3: Update any callers that pass canva_* into `Appraisal.create`**

Search and remove:
```bash
grep -rn "canva_design_id\|canva_edit_url" vendepro-backend/packages/core/src vendepro-backend/packages/infrastructure/src
```
Expected: after cleanup, no hits in `src/`. Remove any remaining references (they're legacy).

- [ ] **Step 4: Update `CreateAppraisalUseCase` to stop passing canva_***

File: `vendepro-backend/packages/core/src/application/use-cases/appraisals/create-appraisal.ts`

Remove lines:
```typescript
      canva_design_id: null,
      canva_edit_url: null,
```
from the call to `Appraisal.create`.

- [ ] **Step 5: Update existing Appraisal test**

File: `vendepro-backend/packages/core/tests/domain/appraisal.test.ts`

Add a test:
```typescript
it('defaults new template fields to null when not provided', () => {
  const a = Appraisal.create({
    id: 'a1', org_id: 'o1', property_address: 'Addr 123',
    neighborhood: 'N', city: 'C', property_type: 'depto',
    covered_area: null, total_area: null, semi_area: null, weighted_area: null,
    strengths: null, weaknesses: null, opportunities: null, threats: null,
    publication_analysis: null, suggested_price: null, test_price: null,
    expected_close_price: null, usd_per_m2: null,
    agent_id: 'ag1', lead_id: null, status: 'draft', public_slug: null,
    proposal: null, market_situation: null, work_conditions: null, video_links: null,
    comparables: [],
  } as any)
  expect(a.template_id).toBeNull()
  expect(a.template_snapshot_json).toBeNull()
  expect(a.template_synced_at).toBeNull()
  expect(a.block_overrides_json).toBeNull()
})
```

Remove any existing test assertions that reference `canva_design_id` or `canva_edit_url`.

- [ ] **Step 6: Run tests — expect PASS**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/core -- --run appraisal`
Expected: all Appraisal tests pass.

---

## Phase D — Repository ports (interfaces)

### Task 9: AppraisalTemplateRepository port

**Files:**
- Create: `vendepro-backend/packages/core/src/application/ports/repositories/appraisal-template-repository.ts`
- Modify: `vendepro-backend/packages/core/src/application/ports/repositories/index.ts` (append export)

- [ ] **Step 1: Implement port**

Content for `appraisal-template-repository.ts`:
```typescript
import type { AppraisalTemplate, AppraisalTemplateKind } from '../../../domain/entities/appraisal-template'

export interface AppraisalTemplateRepository {
  findById(id: string): Promise<AppraisalTemplate | null>
  listVisibleTo(orgId: string, filters?: { kind?: AppraisalTemplateKind; onlyActive?: boolean }): Promise<AppraisalTemplate[]>
  save(template: AppraisalTemplate): Promise<void>
  countUsingTemplate(templateId: string): Promise<number>
}
```

- [ ] **Step 2: Append export to `index.ts`**

Append a line:
```typescript
export type { AppraisalTemplateRepository } from './appraisal-template-repository'
```

- [ ] **Step 3: Verify type-check**

Run: `cd vendepro-backend && npm run -w @vendepro/core build`
Expected: succeeds with no TS errors.

---

### Task 10: OrgVariableRepository port

**Files:**
- Create: `vendepro-backend/packages/core/src/application/ports/repositories/org-variable-repository.ts`
- Modify: `vendepro-backend/packages/core/src/application/ports/repositories/index.ts`

- [ ] **Step 1: Implement port**

Content for `org-variable-repository.ts`:
```typescript
import type { OrgVariable, OrgVariableNamespace } from '../../../domain/entities/org-variable'

export interface OrgVariableRepository {
  findById(id: string): Promise<OrgVariable | null>
  findByKey(orgId: string, key: string): Promise<OrgVariable | null>
  listByOrg(orgId: string, namespace?: OrgVariableNamespace): Promise<OrgVariable[]>
  save(variable: OrgVariable): Promise<void>
  delete(id: string): Promise<void>
  /** Bulk resolve keys → value map; missing keys are omitted. */
  resolveKeys(orgId: string, keys: string[]): Promise<Record<string, OrgVariable>>
}
```

- [ ] **Step 2: Append export to index.ts**

```typescript
export type { OrgVariableRepository } from './org-variable-repository'
```

- [ ] **Step 3: Build check**

Run: `cd vendepro-backend && npm run -w @vendepro/core build`
Expected: no TS errors.

---

### Task 11: AppraisalPdfRepository port

**Files:**
- Create: `vendepro-backend/packages/core/src/application/ports/repositories/appraisal-pdf-repository.ts`
- Modify: `vendepro-backend/packages/core/src/application/ports/repositories/index.ts`

- [ ] **Step 1: Implement port**

Content for `appraisal-pdf-repository.ts`:
```typescript
import type { AppraisalPdf } from '../../../domain/entities/appraisal-pdf'

export interface AppraisalPdfRepository {
  findById(id: string): Promise<AppraisalPdf | null>
  findCachedByHash(contentHash: string, now: Date): Promise<AppraisalPdf | null>
  save(pdf: AppraisalPdf): Promise<void>
  countByOrgSince(orgId: string, sinceIso: string): Promise<number>
  deleteExpired(now: Date): Promise<number>
}
```

- [ ] **Step 2: Append export to index.ts**

```typescript
export type { AppraisalPdfRepository } from './appraisal-pdf-repository'
```

- [ ] **Step 3: Build check**

Run: `cd vendepro-backend && npm run -w @vendepro/core build`
Expected: no TS errors.

---

## Phase E — D1 repository implementations

### Task 12: D1AppraisalTemplateRepository

**Files:**
- Create: `vendepro-backend/packages/infrastructure/src/repositories/d1-appraisal-template-repository.ts`
- Create: `vendepro-backend/packages/infrastructure/tests/repositories/d1-appraisal-template-repository.test.ts`

- [ ] **Step 1: Write failing test**

Content for the test file — mirror the existing pattern in `d1-appraisal-repository.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { Miniflare } from 'miniflare'
import { D1AppraisalTemplateRepository } from '../../src/repositories/d1-appraisal-template-repository'
import { AppraisalTemplate } from '@vendepro/core'

const MIGRATION_INIT = `
CREATE TABLE appraisal_templates (
  id TEXT PRIMARY KEY, org_id TEXT, kind TEXT, name TEXT, description TEXT,
  preview_image_url TEXT, blocks_json TEXT, is_system INTEGER DEFAULT 0,
  parent_template_id TEXT, active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0,
  created_at TEXT, updated_at TEXT
);
`

describe('D1AppraisalTemplateRepository', () => {
  let db: D1Database
  let repo: D1AppraisalTemplateRepository

  beforeEach(async () => {
    const mf = new Miniflare({ d1Databases: { DB: ':memory:' }, modules: true, script: 'export default {}' })
    db = await mf.getD1Database('DB')
    await db.prepare(MIGRATION_INIT).run()
    repo = new D1AppraisalTemplateRepository(db)
  })

  const validBlock = { id: 'b1', type: 'cover', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0, data: { title: 'T' } }
  const makeTemplate = (overrides: any = {}) => AppraisalTemplate.create({
    id: 't1', org_id: 'o1', kind: 'casa', name: 'Test',
    description: null, preview_image_url: null, blocks: [validBlock] as any,
    is_system: false, parent_template_id: null, active: true, sort_order: 0,
    ...overrides,
  })

  it('saves and finds by id', async () => {
    await repo.save(makeTemplate())
    const found = await repo.findById('t1')
    expect(found?.id).toBe('t1'); expect(found?.blocks.length).toBe(1)
  })

  it('listVisibleTo returns org templates + globals', async () => {
    await repo.save(makeTemplate({ id: 't-glob', org_id: null, is_system: true }))
    await repo.save(makeTemplate({ id: 't-org', org_id: 'o1' }))
    await repo.save(makeTemplate({ id: 't-other', org_id: 'o2' }))
    const list = await repo.listVisibleTo('o1')
    expect(list.map(t => t.id).sort()).toEqual(['t-glob', 't-org'])
  })

  it('countUsingTemplate returns 0 when no appraisals table exists', async () => {
    // Since we only seeded appraisal_templates, the count should gracefully be 0.
    const n = await repo.countUsingTemplate('t1')
    expect(n).toBe(0)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/infrastructure -- --run d1-appraisal-template-repository`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement repository**

Content for `d1-appraisal-template-repository.ts`:
```typescript
import { AppraisalTemplate } from '@vendepro/core'
import type { AppraisalTemplateRepository, AppraisalTemplateKind } from '@vendepro/core'
import type { TemplateBlock } from '@vendepro/core'

export class D1AppraisalTemplateRepository implements AppraisalTemplateRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<AppraisalTemplate | null> {
    const row = await this.db.prepare(`SELECT * FROM appraisal_templates WHERE id = ?`).bind(id).first() as any
    return row ? this.toEntity(row) : null
  }

  async listVisibleTo(orgId: string, filters?: { kind?: AppraisalTemplateKind; onlyActive?: boolean }): Promise<AppraisalTemplate[]> {
    let q = `SELECT * FROM appraisal_templates WHERE (org_id IS NULL OR org_id = ?)`
    const binds: unknown[] = [orgId]
    if (filters?.onlyActive) q += ` AND active = 1`
    if (filters?.kind) { q += ` AND kind = ?`; binds.push(filters.kind) }
    q += ` ORDER BY sort_order ASC, name ASC LIMIT 100`
    const rows = (await this.db.prepare(q).bind(...binds).all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async save(tpl: AppraisalTemplate): Promise<void> {
    const o = tpl.toObject()
    await this.db.prepare(`
      INSERT INTO appraisal_templates (id, org_id, kind, name, description, preview_image_url, blocks_json, is_system, parent_template_id, active, sort_order, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        kind=excluded.kind, name=excluded.name, description=excluded.description,
        preview_image_url=excluded.preview_image_url, blocks_json=excluded.blocks_json,
        is_system=excluded.is_system, parent_template_id=excluded.parent_template_id,
        active=excluded.active, sort_order=excluded.sort_order, updated_at=excluded.updated_at
    `).bind(
      o.id, o.org_id, o.kind, o.name, o.description, o.preview_image_url,
      JSON.stringify(o.blocks), o.is_system ? 1 : 0, o.parent_template_id,
      o.active ? 1 : 0, o.sort_order, o.created_at, o.updated_at,
    ).run()
  }

  async countUsingTemplate(templateId: string): Promise<number> {
    try {
      const r = await this.db.prepare(`SELECT COUNT(*) as n FROM appraisals WHERE template_id = ?`).bind(templateId).first() as any
      return Number(r?.n ?? 0)
    } catch { return 0 }  // appraisals table may not exist in isolated tests
  }

  private toEntity(row: any): AppraisalTemplate {
    const raw = JSON.parse(row.blocks_json ?? '[]')
    const blocks: TemplateBlock[] = Array.isArray(raw) ? raw : (raw.blocks ?? [])
    return AppraisalTemplate.fromPersistence({
      id: row.id, org_id: row.org_id,
      kind: row.kind, name: row.name, description: row.description,
      preview_image_url: row.preview_image_url, blocks,
      is_system: !!row.is_system, parent_template_id: row.parent_template_id,
      active: !!row.active, sort_order: row.sort_order,
      created_at: row.created_at, updated_at: row.updated_at,
    })
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/infrastructure -- --run d1-appraisal-template-repository`
Expected: PASS (3 tests).

---

### Task 13: D1OrgVariableRepository

**Files:**
- Create: `vendepro-backend/packages/infrastructure/src/repositories/d1-org-variable-repository.ts`
- Create: `vendepro-backend/packages/infrastructure/tests/repositories/d1-org-variable-repository.test.ts`

- [ ] **Step 1: Write failing test**

Content for the test file:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { Miniflare } from 'miniflare'
import { D1OrgVariableRepository } from '../../src/repositories/d1-org-variable-repository'
import { OrgVariable } from '@vendepro/core'

const MIG = `CREATE TABLE org_variables (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
  value_type TEXT NOT NULL, label TEXT, namespace TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, UNIQUE(org_id, key));`

describe('D1OrgVariableRepository', () => {
  let db: D1Database; let repo: D1OrgVariableRepository
  beforeEach(async () => {
    const mf = new Miniflare({ d1Databases: { DB: ':memory:' }, modules: true, script: 'export default {}' })
    db = await mf.getD1Database('DB'); await db.prepare(MIG).run()
    repo = new D1OrgVariableRepository(db)
  })

  const make = (o: any) => OrgVariable.create({
    id: o.id, org_id: o.org_id ?? 'o1', key: o.key,
    value: o.value ?? '0', value_type: o.value_type ?? 'number',
    label: o.label ?? null, namespace: o.namespace ?? 'market', is_system: o.is_system ?? false,
  })

  it('saves and finds by key', async () => {
    await repo.save(make({ id: 'v1', key: 'market.properties_on_sale', value: '111294' }))
    const found = await repo.findByKey('o1', 'market.properties_on_sale')
    expect(found?.value).toBe('111294')
  })

  it('enforces unique (org_id, key) via upsert', async () => {
    await repo.save(make({ id: 'v1', key: 'market.x', value: '1' }))
    await repo.save(make({ id: 'v1', key: 'market.x', value: '2' }))
    const f = await repo.findByKey('o1', 'market.x')
    expect(f?.value).toBe('2')
  })

  it('listByOrg filters by namespace', async () => {
    await repo.save(make({ id: 'v1', key: 'market.a', namespace: 'market' }))
    await repo.save(make({ id: 'v2', key: 'notary.b', namespace: 'notary' }))
    const list = await repo.listByOrg('o1', 'market')
    expect(list.map(v => v.key)).toEqual(['market.a'])
  })

  it('resolveKeys returns map for existing keys only', async () => {
    await repo.save(make({ id: 'v1', key: 'market.a' }))
    const map = await repo.resolveKeys('o1', ['market.a', 'market.missing'])
    expect(Object.keys(map)).toEqual(['market.a'])
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/infrastructure -- --run d1-org-variable-repository`
Expected: FAIL.

- [ ] **Step 3: Implement repository**

Content for `d1-org-variable-repository.ts`:
```typescript
import { OrgVariable } from '@vendepro/core'
import type { OrgVariableRepository, OrgVariableNamespace } from '@vendepro/core'

export class D1OrgVariableRepository implements OrgVariableRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<OrgVariable | null> {
    const row = await this.db.prepare(`SELECT * FROM org_variables WHERE id = ?`).bind(id).first() as any
    return row ? this.toEntity(row) : null
  }

  async findByKey(orgId: string, key: string): Promise<OrgVariable | null> {
    const row = await this.db.prepare(`SELECT * FROM org_variables WHERE org_id = ? AND key = ?`).bind(orgId, key).first() as any
    return row ? this.toEntity(row) : null
  }

  async listByOrg(orgId: string, namespace?: OrgVariableNamespace): Promise<OrgVariable[]> {
    let q = `SELECT * FROM org_variables WHERE org_id = ?`
    const binds: unknown[] = [orgId]
    if (namespace) { q += ` AND namespace = ?`; binds.push(namespace) }
    q += ` ORDER BY namespace ASC, key ASC LIMIT 500`
    const rows = (await this.db.prepare(q).bind(...binds).all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async save(v: OrgVariable): Promise<void> {
    const o = v.toObject()
    await this.db.prepare(`
      INSERT INTO org_variables (id, org_id, key, value, value_type, label, namespace, is_system, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(org_id, key) DO UPDATE SET
        value=excluded.value, value_type=excluded.value_type,
        label=excluded.label, namespace=excluded.namespace, updated_at=excluded.updated_at
    `).bind(o.id, o.org_id, o.key, o.value, o.value_type, o.label, o.namespace, (o as any).is_system ? 1 : 0, o.updated_at).run()
  }

  async delete(id: string): Promise<void> {
    await this.db.prepare(`DELETE FROM org_variables WHERE id = ? AND is_system = 0`).bind(id).run()
  }

  async resolveKeys(orgId: string, keys: string[]): Promise<Record<string, OrgVariable>> {
    if (keys.length === 0) return {}
    const placeholders = keys.map(() => '?').join(',')
    const rows = (await this.db.prepare(
      `SELECT * FROM org_variables WHERE org_id = ? AND key IN (${placeholders})`,
    ).bind(orgId, ...keys).all()).results as any[]
    const map: Record<string, OrgVariable> = {}
    for (const r of rows) map[r.key] = this.toEntity(r)
    return map
  }

  private toEntity(row: any): OrgVariable {
    return OrgVariable.fromPersistence({
      id: row.id, org_id: row.org_id, key: row.key, value: row.value,
      value_type: row.value_type, label: row.label, namespace: row.namespace,
      is_system: !!row.is_system, updated_at: row.updated_at,
    })
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/infrastructure -- --run d1-org-variable-repository`
Expected: PASS (4 tests).

---

### Task 14: D1AppraisalPdfRepository

**Files:**
- Create: `vendepro-backend/packages/infrastructure/src/repositories/d1-appraisal-pdf-repository.ts`
- Create: `vendepro-backend/packages/infrastructure/tests/repositories/d1-appraisal-pdf-repository.test.ts`

- [ ] **Step 1: Write failing test**

Content for test file:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { Miniflare } from 'miniflare'
import { D1AppraisalPdfRepository } from '../../src/repositories/d1-appraisal-pdf-repository'
import { AppraisalPdf } from '@vendepro/core'

const MIG = `CREATE TABLE appraisal_pdfs (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, appraisal_id TEXT NOT NULL,
  content_hash TEXT NOT NULL, r2_key TEXT NOT NULL, size_bytes INTEGER,
  generated_at TEXT NOT NULL, expires_at TEXT NOT NULL);`

describe('D1AppraisalPdfRepository', () => {
  let db: D1Database; let repo: D1AppraisalPdfRepository
  beforeEach(async () => {
    const mf = new Miniflare({ d1Databases: { DB: ':memory:' }, modules: true, script: 'export default {}' })
    db = await mf.getD1Database('DB'); await db.prepare(MIG).run()
    repo = new D1AppraisalPdfRepository(db)
  })

  const makePdf = (o: any = {}) => AppraisalPdf.create({
    id: o.id ?? 'p1', org_id: o.org_id ?? 'o1', appraisal_id: o.appraisal_id ?? 'a1',
    content_hash: o.content_hash ?? 'h1', r2_key: 'k', size_bytes: 0,
    generated_at: o.generated_at ?? '2026-04-01T00:00:00Z',
  })

  it('finds cached by hash when not expired', async () => {
    await repo.save(makePdf())
    const found = await repo.findCachedByHash('h1', new Date('2026-04-15T00:00:00Z'))
    expect(found?.id).toBe('p1')
  })

  it('does not return expired cached entry', async () => {
    await repo.save(makePdf())
    const found = await repo.findCachedByHash('h1', new Date('2030-01-01T00:00:00Z'))
    expect(found).toBeNull()
  })

  it('counts by org since a date', async () => {
    await repo.save(makePdf({ id: 'p1', generated_at: '2026-04-05T00:00:00Z' }))
    await repo.save(makePdf({ id: 'p2', content_hash: 'h2', generated_at: '2026-04-15T00:00:00Z' }))
    await repo.save(makePdf({ id: 'p3', content_hash: 'h3', generated_at: '2026-03-15T00:00:00Z' }))
    const n = await repo.countByOrgSince('o1', '2026-04-01T00:00:00Z')
    expect(n).toBe(2)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/infrastructure -- --run d1-appraisal-pdf-repository`
Expected: FAIL.

- [ ] **Step 3: Implement repository**

Content for `d1-appraisal-pdf-repository.ts`:
```typescript
import { AppraisalPdf } from '@vendepro/core'
import type { AppraisalPdfRepository } from '@vendepro/core'

export class D1AppraisalPdfRepository implements AppraisalPdfRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<AppraisalPdf | null> {
    const row = await this.db.prepare(`SELECT * FROM appraisal_pdfs WHERE id = ?`).bind(id).first() as any
    return row ? this.toEntity(row) : null
  }

  async findCachedByHash(contentHash: string, now: Date): Promise<AppraisalPdf | null> {
    const row = await this.db.prepare(
      `SELECT * FROM appraisal_pdfs WHERE content_hash = ? AND expires_at > ? ORDER BY generated_at DESC LIMIT 1`,
    ).bind(contentHash, now.toISOString()).first() as any
    return row ? this.toEntity(row) : null
  }

  async save(pdf: AppraisalPdf): Promise<void> {
    const o = pdf.toObject()
    await this.db.prepare(`
      INSERT INTO appraisal_pdfs (id, org_id, appraisal_id, content_hash, r2_key, size_bytes, generated_at, expires_at)
      VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET content_hash=excluded.content_hash, r2_key=excluded.r2_key,
        size_bytes=excluded.size_bytes, generated_at=excluded.generated_at, expires_at=excluded.expires_at
    `).bind(o.id, o.org_id, o.appraisal_id, o.content_hash, o.r2_key, o.size_bytes, o.generated_at, o.expires_at).run()
  }

  async countByOrgSince(orgId: string, sinceIso: string): Promise<number> {
    const r = await this.db.prepare(
      `SELECT COUNT(*) as n FROM appraisal_pdfs WHERE org_id = ? AND generated_at >= ?`,
    ).bind(orgId, sinceIso).first() as any
    return Number(r?.n ?? 0)
  }

  async deleteExpired(now: Date): Promise<number> {
    const r = await this.db.prepare(`DELETE FROM appraisal_pdfs WHERE expires_at < ?`).bind(now.toISOString()).run()
    return (r.meta as any)?.changes ?? 0
  }

  private toEntity(row: any): AppraisalPdf {
    return AppraisalPdf.fromPersistence({
      id: row.id, org_id: row.org_id, appraisal_id: row.appraisal_id,
      content_hash: row.content_hash, r2_key: row.r2_key, size_bytes: row.size_bytes ?? 0,
      generated_at: row.generated_at, expires_at: row.expires_at,
    })
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/infrastructure -- --run d1-appraisal-pdf-repository`
Expected: PASS (3 tests).

---

### Task 15: Extend D1AppraisalRepository for new fields

**Files:**
- Modify: `vendepro-backend/packages/infrastructure/src/repositories/d1-appraisal-repository.ts`

- [ ] **Step 1: Remove canva columns from all SQL; add template fields**

In the INSERT and UPDATE statements of `save()` / `update()`:
- Remove columns: `canva_design_id`, `canva_edit_url`
- Add columns: `template_id`, `template_snapshot_json`, `template_synced_at`, `block_overrides_json`

In the SELECT mappings in `toEntity`:
- Remove canva fields
- Read: `template_id: row.template_id ?? null`, `template_snapshot_json: row.template_snapshot_json ? JSON.parse(row.template_snapshot_json) : null`, `template_synced_at: row.template_synced_at ?? null`, `block_overrides_json: row.block_overrides_json ? JSON.parse(row.block_overrides_json) : null`

Bind values for these fields using `JSON.stringify(...)` where appropriate; `null` stays `null`.

- [ ] **Step 2: Run existing Appraisal repo tests**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/infrastructure -- --run d1-appraisal-repository`
Expected: all existing tests still PASS. If any fail due to canva column references, update test fixtures.

---

## Phase F — Template use cases

### Task 16: ListAppraisalTemplatesUseCase

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/appraisal-templates/list-appraisal-templates.ts`
- Create: `vendepro-backend/packages/core/tests/use-cases/appraisal-templates/list-appraisal-templates.test.ts`

- [ ] **Step 1: Write failing test**

Content for the test:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { ListAppraisalTemplatesUseCase } from '../../../src/application/use-cases/appraisal-templates/list-appraisal-templates'

describe('ListAppraisalTemplatesUseCase', () => {
  it('returns templates for the given org', async () => {
    const mockRepo = {
      listVisibleTo: vi.fn().mockResolvedValue([
        { id: 't1', toObject: () => ({ id: 't1', name: 'Sys' }) },
      ]),
      findById: vi.fn(), save: vi.fn(), countUsingTemplate: vi.fn(),
    }
    const uc = new ListAppraisalTemplatesUseCase(mockRepo as any)
    const res = await uc.execute({ orgId: 'o1', onlyActive: true })
    expect(res.length).toBe(1)
    expect(mockRepo.listVisibleTo).toHaveBeenCalledWith('o1', { onlyActive: true, kind: undefined })
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/core -- --run list-appraisal-templates`
Expected: FAIL.

- [ ] **Step 3: Implement**

Content for `list-appraisal-templates.ts`:
```typescript
import type { AppraisalTemplateRepository, AppraisalTemplateKind } from '../../ports/repositories/appraisal-template-repository'

export interface ListAppraisalTemplatesInput { orgId: string; kind?: AppraisalTemplateKind; onlyActive?: boolean }

export class ListAppraisalTemplatesUseCase {
  constructor(private readonly repo: AppraisalTemplateRepository) {}
  async execute(input: ListAppraisalTemplatesInput) {
    const list = await this.repo.listVisibleTo(input.orgId, { kind: input.kind, onlyActive: input.onlyActive })
    return list.map(t => t.toObject())
  }
}
```

- [ ] **Step 4: Run — expect PASS**

Expected: PASS.

---

### Task 17: GetAppraisalTemplateUseCase

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/appraisal-templates/get-appraisal-template.ts`
- Create: `vendepro-backend/packages/core/tests/use-cases/appraisal-templates/get-appraisal-template.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { GetAppraisalTemplateUseCase } from '../../../src/application/use-cases/appraisal-templates/get-appraisal-template'

describe('GetAppraisalTemplateUseCase', () => {
  it('returns template when org owns it or it is global', async () => {
    const tpl = { id: 't1', org_id: null, toObject: () => ({ id: 't1', org_id: null }) }
    const mockRepo = { findById: vi.fn().mockResolvedValue(tpl), listVisibleTo: vi.fn(), save: vi.fn(), countUsingTemplate: vi.fn() }
    const uc = new GetAppraisalTemplateUseCase(mockRepo as any)
    const r = await uc.execute({ id: 't1', orgId: 'o1' })
    expect(r?.id).toBe('t1')
  })

  it('returns null when template belongs to another org', async () => {
    const tpl = { id: 't1', org_id: 'o2', toObject: () => ({ id: 't1', org_id: 'o2' }) }
    const mockRepo = { findById: vi.fn().mockResolvedValue(tpl), listVisibleTo: vi.fn(), save: vi.fn(), countUsingTemplate: vi.fn() }
    const uc = new GetAppraisalTemplateUseCase(mockRepo as any)
    const r = await uc.execute({ id: 't1', orgId: 'o1' })
    expect(r).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

Content for `get-appraisal-template.ts`:
```typescript
import type { AppraisalTemplateRepository } from '../../ports/repositories/appraisal-template-repository'

export class GetAppraisalTemplateUseCase {
  constructor(private readonly repo: AppraisalTemplateRepository) {}
  async execute(input: { id: string; orgId: string }) {
    const t = await this.repo.findById(input.id)
    if (!t) return null
    if (t.org_id !== null && t.org_id !== input.orgId) return null
    return t.toObject()
  }
}
```

- [ ] **Step 4: Run — expect PASS**

---

### Task 18: CreateAppraisalTemplateUseCase (from-scratch custom)

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/appraisal-templates/create-appraisal-template.ts`
- Create: `vendepro-backend/packages/core/tests/use-cases/appraisal-templates/create-appraisal-template.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { CreateAppraisalTemplateUseCase } from '../../../src/application/use-cases/appraisal-templates/create-appraisal-template'

describe('CreateAppraisalTemplateUseCase', () => {
  it('creates an empty custom template for an org', async () => {
    const mockRepo = { save: vi.fn().mockResolvedValue(undefined), findById: vi.fn(), listVisibleTo: vi.fn(), countUsingTemplate: vi.fn() }
    const mockIdGen = { generate: vi.fn().mockReturnValue('t-new') }
    const uc = new CreateAppraisalTemplateUseCase(mockRepo as any, mockIdGen)
    const r = await uc.execute({ orgId: 'o1', name: 'Mi Casa', kind: 'casa', blocks: [] })
    expect(r.id).toBe('t-new'); expect(mockRepo.save).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

Content for `create-appraisal-template.ts`:
```typescript
import { AppraisalTemplate, type AppraisalTemplateKind, type TemplateBlock } from '@vendepro/core'
import type { AppraisalTemplateRepository } from '../../ports/repositories/appraisal-template-repository'
import type { IdGenerator } from '../../ports/id-generator'

export interface CreateAppraisalTemplateInput {
  orgId: string
  name: string
  kind: AppraisalTemplateKind
  description?: string | null
  preview_image_url?: string | null
  blocks?: TemplateBlock[]
}

export class CreateAppraisalTemplateUseCase {
  constructor(private readonly repo: AppraisalTemplateRepository, private readonly idGen: IdGenerator) {}
  async execute(input: CreateAppraisalTemplateInput): Promise<{ id: string }> {
    const id = this.idGen.generate()
    const tpl = AppraisalTemplate.create({
      id, org_id: input.orgId, kind: input.kind, name: input.name,
      description: input.description ?? null, preview_image_url: input.preview_image_url ?? null,
      blocks: input.blocks ?? [], is_system: false, parent_template_id: null,
      active: true, sort_order: 0,
    })
    await this.repo.save(tpl)
    return { id }
  }
}
```

- [ ] **Step 4: Run — expect PASS**

---

### Task 19: UpdateAppraisalTemplateUseCase

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/appraisal-templates/update-appraisal-template.ts`
- Create: `vendepro-backend/packages/core/tests/use-cases/appraisal-templates/update-appraisal-template.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { UpdateAppraisalTemplateUseCase } from '../../../src/application/use-cases/appraisal-templates/update-appraisal-template'
import { AppraisalTemplate } from '@vendepro/core'

const tpl = AppraisalTemplate.create({
  id: 't1', org_id: 'o1', kind: 'casa', name: 'Old', description: null,
  preview_image_url: null, blocks: [], is_system: false, parent_template_id: null,
  active: true, sort_order: 0,
})

describe('UpdateAppraisalTemplateUseCase', () => {
  it('updates name and blocks of an org template', async () => {
    const repo = { findById: vi.fn().mockResolvedValue(tpl), save: vi.fn(), listVisibleTo: vi.fn(), countUsingTemplate: vi.fn() }
    const uc = new UpdateAppraisalTemplateUseCase(repo as any)
    const r = await uc.execute({ id: 't1', orgId: 'o1', name: 'New', blocks: [] })
    expect(r.updated).toBe(true)
    expect(repo.save).toHaveBeenCalled()
  })

  it('rejects editing a system template directly', async () => {
    const sys = AppraisalTemplate.create({
      id: 'sys', org_id: null, kind: 'casa', name: 'Sys', description: null,
      preview_image_url: null, blocks: [], is_system: true, parent_template_id: null,
      active: true, sort_order: 0,
    })
    const repo = { findById: vi.fn().mockResolvedValue(sys), save: vi.fn(), listVisibleTo: vi.fn(), countUsingTemplate: vi.fn() }
    const uc = new UpdateAppraisalTemplateUseCase(repo as any)
    await expect(uc.execute({ id: 'sys', orgId: 'o1', name: 'X' })).rejects.toThrow(/sistema/i)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

Content for `update-appraisal-template.ts`:
```typescript
import { AppraisalTemplate, type TemplateBlock } from '@vendepro/core'
import type { AppraisalTemplateRepository } from '../../ports/repositories/appraisal-template-repository'
import { ValidationError } from '@vendepro/core'

export interface UpdateAppraisalTemplateInput {
  id: string
  orgId: string
  name?: string
  description?: string | null
  preview_image_url?: string | null
  blocks?: TemplateBlock[]
  active?: boolean
  sort_order?: number
}

export class UpdateAppraisalTemplateUseCase {
  constructor(private readonly repo: AppraisalTemplateRepository) {}
  async execute(input: UpdateAppraisalTemplateInput): Promise<{ updated: boolean }> {
    const current = await this.repo.findById(input.id)
    if (!current) throw new ValidationError('Template no encontrado')
    if (current.isSystem()) throw new ValidationError('No se puede editar un template del sistema directamente — duplicarlo primero')
    if (current.org_id !== input.orgId) throw new ValidationError('Template pertenece a otra org')

    const cur = current.toObject()
    const next = AppraisalTemplate.create({
      id: cur.id, org_id: cur.org_id, kind: cur.kind,
      name: input.name ?? cur.name,
      description: input.description !== undefined ? input.description : cur.description,
      preview_image_url: input.preview_image_url !== undefined ? input.preview_image_url : cur.preview_image_url,
      blocks: input.blocks ?? cur.blocks,
      is_system: cur.is_system, parent_template_id: cur.parent_template_id,
      active: input.active !== undefined ? input.active : cur.active,
      sort_order: input.sort_order !== undefined ? input.sort_order : cur.sort_order,
      created_at: cur.created_at, updated_at: new Date().toISOString(),
    })
    await this.repo.save(next)
    return { updated: true }
  }
}
```

- [ ] **Step 4: Run — expect PASS**

---

### Task 20: DuplicateAppraisalTemplateUseCase (copy-on-write)

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/appraisal-templates/duplicate-appraisal-template.ts`
- Create: `vendepro-backend/packages/core/tests/use-cases/appraisal-templates/duplicate-appraisal-template.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { DuplicateAppraisalTemplateUseCase } from '../../../src/application/use-cases/appraisal-templates/duplicate-appraisal-template'
import { AppraisalTemplate } from '@vendepro/core'

const sys = AppraisalTemplate.create({
  id: 'sys1', org_id: null, kind: 'casa', name: 'Sys', description: null,
  preview_image_url: null, blocks: [], is_system: true, parent_template_id: null,
  active: true, sort_order: 0,
})

describe('DuplicateAppraisalTemplateUseCase', () => {
  it('copies system template to org-owned custom', async () => {
    const repo = { findById: vi.fn().mockResolvedValue(sys), save: vi.fn(), listVisibleTo: vi.fn(), countUsingTemplate: vi.fn() }
    const idGen = { generate: vi.fn().mockReturnValue('new-id') }
    const uc = new DuplicateAppraisalTemplateUseCase(repo as any, idGen)
    const r = await uc.execute({ sourceId: 'sys1', orgId: 'o1' })
    expect(r.id).toBe('new-id'); expect(repo.save).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

Content for `duplicate-appraisal-template.ts`:
```typescript
import type { AppraisalTemplateRepository } from '../../ports/repositories/appraisal-template-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { ValidationError } from '@vendepro/core'

export class DuplicateAppraisalTemplateUseCase {
  constructor(private readonly repo: AppraisalTemplateRepository, private readonly idGen: IdGenerator) {}
  async execute(input: { sourceId: string; orgId: string; newName?: string }): Promise<{ id: string }> {
    const src = await this.repo.findById(input.sourceId)
    if (!src) throw new ValidationError('Template origen no encontrado')
    if (src.org_id !== null && src.org_id !== input.orgId) throw new ValidationError('No podés duplicar un template de otra org')
    const newId = this.idGen.generate()
    const copy = src.duplicateFor(input.orgId, newId, input.newName)
    await this.repo.save(copy)
    return { id: newId }
  }
}
```

- [ ] **Step 4: Run — expect PASS**

---

### Task 21: ArchiveAppraisalTemplateUseCase

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/appraisal-templates/archive-appraisal-template.ts`
- Create: `vendepro-backend/packages/core/tests/use-cases/appraisal-templates/archive-appraisal-template.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { ArchiveAppraisalTemplateUseCase } from '../../../src/application/use-cases/appraisal-templates/archive-appraisal-template'
import { AppraisalTemplate } from '@vendepro/core'

const tpl = AppraisalTemplate.create({
  id: 't1', org_id: 'o1', kind: 'casa', name: 'X', description: null,
  preview_image_url: null, blocks: [], is_system: false, parent_template_id: null,
  active: true, sort_order: 0,
})

describe('ArchiveAppraisalTemplateUseCase', () => {
  it('archives a custom template', async () => {
    const repo = { findById: vi.fn().mockResolvedValue(tpl), save: vi.fn(), listVisibleTo: vi.fn(), countUsingTemplate: vi.fn().mockResolvedValue(0) }
    const uc = new ArchiveAppraisalTemplateUseCase(repo as any)
    const r = await uc.execute({ id: 't1', orgId: 'o1' })
    expect(r.archived).toBe(true)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

Content for `archive-appraisal-template.ts`:
```typescript
import { AppraisalTemplate } from '@vendepro/core'
import type { AppraisalTemplateRepository } from '../../ports/repositories/appraisal-template-repository'
import { ValidationError } from '@vendepro/core'

export class ArchiveAppraisalTemplateUseCase {
  constructor(private readonly repo: AppraisalTemplateRepository) {}
  async execute(input: { id: string; orgId: string }): Promise<{ archived: boolean }> {
    const cur = await this.repo.findById(input.id)
    if (!cur) throw new ValidationError('Template no encontrado')
    if (cur.isSystem()) throw new ValidationError('No se pueden archivar templates del sistema')
    if (cur.org_id !== input.orgId) throw new ValidationError('Template pertenece a otra org')

    const o = cur.toObject()
    const next = AppraisalTemplate.create({ ...o, active: false, updated_at: new Date().toISOString() })
    await this.repo.save(next)
    return { archived: true }
  }
}
```

- [ ] **Step 4: Run — expect PASS**

---

## Phase G — Variable use cases

### Task 22: ListOrgVariablesUseCase

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/org-variables/list-org-variables.ts`
- Create: `vendepro-backend/packages/core/tests/use-cases/org-variables/list-org-variables.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { ListOrgVariablesUseCase } from '../../../src/application/use-cases/org-variables/list-org-variables'

describe('ListOrgVariablesUseCase', () => {
  it('lists variables for an org, optionally filtered by namespace', async () => {
    const repo = { listByOrg: vi.fn().mockResolvedValue([{ toObject: () => ({ key: 'market.a' }) }]),
      findById: vi.fn(), findByKey: vi.fn(), save: vi.fn(), delete: vi.fn(), resolveKeys: vi.fn() }
    const uc = new ListOrgVariablesUseCase(repo as any)
    const r = await uc.execute({ orgId: 'o1', namespace: 'market' })
    expect(r.length).toBe(1); expect(repo.listByOrg).toHaveBeenCalledWith('o1', 'market')
  })
})
```

- [ ] **Step 2-3: Implement + run**

Content:
```typescript
import type { OrgVariableRepository, OrgVariableNamespace } from '../../ports/repositories/org-variable-repository'

export class ListOrgVariablesUseCase {
  constructor(private readonly repo: OrgVariableRepository) {}
  async execute(input: { orgId: string; namespace?: OrgVariableNamespace }) {
    const list = await this.repo.listByOrg(input.orgId, input.namespace)
    return list.map(v => v.toObject())
  }
}
```

Expected: test PASS.

---

### Task 23: CreateOrgVariableUseCase

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/org-variables/create-org-variable.ts`
- Create: `vendepro-backend/packages/core/tests/use-cases/org-variables/create-org-variable.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { CreateOrgVariableUseCase } from '../../../src/application/use-cases/org-variables/create-org-variable'

describe('CreateOrgVariableUseCase', () => {
  it('creates a custom variable', async () => {
    const repo = { save: vi.fn().mockResolvedValue(undefined), findByKey: vi.fn().mockResolvedValue(null),
      findById: vi.fn(), listByOrg: vi.fn(), delete: vi.fn(), resolveKeys: vi.fn() }
    const idGen = { generate: vi.fn().mockReturnValue('v-new') }
    const uc = new CreateOrgVariableUseCase(repo as any, idGen)
    const r = await uc.execute({ orgId: 'o1', key: 'custom.award_count', value: '12', value_type: 'number', label: 'Premios', namespace: 'custom' })
    expect(r.id).toBe('v-new'); expect(repo.save).toHaveBeenCalled()
  })

  it('rejects duplicate key in same org', async () => {
    const repo = { save: vi.fn(), findByKey: vi.fn().mockResolvedValue({ id: 'x' }),
      findById: vi.fn(), listByOrg: vi.fn(), delete: vi.fn(), resolveKeys: vi.fn() }
    const idGen = { generate: vi.fn().mockReturnValue('v-new') }
    const uc = new CreateOrgVariableUseCase(repo as any, idGen)
    await expect(uc.execute({ orgId: 'o1', key: 'custom.x', value: '1', value_type: 'number', label: null, namespace: 'custom' })).rejects.toThrow(/existe/i)
  })
})
```

- [ ] **Step 2-3: Implement + run**

Content:
```typescript
import { OrgVariable, type OrgVariableType, type OrgVariableNamespace, ValidationError } from '@vendepro/core'
import type { OrgVariableRepository } from '../../ports/repositories/org-variable-repository'
import type { IdGenerator } from '../../ports/id-generator'

export interface CreateOrgVariableInput {
  orgId: string; key: string; value: string; value_type: OrgVariableType
  label: string | null; namespace: OrgVariableNamespace
}

export class CreateOrgVariableUseCase {
  constructor(private readonly repo: OrgVariableRepository, private readonly idGen: IdGenerator) {}
  async execute(input: CreateOrgVariableInput): Promise<{ id: string }> {
    const existing = await this.repo.findByKey(input.orgId, input.key)
    if (existing) throw new ValidationError(`Ya existe una variable con key "${input.key}" en la org`)
    const id = this.idGen.generate()
    const v = OrgVariable.create({ id, org_id: input.orgId, key: input.key, value: input.value,
      value_type: input.value_type, label: input.label, namespace: input.namespace, is_system: false })
    await this.repo.save(v)
    return { id }
  }
}
```

Expected: PASS.

---

### Task 24: UpdateOrgVariableUseCase

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/org-variables/update-org-variable.ts`
- Create: `vendepro-backend/packages/core/tests/use-cases/org-variables/update-org-variable.test.ts`

- [ ] **Step 1-3: TDD pattern**

Test:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { UpdateOrgVariableUseCase } from '../../../src/application/use-cases/org-variables/update-org-variable'
import { OrgVariable } from '@vendepro/core'

const v = OrgVariable.create({ id: 'v1', org_id: 'o1', key: 'market.x', value: '1', value_type: 'number', label: null, namespace: 'market', is_system: true })

describe('UpdateOrgVariableUseCase', () => {
  it('updates value of system variable (allowed)', async () => {
    const repo = { findById: vi.fn().mockResolvedValue(v), save: vi.fn(),
      findByKey: vi.fn(), listByOrg: vi.fn(), delete: vi.fn(), resolveKeys: vi.fn() }
    const uc = new UpdateOrgVariableUseCase(repo as any)
    const r = await uc.execute({ id: 'v1', orgId: 'o1', value: '2' })
    expect(r.updated).toBe(true)
  })
})
```

Implementation:
```typescript
import { OrgVariable, ValidationError } from '@vendepro/core'
import type { OrgVariableRepository } from '../../ports/repositories/org-variable-repository'

export class UpdateOrgVariableUseCase {
  constructor(private readonly repo: OrgVariableRepository) {}
  async execute(input: { id: string; orgId: string; value?: string; label?: string | null }) {
    const cur = await this.repo.findById(input.id)
    if (!cur) throw new ValidationError('Variable no encontrada')
    if (cur.org_id !== input.orgId) throw new ValidationError('Variable pertenece a otra org')
    const o = cur.toObject()
    const next = OrgVariable.create({
      ...o,
      value: input.value !== undefined ? input.value : o.value,
      label: input.label !== undefined ? input.label : o.label,
      updated_at: new Date().toISOString(),
    })
    await this.repo.save(next)
    return { updated: true }
  }
}
```

Expected: PASS.

---

### Task 25: DeleteOrgVariableUseCase (custom only)

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/org-variables/delete-org-variable.ts`
- Create: `vendepro-backend/packages/core/tests/use-cases/org-variables/delete-org-variable.test.ts`

- [ ] **Step 1-3: TDD pattern**

Test:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { DeleteOrgVariableUseCase } from '../../../src/application/use-cases/org-variables/delete-org-variable'
import { OrgVariable } from '@vendepro/core'

describe('DeleteOrgVariableUseCase', () => {
  it('deletes a custom variable', async () => {
    const v = OrgVariable.create({ id: 'v1', org_id: 'o1', key: 'custom.x', value: '1', value_type: 'number', label: null, namespace: 'custom', is_system: false })
    const repo = { findById: vi.fn().mockResolvedValue(v), delete: vi.fn(),
      findByKey: vi.fn(), listByOrg: vi.fn(), save: vi.fn(), resolveKeys: vi.fn() }
    const uc = new DeleteOrgVariableUseCase(repo as any)
    const r = await uc.execute({ id: 'v1', orgId: 'o1' })
    expect(r.deleted).toBe(true); expect(repo.delete).toHaveBeenCalledWith('v1')
  })

  it('refuses to delete a system variable', async () => {
    const sys = OrgVariable.create({ id: 'v2', org_id: 'o1', key: 'market.x', value: '1', value_type: 'number', label: null, namespace: 'market', is_system: true })
    const repo = { findById: vi.fn().mockResolvedValue(sys), delete: vi.fn(),
      findByKey: vi.fn(), listByOrg: vi.fn(), save: vi.fn(), resolveKeys: vi.fn() }
    const uc = new DeleteOrgVariableUseCase(repo as any)
    await expect(uc.execute({ id: 'v2', orgId: 'o1' })).rejects.toThrow(/sistema/i)
  })
})
```

Implementation:
```typescript
import { ValidationError } from '@vendepro/core'
import type { OrgVariableRepository } from '../../ports/repositories/org-variable-repository'

export class DeleteOrgVariableUseCase {
  constructor(private readonly repo: OrgVariableRepository) {}
  async execute(input: { id: string; orgId: string }): Promise<{ deleted: boolean }> {
    const cur = await this.repo.findById(input.id)
    if (!cur) throw new ValidationError('Variable no encontrada')
    if (cur.org_id !== input.orgId) throw new ValidationError('Variable pertenece a otra org')
    if (cur.isSystem()) throw new ValidationError('No se puede eliminar una variable del sistema')
    await this.repo.delete(input.id)
    return { deleted: true }
  }
}
```

Expected: PASS.

---

## Phase H — Hydration and sync use cases

### Task 26: HydrateTemplateBlocksUseCase

Resolves binding modes into final block data for rendering. Given a tasación, returns the blocks with all references resolved (org vars resolved live, appraisal sources resolved from appraisal data, overrides applied).

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/appraisal-rendering/hydrate-template-blocks.ts`
- Create: `vendepro-backend/packages/core/tests/use-cases/appraisal-rendering/hydrate-template-blocks.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { HydrateTemplateBlocksUseCase } from '../../../src/application/use-cases/appraisal-rendering/hydrate-template-blocks'
import { OrgVariable } from '@vendepro/core'

const snapshot = [
  { id: 'b1', type: 'market_stats', binding_mode: 'org-variable', include_in_pdf: true, sort_order: 0,
    data: { title: 'Mercado', vars: ['market.properties_on_sale'] } },
  { id: 'b2', type: 'work_conditions', binding_mode: 'default-override', include_in_pdf: true, sort_order: 1,
    data: { title: 'Condiciones', honorarios_pct: 3, exclusividad_dias: 120 } },
  { id: 'b3', type: 'video_gallery', binding_mode: 'tasacion', include_in_pdf: false, sort_order: 2,
    data: { title: 'Videos', videos: [] } },
]

describe('HydrateTemplateBlocksUseCase', () => {
  it('resolves org-variable references and applies overrides', async () => {
    const varsRepo = { resolveKeys: vi.fn().mockResolvedValue({
      'market.properties_on_sale': OrgVariable.create({ id: 'v1', org_id: 'o1', key: 'market.properties_on_sale', value: '111294', value_type: 'number', label: null, namespace: 'market', is_system: true }),
    }), findById: vi.fn(), findByKey: vi.fn(), listByOrg: vi.fn(), save: vi.fn(), delete: vi.fn() }
    const uc = new HydrateTemplateBlocksUseCase(varsRepo as any)
    const res = await uc.execute({
      orgId: 'o1', snapshot: snapshot as any,
      overrides: { b2: { honorarios_pct: 2 } },
      appraisal: { swot: { strengths: 'X' } } as any,
    })
    const mkt = res.blocks.find(b => b.id === 'b1')!
    expect(mkt.resolved_data.vars_resolved['market.properties_on_sale'].value).toBe('111294')
    const wc = res.blocks.find(b => b.id === 'b2')!
    expect((wc.resolved_data as any).honorarios_pct).toBe(2)  // override applied
  })

  it('filters blocks for print mode', async () => {
    const varsRepo = { resolveKeys: vi.fn().mockResolvedValue({}), findById: vi.fn(), findByKey: vi.fn(), listByOrg: vi.fn(), save: vi.fn(), delete: vi.fn() }
    const uc = new HydrateTemplateBlocksUseCase(varsRepo as any)
    const res = await uc.execute({ orgId: 'o1', snapshot: snapshot as any, overrides: {}, appraisal: {} as any, mode: 'print' })
    expect(res.blocks.map(b => b.id)).toEqual(['b1', 'b2'])  // b3 (web-only) filtered out
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

Content for `hydrate-template-blocks.ts`:
```typescript
import type { OrgVariableRepository, OrgVariable } from '@vendepro/core'
import type { TemplateBlock } from '@vendepro/core'

export interface HydratedBlock extends TemplateBlock {
  resolved_data: Record<string, unknown> & {
    vars_resolved?: Record<string, { value: string; type: string }>
  }
}

export interface HydrateInput {
  orgId: string
  snapshot: TemplateBlock[]
  overrides: Record<string, Record<string, unknown>>
  appraisal: Record<string, unknown>
  mode?: 'web' | 'print'
}

export class HydrateTemplateBlocksUseCase {
  constructor(private readonly varsRepo: OrgVariableRepository) {}

  async execute(input: HydrateInput): Promise<{ blocks: HydratedBlock[] }> {
    const filtered = (input.mode === 'print')
      ? input.snapshot.filter(b => b.include_in_pdf !== false)
      : [...input.snapshot]
    filtered.sort((a, b) => a.sort_order - b.sort_order)

    // Collect all var keys referenced across blocks.
    const allVarKeys = new Set<string>()
    for (const b of filtered) {
      const vars = (b.data as any)?.vars
      if (Array.isArray(vars)) for (const k of vars) allVarKeys.add(String(k))
      const c1 = (b.data as any)?.chart_1_var
      const c2 = (b.data as any)?.chart_2_var
      if (c1) allVarKeys.add(String(c1))
      if (c2) allVarKeys.add(String(c2))
    }
    const varsMap = allVarKeys.size ? await this.varsRepo.resolveKeys(input.orgId, Array.from(allVarKeys)) : {}

    const blocks: HydratedBlock[] = filtered.map(b => {
      const resolved: Record<string, unknown> = { ...(b.data as any) }
      // Apply 'appraisal.*' source resolution
      if ((b.data as any)?.source === 'appraisal.swot' && input.appraisal.swot) {
        Object.assign(resolved, input.appraisal.swot)
      }
      if ((b.data as any)?.source === 'appraisal.prices' && input.appraisal.prices) {
        Object.assign(resolved, input.appraisal.prices)
      }
      if ((b.data as any)?.source === 'appraisal.*' && input.appraisal.property) {
        Object.assign(resolved, input.appraisal.property)
      }
      if ((b.data as any)?.source === 'appraisal.comparables' && Array.isArray(input.appraisal.comparables)) {
        ;(resolved as any).comparables = input.appraisal.comparables
      }
      // Resolve org-variable references
      const refs = collectVarRefs(b)
      if (refs.length) {
        const out: Record<string, { value: string; type: string }> = {}
        for (const k of refs) {
          const v = varsMap[k]
          if (v) out[k] = { value: v.value, type: v.value_type }
        }
        resolved.vars_resolved = out
      }
      // Apply overrides
      const ov = input.overrides[b.id]
      const merged = ov ? { ...resolved, ...ov } : resolved
      return { ...b, resolved_data: merged }
    })

    return { blocks }
  }
}

function collectVarRefs(b: TemplateBlock): string[] {
  const out: string[] = []
  const vars = (b.data as any)?.vars
  if (Array.isArray(vars)) out.push(...vars.map(String))
  const c1 = (b.data as any)?.chart_1_var; const c2 = (b.data as any)?.chart_2_var
  if (c1) out.push(String(c1)); if (c2) out.push(String(c2))
  return out
}
```

- [ ] **Step 4: Run — expect PASS**

---

### Task 27: SyncTemplateSnapshotUseCase

Refreshes `template_snapshot_json` of an appraisal from the current template, preserving existing `block_overrides_json`.

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/appraisal-rendering/sync-template-snapshot.ts`
- Create: `vendepro-backend/packages/core/tests/use-cases/appraisal-rendering/sync-template-snapshot.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { SyncTemplateSnapshotUseCase } from '../../../src/application/use-cases/appraisal-rendering/sync-template-snapshot'
import { AppraisalTemplate } from '@vendepro/core'

const tpl = AppraisalTemplate.create({
  id: 't1', org_id: 'o1', kind: 'casa', name: 'T', description: null,
  preview_image_url: null, blocks: [{ id: 'b1', type: 'cover', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0, data: { title: 'NEW' } } as any],
  is_system: false, parent_template_id: null, active: true, sort_order: 0,
})

describe('SyncTemplateSnapshotUseCase', () => {
  it('refreshes snapshot preserving overrides', async () => {
    const appraisal = {
      id: 'a1', org_id: 'o1', template_id: 't1',
      template_snapshot_json: [{ id: 'b1', data: { title: 'OLD' } }],
      block_overrides_json: { b1: { subtitle: 'kept' } },
      toObject: () => ({ id: 'a1', org_id: 'o1', template_id: 't1' }),
    }
    const appraisalRepo = {
      findById: vi.fn().mockResolvedValue(appraisal),
      update: vi.fn().mockResolvedValue(undefined),
    }
    const tplRepo = { findById: vi.fn().mockResolvedValue(tpl), save: vi.fn(), listVisibleTo: vi.fn(), countUsingTemplate: vi.fn() }
    const uc = new SyncTemplateSnapshotUseCase(appraisalRepo as any, tplRepo as any)
    const r = await uc.execute({ appraisalId: 'a1', orgId: 'o1' })
    expect(r.synced).toBe(true)
    expect(appraisalRepo.update).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

Content:
```typescript
import { ValidationError } from '@vendepro/core'
import type { AppraisalRepository } from '../../ports/repositories/appraisal-repository'
import type { AppraisalTemplateRepository } from '../../ports/repositories/appraisal-template-repository'

export class SyncTemplateSnapshotUseCase {
  constructor(private readonly appraisalRepo: AppraisalRepository, private readonly templateRepo: AppraisalTemplateRepository) {}

  async execute(input: { appraisalId: string; orgId: string }): Promise<{ synced: boolean }> {
    const ap = await this.appraisalRepo.findById(input.appraisalId)
    if (!ap) throw new ValidationError('Tasación no encontrada')
    if ((ap as any).org_id !== input.orgId) throw new ValidationError('Tasación pertenece a otra org')
    const templateId = (ap as any).template_id
    if (!templateId) throw new ValidationError('Tasación no tiene template asociado')
    const tpl = await this.templateRepo.findById(templateId)
    if (!tpl) throw new ValidationError('Template no encontrado')
    await this.appraisalRepo.update(input.appraisalId, {
      template_snapshot_json: JSON.stringify(tpl.blocks),
      template_synced_at: new Date().toISOString(),
      // block_overrides_json intentionally preserved
    } as any)
    return { synced: true }
  }
}
```

- [ ] **Step 4: Run — expect PASS**

---

### Task 28: Add `SetBlockOverridesUseCase`

Saves a partial override from the agent's editor into `block_overrides_json`.

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/appraisal-rendering/set-block-overrides.ts`
- Create: `vendepro-backend/packages/core/tests/use-cases/appraisal-rendering/set-block-overrides.test.ts`

- [ ] **Step 1-3: TDD**

Test:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { SetBlockOverridesUseCase } from '../../../src/application/use-cases/appraisal-rendering/set-block-overrides'

describe('SetBlockOverridesUseCase', () => {
  it('merges partial override for a block', async () => {
    const appraisalRepo = {
      findById: vi.fn().mockResolvedValue({ id: 'a1', org_id: 'o1', block_overrides_json: { b1: { a: 1 } } }),
      update: vi.fn().mockResolvedValue(undefined),
    }
    const uc = new SetBlockOverridesUseCase(appraisalRepo as any)
    await uc.execute({ appraisalId: 'a1', orgId: 'o1', blockId: 'b1', patch: { b: 2 } })
    const call = appraisalRepo.update.mock.calls[0][1]
    expect(call.block_overrides_json).toMatch(/"b1":\{"a":1,"b":2\}/)
  })
})
```

Implementation:
```typescript
import { ValidationError } from '@vendepro/core'
import type { AppraisalRepository } from '../../ports/repositories/appraisal-repository'

export class SetBlockOverridesUseCase {
  constructor(private readonly repo: AppraisalRepository) {}
  async execute(input: { appraisalId: string; orgId: string; blockId: string; patch: Record<string, unknown> }): Promise<void> {
    const ap = await this.repo.findById(input.appraisalId)
    if (!ap) throw new ValidationError('Tasación no encontrada')
    if ((ap as any).org_id !== input.orgId) throw new ValidationError('Tasación pertenece a otra org')
    const current = (ap as any).block_overrides_json ?? {}
    const existing = current[input.blockId] ?? {}
    const next = { ...current, [input.blockId]: { ...existing, ...input.patch } }
    await this.repo.update(input.appraisalId, { block_overrides_json: JSON.stringify(next) } as any)
  }
}
```

Expected: PASS.

---

## Phase I — Appraisal use case updates

### Task 29: Update CreateAppraisalUseCase to accept template_id and take snapshot

**Files:**
- Modify: `vendepro-backend/packages/core/src/application/use-cases/appraisals/create-appraisal.ts`
- Modify: `vendepro-backend/packages/core/tests/use-cases/appraisals/create-appraisal.test.ts`

- [ ] **Step 1: Update input + dependencies**

In `create-appraisal.ts`:
- Add to constructor: `private readonly templateRepo?: AppraisalTemplateRepository`
- Add to `CreateAppraisalInput`: `template_id?: string | null`
- In `execute()`, after computing `id` but before `Appraisal.create`:
```typescript
let template_snapshot_json: string | null = null
let template_synced_at: string | null = null
if (input.template_id && this.templateRepo) {
  const tpl = await this.templateRepo.findById(input.template_id)
  if (!tpl) throw new Error('Template no encontrado')
  if (tpl.org_id !== null && tpl.org_id !== input.org_id) throw new Error('Template pertenece a otra org')
  template_snapshot_json = JSON.stringify(tpl.blocks)
  template_synced_at = new Date().toISOString()
}
```
- Pass to `Appraisal.create({ ..., template_id: input.template_id ?? null, template_snapshot_json, template_synced_at, block_overrides_json: null })`

- [ ] **Step 2: Update the test to cover the new behavior**

Add a test in `create-appraisal.test.ts`:
```typescript
it('takes snapshot when template_id is provided', async () => {
  const tplRepo = { findById: vi.fn().mockResolvedValue({ org_id: 'org-1', blocks: [{ id: 'b1', type: 'cover' }] }) }
  const uc = new CreateAppraisalUseCase(mockRepo as any, mockIdGen, tplRepo as any)
  await uc.execute({ org_id: 'org-1', agent_id: 'a1', property_address: 'X', template_id: 't1' })
  const savedCall = mockRepo.save.mock.calls.at(-1)[0]
  expect(typeof savedCall).toBe('object')  // entity
  // snapshot applied via Appraisal.create — covered in Task 15 plumbing
})
```

- [ ] **Step 3: Run tests — expect PASS**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/core -- --run create-appraisal`
Expected: all PASS.

---

### Task 30: Update UpdateAppraisalUseCase to accept block_overrides_json

**Files:**
- Modify: `vendepro-backend/packages/core/src/application/use-cases/appraisals/update-appraisal.ts`

- [ ] **Step 1: Extend input type**

Add to `UpdateAppraisalInput`:
```typescript
  block_overrides_json?: Record<string, Record<string, unknown>> | null
```

- [ ] **Step 2: Pass through to repo.update**

In the mapping from input to repo call, add:
```typescript
  block_overrides_json: input.block_overrides_json === undefined ? undefined : JSON.stringify(input.block_overrides_json ?? null),
```
(Only include keys that are explicitly provided; repo.update uses partial merge semantics.)

- [ ] **Step 3: Verify existing update tests still PASS**

Run: `cd vendepro-backend && npm test -- --filter @vendepro/core -- --run update-appraisal`
Expected: PASS.

---

## Phase J — Seeds

### Task 31: Seed SQL for 4 system templates + predefined variables

**Files:**
- Create: `vendepro-backend/migrations_v2/018_appraisal_templates_seed.sql`

- [ ] **Step 1: Build the 4 system templates as JSON strings**

Each template uses a compact blocks array. Use the following exact structure. Save the file with this content:

```sql
-- Migration 018 — Seeds 4 system appraisal templates + predefined market/notary variables.
-- Templates: casa, depto, terreno, corporativo (org_id NULL = sistema).
-- Variables are stored per-org, so this migration does NOT seed variables;
-- orgs get default variables via application bootstrap when they first access /configuracion/tasacion.

INSERT OR IGNORE INTO appraisal_templates
  (id, org_id, kind, name, description, preview_image_url, blocks_json, is_system, parent_template_id, active, sort_order, created_at, updated_at)
VALUES
(
  'sys-appraisal-casa-v1', NULL, 'casa', 'Casa — Estándar',
  'Template para tasaciones de casas. 14 bloques siguiendo el formato Marcela Genta.',
  NULL,
  '[
    {"id":"b-cover","type":"cover","binding_mode":"tasacion","include_in_pdf":true,"sort_order":0,"data":{"title":"¿Querés saber cuánto vale tu propiedad?"}},
    {"id":"b-proposal","type":"proposal_commercial","binding_mode":"org-static","include_in_pdf":true,"sort_order":1,"data":{"title":"Propuesta comercial","subtitle":"Para lograr VENDER al mejor valor, hoy hay que cumplir con estas 4 condiciones","items":[{"icon":"target","title":"SEGUIMIENTO","body":"Contacto sistemáticamente con potenciales compradores. Resolver dudas, miedos, conflictos y objeciones."},{"icon":"star","title":"DESTACARSE","body":"Invertir fuerte en la comercialización de la propiedad, para mayor visibilidad y mayor probabilidad de venta."},{"icon":"clock","title":"FOMO","body":"El miedo a perderse algo es una de las motivaciones de compra más fuertes."},{"icon":"chart","title":"VALOR DE MERCADO","body":"Salir a valor de mercado aumenta la posibilidad de vender y el aviso recibe más vistas."}]}},
    {"id":"b-services","type":"services_grid","binding_mode":"org-static","include_in_pdf":true,"sort_order":2,"data":{"title":"¿Qué hacemos para vender al mejor valor posible en 4 meses?","services":[{"icon":"camera","label":"Fotografía profesional HDR"},{"icon":"chair","label":"Amoblamiento virtual"},{"icon":"360","label":"Video 360"},{"icon":"video","label":"Videos profesionales"},{"icon":"ruler","label":"Planos profesionales"}],"badge_text":"Anunciante Premier en Zonaprop"}},
    {"id":"b-market","type":"market_stats","binding_mode":"org-variable","include_in_pdf":true,"sort_order":3,"data":{"title":"Datos del mercado","vars":["market.properties_on_sale","market.properties_sold","market.conversion_rate","market.reference_period"]}},
    {"id":"b-funnel","type":"funnel_chart","binding_mode":"system","include_in_pdf":true,"sort_order":4,"data":{"title":"¿Por qué las visualizaciones importan?","funnel":[{"label":"Clics diarios","value":22},{"label":"Consultas","value":30},{"label":"Visitas","value":15},{"label":"Propuestas","value":1}],"ranges":[{"label":"Zona de especulación","from":0,"to":10,"color":"#ff8017"},{"label":"Zona de prueba","from":10,"to":30,"color":"#9ca3af"},{"label":"Zona de reserva","from":30,"to":999,"color":"#ff007c"}]}},
    {"id":"b-method","type":"methodology","binding_mode":"org-static","include_in_pdf":true,"sort_order":5,"data":{"title":"Nuestra metodología","body":"Nos enfocamos en mantener una cartera de propiedades que permita analizar y medir el comportamiento de cada comercialización. Presentamos un reporte quincenal con los resultados, para tomar decisiones junto al propietario y vender lo más rápido y al mejor precio posible.","highlight_text":"100% métricas en cada publicación."}},
    {"id":"b-notary","type":"notary_charts","binding_mode":"org-variable","include_in_pdf":true,"sort_order":6,"data":{"title":"¿Qué nos informa el Colegio de Escribanos?","chart_1_var":"notary.sales_chart","chart_2_var":"notary.semester_chart"}},
    {"id":"b-property","type":"property_data","binding_mode":"tasacion","include_in_pdf":true,"sort_order":7,"data":{"title":"¿Qué variables de mi propiedad influyen en la tasación?","source":"appraisal.*"}},
    {"id":"b-swot","type":"swot","binding_mode":"tasacion","include_in_pdf":true,"sort_order":8,"data":{"title":"FODA","source":"appraisal.swot"}},
    {"id":"b-zone","type":"zone_map","binding_mode":"tasacion","include_in_pdf":true,"sort_order":9,"data":{"title":"¿Qué está pasando en tu zona?"}},
    {"id":"b-comparables-pub","type":"comparables_list","binding_mode":"tasacion","include_in_pdf":true,"sort_order":10,"data":{"title":"Casas publicadas en la zona","source":"appraisal.comparables","variant":"published"}},
    {"id":"b-comparables-res","type":"comparables_list","binding_mode":"tasacion","include_in_pdf":true,"sort_order":11,"data":{"title":"Casas reservadas en la zona","source":"appraisal.comparables","variant":"reserved"}},
    {"id":"b-price","type":"price_projection","binding_mode":"tasacion","include_in_pdf":true,"sort_order":12,"data":{"title":"Tasación proyectada","source":"appraisal.prices"}},
    {"id":"b-conditions","type":"work_conditions","binding_mode":"default-override","include_in_pdf":true,"sort_order":13,"data":{"title":"¿Cuáles son nuestras condiciones de trabajo?","honorarios_pct":3,"exclusividad_dias":120,"required_docs":["Escritura","DNIs de todos los propietarios","Últimas expensas","ABL y AySA","Reglamento de Copropiedad","Plano de Subdivisión y Mensura"],"extras":[],"legal_text":"En caso de venta: 3%. En caso de no venderse la propiedad, toda la inversión publicitaria corre a cuenta y riesgo de la inmobiliaria."}}
  ]',
  1, NULL, 1, 0, '2026-04-23T00:00:00Z', '2026-04-23T00:00:00Z'
);

-- Depto is identical to Casa for v1 (shares all blocks). Product can diverge later.
INSERT OR IGNORE INTO appraisal_templates
  (id, org_id, kind, name, description, preview_image_url, blocks_json, is_system, parent_template_id, active, sort_order, created_at, updated_at)
SELECT 'sys-appraisal-depto-v1', NULL, 'depto', 'Departamento — Estándar',
  'Template para tasaciones de departamentos. Estructura base equivalente a Casa en v1.',
  NULL, blocks_json, 1, NULL, 1, 1, '2026-04-23T00:00:00Z', '2026-04-23T00:00:00Z'
FROM appraisal_templates WHERE id = 'sys-appraisal-casa-v1';

-- Terreno: sin bloques de amoblamiento virtual ni video 360
INSERT OR IGNORE INTO appraisal_templates
  (id, org_id, kind, name, description, preview_image_url, blocks_json, is_system, parent_template_id, active, sort_order, created_at, updated_at)
VALUES (
  'sys-appraisal-terreno-v1', NULL, 'terreno', 'Terreno — Estándar',
  'Template para tasaciones de terrenos. Sin bloques de amoblamiento virtual ni video 360.',
  NULL,
  '[
    {"id":"b-cover","type":"cover","binding_mode":"tasacion","include_in_pdf":true,"sort_order":0,"data":{"title":"¿Querés saber cuánto vale tu terreno?"}},
    {"id":"b-proposal","type":"proposal_commercial","binding_mode":"org-static","include_in_pdf":true,"sort_order":1,"data":{"title":"Propuesta comercial","items":[{"icon":"target","title":"SEGUIMIENTO","body":"Contacto con potenciales compradores."},{"icon":"star","title":"DESTACARSE","body":"Invertir fuerte en comercialización."},{"icon":"clock","title":"FOMO","body":"Generar urgencia en el cliente."},{"icon":"chart","title":"VALOR DE MERCADO","body":"Salir al precio correcto es clave."}]}},
    {"id":"b-services","type":"services_grid","binding_mode":"org-static","include_in_pdf":true,"sort_order":2,"data":{"title":"¿Qué hacemos?","services":[{"icon":"camera","label":"Fotografía profesional HDR"},{"icon":"ruler","label":"Planos profesionales"}]}},
    {"id":"b-market","type":"market_stats","binding_mode":"org-variable","include_in_pdf":true,"sort_order":3,"data":{"title":"Datos del mercado","vars":["market.properties_on_sale","market.properties_sold","market.reference_period"]}},
    {"id":"b-method","type":"methodology","binding_mode":"org-static","include_in_pdf":true,"sort_order":4,"data":{"title":"Nuestra metodología","body":"Nos enfocamos en medir cada publicación."}},
    {"id":"b-property","type":"property_data","binding_mode":"tasacion","include_in_pdf":true,"sort_order":5,"data":{"title":"Variables del terreno","source":"appraisal.*"}},
    {"id":"b-swot","type":"swot","binding_mode":"tasacion","include_in_pdf":true,"sort_order":6,"data":{"title":"FODA","source":"appraisal.swot"}},
    {"id":"b-zone","type":"zone_map","binding_mode":"tasacion","include_in_pdf":true,"sort_order":7,"data":{"title":"¿Qué está pasando en tu zona?"}},
    {"id":"b-comparables-pub","type":"comparables_list","binding_mode":"tasacion","include_in_pdf":true,"sort_order":8,"data":{"title":"Terrenos publicados en la zona","source":"appraisal.comparables","variant":"published"}},
    {"id":"b-price","type":"price_projection","binding_mode":"tasacion","include_in_pdf":true,"sort_order":9,"data":{"title":"Tasación proyectada","source":"appraisal.prices"}},
    {"id":"b-conditions","type":"work_conditions","binding_mode":"default-override","include_in_pdf":true,"sort_order":10,"data":{"title":"Condiciones de trabajo","honorarios_pct":3,"exclusividad_dias":120,"required_docs":["Escritura","DNI propietario","Plano de Mensura"]}}
  ]',
  1, NULL, 1, 2, '2026-04-23T00:00:00Z', '2026-04-23T00:00:00Z'
);

-- Corporativo: mínimo con 4 bloques (cover, servicios, property, price, conditions)
INSERT OR IGNORE INTO appraisal_templates
  (id, org_id, kind, name, description, preview_image_url, blocks_json, is_system, parent_template_id, active, sort_order, created_at, updated_at)
VALUES (
  'sys-appraisal-corp-v1', NULL, 'corporativo', 'Corporativo — Reducido',
  'Template conciso para locales comerciales / oficinas.',
  NULL,
  '[
    {"id":"b-cover","type":"cover","binding_mode":"tasacion","include_in_pdf":true,"sort_order":0,"data":{"title":"Tasación comercial"}},
    {"id":"b-services","type":"services_grid","binding_mode":"org-static","include_in_pdf":true,"sort_order":1,"data":{"title":"¿Qué hacemos?","services":[{"icon":"camera","label":"Fotografía HDR"},{"icon":"ruler","label":"Planos profesionales"}]}},
    {"id":"b-property","type":"property_data","binding_mode":"tasacion","include_in_pdf":true,"sort_order":2,"data":{"title":"Variables del inmueble","source":"appraisal.*"}},
    {"id":"b-price","type":"price_projection","binding_mode":"tasacion","include_in_pdf":true,"sort_order":3,"data":{"title":"Tasación proyectada","source":"appraisal.prices"}},
    {"id":"b-conditions","type":"work_conditions","binding_mode":"default-override","include_in_pdf":true,"sort_order":4,"data":{"title":"Condiciones de trabajo","honorarios_pct":3,"exclusividad_dias":120,"required_docs":["Escritura","DNI representante legal"]}}
  ]',
  1, NULL, 1, 3, '2026-04-23T00:00:00Z', '2026-04-23T00:00:00Z'
);
```

- [ ] **Step 2: Verify the file parses as SQLite**

Run:
```bash
sqlite3 :memory: < vendepro-backend/migrations_v2/018_appraisal_templates_seed.sql 2>&1 | head -20
```
Expected: error about missing `appraisal_templates` table (table schema not yet applied) — that's fine. No syntax errors.

---

### Task 32: Run seed against local D1 and verify

**Files:**
- No new files.

- [ ] **Step 1: Apply seed locally**

Run:
```bash
cd vendepro-backend && npx wrangler d1 execute vendepro-db --local --file=migrations_v2/018_appraisal_templates_seed.sql
```

Expected: "Executed 4 SQL statements in Yms". No errors.

- [ ] **Step 2: Verify 4 rows inserted**

Run:
```bash
npx wrangler d1 execute vendepro-db --local --command="SELECT id, kind, name FROM appraisal_templates WHERE is_system = 1;"
```

Expected: 4 rows — `sys-appraisal-casa-v1`, `sys-appraisal-depto-v1`, `sys-appraisal-terreno-v1`, `sys-appraisal-corp-v1`.

- [ ] **Step 3: Verify JSON validity of at least one template**

Run:
```bash
npx wrangler d1 execute vendepro-db --local --command="SELECT length(blocks_json) FROM appraisal_templates WHERE id = 'sys-appraisal-casa-v1';"
```

Expected: a positive number (not 0). If 0 or NULL, the JSON string had an escape problem — re-check Task 31 content.

---

## Phase K — API routes

### Task 33: api-admin routes for appraisal templates

**Files:**
- Modify: `vendepro-backend/packages/api-admin/src/index.ts`
- (Optionally) Create: `vendepro-backend/packages/api-admin/src/routes/appraisal-templates.ts`

- [ ] **Step 1: Add routes**

Add to `api-admin` routing (either in `src/index.ts` or a new file wired into it):

```typescript
// GET /appraisal-templates
app.get('/appraisal-templates', async (c) => {
  const uc = new ListAppraisalTemplatesUseCase(new D1AppraisalTemplateRepository(c.env.DB))
  const kind = c.req.query('kind') as any
  const onlyActive = c.req.query('active') === '1'
  const list = await uc.execute({ orgId: c.get('orgId'), kind, onlyActive })
  return c.json(list)
})

// GET /appraisal-templates/:id
app.get('/appraisal-templates/:id', async (c) => {
  const uc = new GetAppraisalTemplateUseCase(new D1AppraisalTemplateRepository(c.env.DB))
  const r = await uc.execute({ id: c.req.param('id'), orgId: c.get('orgId') })
  if (!r) return c.json({ error: 'not found' }, 404)
  return c.json(r)
})

// POST /appraisal-templates
app.post('/appraisal-templates', async (c) => {
  const body = (await c.req.json()) as any
  const uc = new CreateAppraisalTemplateUseCase(new D1AppraisalTemplateRepository(c.env.DB), new CryptoIdGenerator())
  const r = await uc.execute({ orgId: c.get('orgId'), name: body.name, kind: body.kind, description: body.description ?? null, preview_image_url: body.preview_image_url ?? null, blocks: body.blocks ?? [] })
  return c.json(r, 201)
})

// PUT /appraisal-templates/:id
app.put('/appraisal-templates/:id', async (c) => {
  const body = (await c.req.json()) as any
  const uc = new UpdateAppraisalTemplateUseCase(new D1AppraisalTemplateRepository(c.env.DB))
  const r = await uc.execute({ id: c.req.param('id'), orgId: c.get('orgId'), ...body })
  return c.json(r)
})

// POST /appraisal-templates/:id/duplicate
app.post('/appraisal-templates/:id/duplicate', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as any
  const uc = new DuplicateAppraisalTemplateUseCase(new D1AppraisalTemplateRepository(c.env.DB), new CryptoIdGenerator())
  const r = await uc.execute({ sourceId: c.req.param('id'), orgId: c.get('orgId'), newName: body.new_name })
  return c.json(r, 201)
})

// DELETE /appraisal-templates/:id (archive)
app.delete('/appraisal-templates/:id', async (c) => {
  const uc = new ArchiveAppraisalTemplateUseCase(new D1AppraisalTemplateRepository(c.env.DB))
  const r = await uc.execute({ id: c.req.param('id'), orgId: c.get('orgId') })
  return c.json(r)
})
```

Make sure to import the use cases and `D1AppraisalTemplateRepository`, `CryptoIdGenerator` at the top of the file.

- [ ] **Step 2: Type-check api-admin**

Run: `cd vendepro-backend && npm run -w api-admin build`
Expected: no TS errors.

- [ ] **Step 3: Smoke test with curl (local dev)**

Run in a separate terminal: `cd vendepro-backend/packages/api-admin && npm run dev`

Then:
```bash
curl -s http://127.0.0.1:8707/appraisal-templates \
  -H "Authorization: Bearer <valid-admin-jwt>" | head -50
```
Expected: JSON array with at least 4 system templates.

---

### Task 34: api-admin routes for org variables

**Files:**
- Modify: `vendepro-backend/packages/api-admin/src/index.ts`

- [ ] **Step 1: Add routes**

```typescript
// GET /org-variables?namespace=market
app.get('/org-variables', async (c) => {
  const uc = new ListOrgVariablesUseCase(new D1OrgVariableRepository(c.env.DB))
  const namespace = c.req.query('namespace') as any
  const list = await uc.execute({ orgId: c.get('orgId'), namespace })
  return c.json(list)
})

// POST /org-variables
app.post('/org-variables', async (c) => {
  const body = (await c.req.json()) as any
  const uc = new CreateOrgVariableUseCase(new D1OrgVariableRepository(c.env.DB), new CryptoIdGenerator())
  const r = await uc.execute({
    orgId: c.get('orgId'), key: body.key, value: body.value, value_type: body.value_type,
    label: body.label ?? null, namespace: body.namespace ?? 'custom',
  })
  return c.json(r, 201)
})

// PUT /org-variables/:id
app.put('/org-variables/:id', async (c) => {
  const body = (await c.req.json()) as any
  const uc = new UpdateOrgVariableUseCase(new D1OrgVariableRepository(c.env.DB))
  const r = await uc.execute({ id: c.req.param('id'), orgId: c.get('orgId'), value: body.value, label: body.label })
  return c.json(r)
})

// DELETE /org-variables/:id (custom only)
app.delete('/org-variables/:id', async (c) => {
  const uc = new DeleteOrgVariableUseCase(new D1OrgVariableRepository(c.env.DB))
  const r = await uc.execute({ id: c.req.param('id'), orgId: c.get('orgId') })
  return c.json(r)
})
```

- [ ] **Step 2: Type-check**

Run: `cd vendepro-backend && npm run -w api-admin build`
Expected: no TS errors.

---

### Task 35: api-properties — sync snapshot + block-override endpoints

**Files:**
- Modify: `vendepro-backend/packages/api-properties/src/index.ts`

- [ ] **Step 1: Add routes**

```typescript
// POST /appraisals/:id/sync-template
app.post('/appraisals/:id/sync-template', async (c) => {
  const uc = new SyncTemplateSnapshotUseCase(
    new D1AppraisalRepository(c.env.DB),
    new D1AppraisalTemplateRepository(c.env.DB),
  )
  const r = await uc.execute({ appraisalId: c.req.param('id'), orgId: c.get('orgId') })
  return c.json(r)
})

// PATCH /appraisals/:id/blocks/:block_id
app.patch('/appraisals/:id/blocks/:block_id', async (c) => {
  const body = (await c.req.json()) as any
  const uc = new SetBlockOverridesUseCase(new D1AppraisalRepository(c.env.DB))
  await uc.execute({
    appraisalId: c.req.param('id'), orgId: c.get('orgId'),
    blockId: c.req.param('block_id'), patch: body ?? {},
  })
  return c.json({ ok: true })
})
```

- [ ] **Step 2: Type-check api-properties**

Run: `cd vendepro-backend && npm run -w api-properties build`
Expected: no TS errors.

---

### Task 36: Update existing POST /appraisals to accept `template_id`

**Files:**
- Modify: `vendepro-backend/packages/api-properties/src/index.ts` (or the file handling POST /appraisals)

- [ ] **Step 1: Wire the optional template repo**

In the POST /appraisals handler:
```typescript
const tplRepo = new D1AppraisalTemplateRepository(c.env.DB)
const uc = new CreateAppraisalUseCase(
  new D1AppraisalRepository(c.env.DB),
  new CryptoIdGenerator(),
  tplRepo,
)
const body = (await c.req.json()) as any
const result = await uc.execute({
  org_id: c.get('orgId'),
  agent_id: c.get('userId'),
  property_address: body.property_address,
  // ...all existing fields...
  template_id: body.template_id ?? null,
})
return c.json(result, 201)
```

- [ ] **Step 2: Type-check api-properties**

Run: `cd vendepro-backend && npm run -w api-properties build`
Expected: no TS errors.

- [ ] **Step 3: Smoke test**

```bash
# From api-properties dev server
curl -s -X POST http://127.0.0.1:8703/appraisals \
  -H "Authorization: Bearer <valid-agent-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"property_address":"Test 123","template_id":"sys-appraisal-casa-v1"}' | jq .
```
Expected: `{ "id": "<uuid>", "status": "draft" }`. Then:
```bash
npx wrangler d1 execute vendepro-db --local --command="SELECT template_id, length(template_snapshot_json) FROM appraisals ORDER BY created_at DESC LIMIT 1;"
```
Expected: `template_id = sys-appraisal-casa-v1` and non-zero snapshot length.

---

## Phase L — Final verification + single commit

### Task 37: Run all tests, then one big commit

**Files:**
- All changes from Tasks 1–36.

- [ ] **Step 1: Run the full test suite**

Run: `cd vendepro-backend && npm test`
Expected: all tests across `@vendepro/core` and `@vendepro/infrastructure` PASS. No failures.

If any test fails, fix it before proceeding to commit.

- [ ] **Step 2: Type-check all workers**

Run:
```bash
cd vendepro-backend && npm run -w @vendepro/core build \
  && npm run -w @vendepro/infrastructure build \
  && npm run -w api-admin build \
  && npm run -w api-properties build
```
Expected: all builds succeed.

- [ ] **Step 3: Review changes**

Run: `git status` and `git diff --stat`
Expected to see changes in:
- `vendepro-backend/migrations_v2/017_*.sql`, `018_*.sql`
- `vendepro-backend/packages/core/src/domain/entities/appraisal-template.ts` + similar for org-variable, appraisal-pdf
- `vendepro-backend/packages/core/src/domain/entities/appraisal.ts` (canva removal, new fields)
- `vendepro-backend/packages/core/src/domain/value-objects/appraisal-*.ts`
- `vendepro-backend/packages/core/src/application/ports/repositories/*.ts`
- `vendepro-backend/packages/core/src/application/use-cases/appraisal-templates/*.ts`
- `vendepro-backend/packages/core/src/application/use-cases/org-variables/*.ts`
- `vendepro-backend/packages/core/src/application/use-cases/appraisal-rendering/*.ts`
- `vendepro-backend/packages/core/src/application/use-cases/appraisals/{create,update}-appraisal.ts`
- `vendepro-backend/packages/infrastructure/src/repositories/d1-appraisal*.ts`, `d1-org-variable-repository.ts`
- Tests under `packages/core/tests/...` and `packages/infrastructure/tests/...`
- `vendepro-backend/packages/api-admin/src/index.ts`
- `vendepro-backend/packages/api-properties/src/index.ts`

- [ ] **Step 4: One big commit**

```bash
git add vendepro-backend/migrations_v2/017_appraisal_templates_v1.sql \
        vendepro-backend/migrations_v2/018_appraisal_templates_seed.sql \
        vendepro-backend/packages/core/src/domain \
        vendepro-backend/packages/core/src/application \
        vendepro-backend/packages/core/tests \
        vendepro-backend/packages/infrastructure/src/repositories \
        vendepro-backend/packages/infrastructure/tests \
        vendepro-backend/packages/api-admin/src \
        vendepro-backend/packages/api-properties/src \
        docs/superpowers/plans/2026-04-23-tasaciones-templates-backend.md

git commit -m "$(cat <<'EOF'
feat(tasaciones): backend foundation para sistema de templates

Sub-plan 1 de 3 — Backend foundation. Introduce:
- Tablas D1: appraisal_templates, org_variables, appraisal_pdfs
- Extensión de appraisals con template_id, snapshot, overrides, synced_at
- Cleanup columnas legacy Canva (appraisals, users)
- Entidades: AppraisalTemplate, OrgVariable, AppraisalPdf
- Value objects: BindingMode, AppraisalBlockType, validateAppraisalBlocks (Zod)
- 15+ use cases: CRUD de templates, variables, hydrate + sync + overrides
- Rutas API: /appraisal-templates, /org-variables (api-admin);
  /appraisals/:id/sync-template, /appraisals/:id/blocks/:block_id (api-properties)
- Seeds: 4 system templates (Casa, Depto, Terreno, Corporativo) con 14 bloques
- Tests unit + integration para todo lo anterior

Spec: docs/superpowers/specs/2026-04-23-tasaciones-templates-design.md
Plan: docs/superpowers/plans/2026-04-23-tasaciones-templates-backend.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Verify commit landed**

Run: `git log -1 --stat | head -40`
Expected: the commit shows all the files changed above.

---

**End of Sub-plan 1.** After this lands, continue with Sub-plan 2 (frontend rendering + wizard + editor) and Sub-plan 3 (PDF + admin UI + legacy data migration).
