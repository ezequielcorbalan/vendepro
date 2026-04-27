# Tasaciones Templates — Sub-plan 3: PDF Generation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Commit policy:** No per-task commits. One final commit at the end after all tasks pass (user preference).
>
> **Subagent model:** Dispatch subagents with Sonnet (not Haiku).

**Goal:** Implement PDF generation for tasaciones via Cloudflare Browser Rendering. Agent clicks "Descargar PDF" in editor, gets a signed link that downloads the PDF (cached by content_hash, quota 50/month/org, sync flow).

**Architecture:** New use case `GenerateAppraisalPdfUseCase` orchestrates: load appraisal → hash content → cache lookup → (miss) quota check → generate public_slug if null → Browser Rendering (`@cloudflare/puppeteer`) loads `https://app.vendepro.com.ar/t/{slug}?print=1` → put blob in R2 → persist row → return JWT-signed download URL pointing at a new intermediary endpoint in `api-public` that streams the R2 blob.

**Tech Stack:** Cloudflare Workers + D1 + R2 + Browser Rendering binding, Hono, `@cloudflare/puppeteer`, vitest, Zod (for token payload), existing SHA-256 via `crypto.subtle.digest`, Next.js 15 for the frontend button.

**Spec reference:** `docs/superpowers/specs/2026-04-24-tasaciones-templates-pdf-design.md`

**Cross-cutting rules:**
- TDD for each use case + util: failing test first, then impl.
- `(await res.json()) as any` on every apiFetch response in frontend.
- Blocks visible to PDF must NOT include web-only types (cta_whatsapp, video_gallery, extra_media, agent_contact_card) — handled by existing print CSS; no code change needed here.
- `public_slug` generation reuses the algorithm already in `/appraisals/publish` handler (slugify + numeric suffix on conflict).
- Manual CF dashboard steps (Browser Rendering activation + R2 lifecycle) are post-deploy prerequisites, documented in Phase E.

---

## Phase A — Core foundations (types, errors, ports, utilities)

### Task 1: `stableStringify` utility with TDD

**Files:**
- Create: `vendepro-backend/packages/core/src/shared/stable-stringify.ts`
- Create: `vendepro-backend/packages/core/tests/shared/stable-stringify.test.ts`

- [ ] **Step 1: Write failing tests**

Use Write to create `vendepro-backend/packages/core/tests/shared/stable-stringify.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { stableStringify } from '../../src/shared/stable-stringify'

describe('stableStringify', () => {
  it('produces identical output for different key orders', () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }))
  })

  it('handles nested objects with sorted keys', () => {
    const out = stableStringify({ b: { d: 4, c: 3 }, a: 1 })
    expect(out).toBe('{"a":1,"b":{"c":3,"d":4}}')
  })

  it('preserves array order', () => {
    expect(stableStringify([3, 1, 2])).toBe('[3,1,2]')
  })

  it('handles null and primitives', () => {
    expect(stableStringify(null)).toBe('null')
    expect(stableStringify(42)).toBe('42')
    expect(stableStringify('hello')).toBe('"hello"')
    expect(stableStringify(true)).toBe('true')
  })

  it('handles array of objects with deterministic output', () => {
    const a = stableStringify([{ x: 1, y: 2 }, { y: 3, x: 4 }])
    const b = stableStringify([{ y: 2, x: 1 }, { x: 4, y: 3 }])
    expect(a).toBe(b)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run:
```bash
cd vendepro-backend && npm test -w @vendepro/core -- --run stable-stringify
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `stableStringify`**

Use Write to create `vendepro-backend/packages/core/src/shared/stable-stringify.ts`:

```typescript
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']'
  const keys = Object.keys(value as Record<string, unknown>).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k])).join(',') + '}'
}
```

- [ ] **Step 4: Run test — expect PASS**

Run:
```bash
cd vendepro-backend && npm test -w @vendepro/core -- --run stable-stringify
```

Expected: 5 tests PASS.

- [ ] **Step 5: Re-export from shared index**

Edit `vendepro-backend/packages/core/src/shared/index.ts`, add:
```typescript
export { stableStringify } from './stable-stringify'
```

---

### Task 2: Typed domain errors

**Files:**
- Create: `vendepro-backend/packages/core/src/domain/errors/quota-exceeded-error.ts`
- Create: `vendepro-backend/packages/core/src/domain/errors/render-timeout-error.ts`
- Create: `vendepro-backend/packages/core/src/domain/errors/render-failed-error.ts`
- Create: `vendepro-backend/packages/core/src/domain/errors/appraisal-not-found-error.ts`
- Modify: `vendepro-backend/packages/core/src/domain/errors/index.ts`

- [ ] **Step 1: Read existing errors pattern**

Run:
```bash
cat vendepro-backend/packages/core/src/domain/errors/validation-error.ts
cat vendepro-backend/packages/core/src/domain/errors/index.ts
```

Note the pattern (class extending `DomainError` or Error). Match it.

- [ ] **Step 2: Write `QuotaExceededError`**

Use Write to create `vendepro-backend/packages/core/src/domain/errors/quota-exceeded-error.ts`:

```typescript
import { DomainError } from './domain-error'

export class QuotaExceededError extends DomainError {
  constructor(
    public readonly limit: number,
    public readonly used: number,
    public readonly resetAt: string,
  ) {
    super(`Quota mensual excedida: ${used}/${limit}. Se resetea el ${resetAt}.`)
    this.name = 'QuotaExceededError'
  }
}
```

**Note:** if there is no `domain-error.ts` base class in the errors folder, use `extends Error` instead and adjust the `import`. Check with `ls vendepro-backend/packages/core/src/domain/errors/` first.

- [ ] **Step 3: Write `RenderTimeoutError` and `RenderFailedError`**

Use Write to create `vendepro-backend/packages/core/src/domain/errors/render-timeout-error.ts`:

```typescript
import { DomainError } from './domain-error'

export class RenderTimeoutError extends DomainError {
  constructor() {
    super('Browser rendering timeout (>30s)')
    this.name = 'RenderTimeoutError'
  }
}
```

Use Write to create `vendepro-backend/packages/core/src/domain/errors/render-failed-error.ts`:

```typescript
import { DomainError } from './domain-error'

export class RenderFailedError extends DomainError {
  constructor(message: string) {
    super(`Browser rendering failed: ${message}`)
    this.name = 'RenderFailedError'
  }
}
```

- [ ] **Step 4: Write `AppraisalNotFoundError`**

Check if there is a generic `NotFoundError` already. If yes, reuse it in handlers instead. If not:

Use Write to create `vendepro-backend/packages/core/src/domain/errors/appraisal-not-found-error.ts`:

```typescript
import { DomainError } from './domain-error'

export class AppraisalNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Tasación no encontrada: ${id}`)
    this.name = 'AppraisalNotFoundError'
  }
}
```

- [ ] **Step 5: Re-export from `errors/index.ts`**

Edit `vendepro-backend/packages/core/src/domain/errors/index.ts` — add the 4 new exports following the existing pattern.

- [ ] **Step 6: Typecheck**

Run:
```bash
cd vendepro-backend && npm run -w @vendepro/core typecheck 2>&1 | grep -E "errors" | head
```

Expected: no errors from the 4 new files.

---

### Task 3: `BrowserRenderingService` port

**Files:**
- Create: `vendepro-backend/packages/core/src/application/ports/services/browser-rendering-service.ts`
- Create: `vendepro-backend/packages/core/src/application/ports/services/index.ts` (if not present)
- Modify: `vendepro-backend/packages/core/src/application/ports/index.ts`

- [ ] **Step 1: Check if services folder exists**

Run:
```bash
ls vendepro-backend/packages/core/src/application/ports/
```

If `services/` doesn't exist, create it. If there are already service ports (`email-service.ts` etc), follow the pattern.

- [ ] **Step 2: Write the port**

Use Write to create `vendepro-backend/packages/core/src/application/ports/services/browser-rendering-service.ts`:

```typescript
export interface BrowserRenderPdfOptions {
  format?: 'A4' | 'Letter'
  margin?: string
  waitUntil?: 'networkidle0' | 'load' | 'domcontentloaded'
  timeoutMs?: number
}

export interface BrowserRenderingService {
  renderPdf(url: string, opts?: BrowserRenderPdfOptions): Promise<Uint8Array>
}
```

- [ ] **Step 3: Re-export**

If `ports/services/index.ts` exists, add the export; otherwise create it with:
```typescript
export type { BrowserRenderingService, BrowserRenderPdfOptions } from './browser-rendering-service'
```

Edit `ports/index.ts` to re-export from `./services` if not already.

---

### Task 4: `PdfStorage` port

**Files:**
- Create: `vendepro-backend/packages/core/src/application/ports/services/pdf-storage.ts`
- Modify: `vendepro-backend/packages/core/src/application/ports/services/index.ts`

- [ ] **Step 1: Write the port**

Use Write to create `vendepro-backend/packages/core/src/application/ports/services/pdf-storage.ts`:

```typescript
export interface PdfPutMeta {
  contentType: string
  contentDisposition: string
}

export interface PdfObject {
  body: ReadableStream<Uint8Array>
  size: number
  contentType: string
  contentDisposition: string
}

export interface PdfStorage {
  put(key: string, bytes: Uint8Array, meta: PdfPutMeta): Promise<void>
  get(key: string): Promise<PdfObject | null>
}
```

- [ ] **Step 2: Re-export**

Append to `ports/services/index.ts`:
```typescript
export type { PdfStorage, PdfObject, PdfPutMeta } from './pdf-storage'
```

---

### Task 5: `PdfDownloadTokenSigner` port

**Files:**
- Create: `vendepro-backend/packages/core/src/application/ports/services/pdf-download-token-signer.ts`
- Modify: `vendepro-backend/packages/core/src/application/ports/services/index.ts`

- [ ] **Step 1: Write the port**

Use Write to create `vendepro-backend/packages/core/src/application/ports/services/pdf-download-token-signer.ts`:

```typescript
export interface PdfDownloadTokenPayload {
  r2Key: string
  orgId: string
  appraisalId: string
}

export interface PdfDownloadTokenSigner {
  /** Signs a JWT and builds the full download URL. */
  buildDownloadUrl(input: { r2Key: string; orgId: string; appraisalId: string; filename: string; ttlSec: number }): string
  /** Verifies a token; returns payload on success, null on expiry/invalid. */
  verify(token: string): PdfDownloadTokenPayload | null
}
```

- [ ] **Step 2: Re-export**

Append to `ports/services/index.ts`:
```typescript
export type { PdfDownloadTokenSigner, PdfDownloadTokenPayload } from './pdf-download-token-signer'
```

---

## Phase B — `GenerateAppraisalPdfUseCase` with TDD

### Task 6: Write failing test for cache hit path

**Files:**
- Create: `vendepro-backend/packages/core/tests/use-cases/appraisals/generate-appraisal-pdf.test.ts`

- [ ] **Step 1: Write the test**

Use Write to create the file. Full content:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GenerateAppraisalPdfUseCase } from '../../../src/application/use-cases/appraisals/generate-appraisal-pdf'
import { QuotaExceededError } from '../../../src/domain/errors/quota-exceeded-error'
import { RenderTimeoutError } from '../../../src/domain/errors/render-timeout-error'

const fixedNow = new Date('2026-04-24T12:00:00Z')

function makeAppraisal(overrides: Partial<any> = {}) {
  return {
    id: 'a1',
    org_id: 'o1',
    property_address: 'Mistral 3224',
    public_slug: 'mistral-3224',
    template_id: 't1',
    template_snapshot_json: JSON.stringify([
      { id: 'b1', type: 'cover', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0, data: { title: 'X' } },
      { id: 'b2', type: 'market_stats', binding_mode: 'org-variable', include_in_pdf: true, sort_order: 1, data: { vars: ['market.properties_on_sale'] } },
    ]),
    block_overrides_json: null,
    ...overrides,
  }
}

function makeDeps() {
  return {
    appraisalRepo: { findById: vi.fn(), update: vi.fn() },
    pdfRepo: { findActiveByHash: vi.fn(), countSinceDate: vi.fn(), save: vi.fn() },
    orgVarRepo: { resolveKeys: vi.fn().mockResolvedValue({}) },
    templateRepo: {},
    browserRendering: { renderPdf: vi.fn() },
    pdfStorage: { put: vi.fn(), get: vi.fn() },
    tokenSigner: {
      buildDownloadUrl: vi.fn().mockReturnValue('https://pub/public/pdf/o1/a1/tasacion-mistral-3224.pdf?token=abc'),
      verify: vi.fn(),
    },
    idGen: { generate: vi.fn().mockReturnValue('pdf-id-1') },
    now: () => fixedNow,
  }
}

describe('GenerateAppraisalPdfUseCase', () => {
  let deps: ReturnType<typeof makeDeps>
  beforeEach(() => { deps = makeDeps() })

  it('returns cached PDF without calling the renderer', async () => {
    deps.appraisalRepo.findById.mockResolvedValue(makeAppraisal())
    deps.pdfRepo.findActiveByHash.mockResolvedValue({
      id: 'pdf-prev', org_id: 'o1', appraisal_id: 'a1',
      content_hash: 'hashZ', r2_key: 'appraisals/pdfs/o1/a1/hashZ.pdf',
      size_bytes: 12345, generated_at: '2026-04-20T10:00:00Z',
      expires_at: '2026-05-20T10:00:00Z',
    })
    deps.pdfRepo.countSinceDate.mockResolvedValue(7)

    const uc = new GenerateAppraisalPdfUseCase(deps as any)
    const result = await uc.execute({ appraisalId: 'a1', orgId: 'o1', userId: 'u1' })

    expect(result.from_cache).toBe(true)
    expect(result.pdf_url).toContain('/public/pdf/o1/a1/')
    expect(result.monthly_used).toBe(7)
    expect(deps.browserRendering.renderPdf).not.toHaveBeenCalled()
    expect(deps.pdfStorage.put).not.toHaveBeenCalled()
  })

  it('throws QuotaExceededError when over 50 on cache miss', async () => {
    deps.appraisalRepo.findById.mockResolvedValue(makeAppraisal())
    deps.pdfRepo.findActiveByHash.mockResolvedValue(null)
    deps.pdfRepo.countSinceDate.mockResolvedValue(50)

    const uc = new GenerateAppraisalPdfUseCase(deps as any)
    await expect(uc.execute({ appraisalId: 'a1', orgId: 'o1', userId: 'u1' }))
      .rejects.toBeInstanceOf(QuotaExceededError)
  })

  it('allows cache hits even when quota is at the limit', async () => {
    deps.appraisalRepo.findById.mockResolvedValue(makeAppraisal())
    deps.pdfRepo.findActiveByHash.mockResolvedValue({
      id: 'pdf-prev', org_id: 'o1', appraisal_id: 'a1',
      content_hash: 'hashZ', r2_key: 'appraisals/pdfs/o1/a1/hashZ.pdf',
      size_bytes: 12345, generated_at: '2026-04-20T10:00:00Z',
      expires_at: '2026-05-20T10:00:00Z',
    })
    deps.pdfRepo.countSinceDate.mockResolvedValue(50)

    const uc = new GenerateAppraisalPdfUseCase(deps as any)
    const result = await uc.execute({ appraisalId: 'a1', orgId: 'o1', userId: 'u1' })
    expect(result.from_cache).toBe(true)
  })

  it('renders + persists + returns URL on cache miss (happy path)', async () => {
    deps.appraisalRepo.findById.mockResolvedValue(makeAppraisal())
    deps.pdfRepo.findActiveByHash.mockResolvedValue(null)
    deps.pdfRepo.countSinceDate.mockResolvedValue(10)
    deps.browserRendering.renderPdf.mockResolvedValue(new Uint8Array([1, 2, 3]))
    deps.pdfStorage.put.mockResolvedValue(undefined)
    deps.pdfRepo.save.mockResolvedValue(undefined)

    const uc = new GenerateAppraisalPdfUseCase(deps as any)
    const result = await uc.execute({ appraisalId: 'a1', orgId: 'o1', userId: 'u1' })

    expect(deps.browserRendering.renderPdf).toHaveBeenCalledTimes(1)
    const [renderUrl] = deps.browserRendering.renderPdf.mock.calls[0]
    expect(renderUrl).toBe('https://app.vendepro.com.ar/t/mistral-3224?print=1')

    expect(deps.pdfStorage.put).toHaveBeenCalledTimes(1)
    const [r2Key, bytes, meta] = deps.pdfStorage.put.mock.calls[0]
    expect(r2Key).toMatch(/^appraisals\/pdfs\/o1\/a1\/[0-9a-f]{64}\.pdf$/)
    expect(bytes).toEqual(new Uint8Array([1, 2, 3]))
    expect(meta.contentType).toBe('application/pdf')

    expect(deps.pdfRepo.save).toHaveBeenCalledTimes(1)

    expect(result.from_cache).toBe(false)
    expect(result.monthly_used).toBe(11)
    expect(result.pdf_url).toContain('/public/pdf/o1/a1/')
  })

  it('generates public_slug when null before rendering', async () => {
    deps.appraisalRepo.findById.mockResolvedValue(makeAppraisal({ public_slug: null }))
    deps.pdfRepo.findActiveByHash.mockResolvedValue(null)
    deps.pdfRepo.countSinceDate.mockResolvedValue(5)
    deps.appraisalRepo.update.mockResolvedValue(undefined)
    deps.browserRendering.renderPdf.mockResolvedValue(new Uint8Array([1]))

    const uc = new GenerateAppraisalPdfUseCase(deps as any)
    await uc.execute({ appraisalId: 'a1', orgId: 'o1', userId: 'u1' })

    expect(deps.appraisalRepo.update).toHaveBeenCalledWith('a1', 'o1', expect.objectContaining({ public_slug: expect.any(String) }))
    const [slug] = deps.browserRendering.renderPdf.mock.calls[0][0].match(/\/t\/([^?]+)/)!.slice(1)
    expect(slug.length).toBeGreaterThan(0)
  })

  it('propagates RenderTimeoutError from the renderer', async () => {
    deps.appraisalRepo.findById.mockResolvedValue(makeAppraisal())
    deps.pdfRepo.findActiveByHash.mockResolvedValue(null)
    deps.pdfRepo.countSinceDate.mockResolvedValue(5)
    deps.browserRendering.renderPdf.mockRejectedValue(new RenderTimeoutError())

    const uc = new GenerateAppraisalPdfUseCase(deps as any)
    await expect(uc.execute({ appraisalId: 'a1', orgId: 'o1', userId: 'u1' }))
      .rejects.toBeInstanceOf(RenderTimeoutError)
    expect(deps.pdfStorage.put).not.toHaveBeenCalled()
    expect(deps.pdfRepo.save).not.toHaveBeenCalled()
  })

  it('produces same content_hash for identical input', async () => {
    const uc = new GenerateAppraisalPdfUseCase(deps as any)
    deps.appraisalRepo.findById.mockResolvedValue(makeAppraisal())
    deps.pdfRepo.findActiveByHash.mockResolvedValue(null)
    deps.pdfRepo.countSinceDate.mockResolvedValue(1)
    deps.browserRendering.renderPdf.mockResolvedValue(new Uint8Array([9]))

    await uc.execute({ appraisalId: 'a1', orgId: 'o1', userId: 'u1' })
    const firstKey = deps.pdfStorage.put.mock.calls[0][0]

    // Reset storage mocks but return same content hash flow
    deps.pdfStorage.put.mockClear()
    deps.pdfRepo.save.mockClear()
    deps.browserRendering.renderPdf.mockResolvedValue(new Uint8Array([9]))

    await uc.execute({ appraisalId: 'a1', orgId: 'o1', userId: 'u1' })
    const secondKey = deps.pdfStorage.put.mock.calls[0][0]

    expect(firstKey).toBe(secondKey)
  })

  it('produces different content_hash when overrides change', async () => {
    const uc = new GenerateAppraisalPdfUseCase(deps as any)
    deps.pdfRepo.findActiveByHash.mockResolvedValue(null)
    deps.pdfRepo.countSinceDate.mockResolvedValue(1)
    deps.browserRendering.renderPdf.mockResolvedValue(new Uint8Array([9]))

    deps.appraisalRepo.findById.mockResolvedValueOnce(makeAppraisal({ block_overrides_json: null }))
    await uc.execute({ appraisalId: 'a1', orgId: 'o1', userId: 'u1' })
    const firstKey = deps.pdfStorage.put.mock.calls[0][0]

    deps.pdfStorage.put.mockClear()
    deps.appraisalRepo.findById.mockResolvedValueOnce(makeAppraisal({ block_overrides_json: JSON.stringify({ b1: { title: 'CHANGED' } }) }))
    await uc.execute({ appraisalId: 'a1', orgId: 'o1', userId: 'u1' })
    const secondKey = deps.pdfStorage.put.mock.calls[0][0]

    expect(firstKey).not.toBe(secondKey)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run:
```bash
cd vendepro-backend && npm test -w @vendepro/core -- --run generate-appraisal-pdf
```

Expected: FAIL — use case module not found.

---

### Task 7: Implement `GenerateAppraisalPdfUseCase`

**Files:**
- Create: `vendepro-backend/packages/core/src/application/use-cases/appraisals/generate-appraisal-pdf.ts`
- Modify: `vendepro-backend/packages/core/src/application/index.ts`

- [ ] **Step 1: Read existing `AppraisalPdfRepository` port**

Run:
```bash
cat vendepro-backend/packages/core/src/application/ports/repositories/appraisal-pdf-repository.ts
```

Confirm method signatures. This task assumes:
- `findActiveByHash(hash: string, now: Date): Promise<AppraisalPdfProps | null>`
- `countSinceDate(orgId: string, sinceIso: string): Promise<number>`
- `save(entity: AppraisalPdf): Promise<void>`

If signatures differ, **adapt the code below** to match the existing port (do not change the port in this phase — that would extend scope). Report adaptation in the task summary.

- [ ] **Step 2: Write the use case**

Use Write to create `vendepro-backend/packages/core/src/application/use-cases/appraisals/generate-appraisal-pdf.ts`:

```typescript
import type { AppraisalRepository } from '../../ports/repositories/appraisal-repository'
import type { AppraisalPdfRepository } from '../../ports/repositories/appraisal-pdf-repository'
import type { OrgVariableRepository } from '../../ports/repositories/org-variable-repository'
import type { AppraisalTemplateRepository } from '../../ports/repositories/appraisal-template-repository'
import type { BrowserRenderingService } from '../../ports/services/browser-rendering-service'
import type { PdfStorage } from '../../ports/services/pdf-storage'
import type { PdfDownloadTokenSigner } from '../../ports/services/pdf-download-token-signer'
import type { IdGenerator } from '../../ports/id-generator'
import { AppraisalPdf } from '../../../domain/entities/appraisal-pdf'
import { AppraisalNotFoundError } from '../../../domain/errors/appraisal-not-found-error'
import { QuotaExceededError } from '../../../domain/errors/quota-exceeded-error'
import { stableStringify } from '../../../shared/stable-stringify'

const FRONTEND_BASE_URL = 'https://app.vendepro.com.ar'
const MONTHLY_QUOTA = 50
const R2_KEY_PREFIX = 'appraisals/pdfs'
const DOWNLOAD_TTL_SEC = 900
const R2_TTL_DAYS = 30

export interface GenerateAppraisalPdfDeps {
  appraisalRepo: AppraisalRepository
  pdfRepo: AppraisalPdfRepository
  orgVarRepo: OrgVariableRepository
  templateRepo: AppraisalTemplateRepository
  browserRendering: BrowserRenderingService
  pdfStorage: PdfStorage
  tokenSigner: PdfDownloadTokenSigner
  idGen: IdGenerator
  now: () => Date
}

export interface GenerateAppraisalPdfInput {
  appraisalId: string
  orgId: string
  userId: string
}

export interface GenerateAppraisalPdfResult {
  pdf_url: string
  expires_at: string
  from_cache: boolean
  monthly_used: number
}

export class GenerateAppraisalPdfUseCase {
  constructor(private readonly deps: GenerateAppraisalPdfDeps) {}

  async execute(input: GenerateAppraisalPdfInput): Promise<GenerateAppraisalPdfResult> {
    const { appraisalRepo, pdfRepo, orgVarRepo, browserRendering, pdfStorage, tokenSigner, idGen, now } = this.deps

    const appraisal = await appraisalRepo.findById(input.appraisalId, input.orgId)
    if (!appraisal) throw new AppraisalNotFoundError(input.appraisalId)

    const appraisalObj = typeof (appraisal as any).toObject === 'function' ? (appraisal as any).toObject() : appraisal
    const snapshot = parseJson((appraisalObj as any).template_snapshot_json) ?? []
    const overrides = parseJson((appraisalObj as any).block_overrides_json) ?? {}

    const varKeys = extractVarKeys(snapshot as any[])
    const resolvedVars = varKeys.length > 0
      ? await orgVarRepo.resolveKeys(input.orgId, varKeys)
      : {}

    const nowDate = now()

    const contentHash = await computeContentHash({
      snapshot,
      overrides,
      resolvedVars,
      publicSlug: (appraisalObj as any).public_slug ?? null,
    })

    const cached = await pdfRepo.findActiveByHash(contentHash, nowDate)
    const firstOfMonth = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), 1)).toISOString()
    const usedPrior = await pdfRepo.countSinceDate(input.orgId, firstOfMonth)

    if (cached) {
      const pdf_url = buildDownloadUrl(tokenSigner, cached.r2_key, input.orgId, input.appraisalId, (appraisalObj as any).public_slug)
      return {
        pdf_url,
        expires_at: new Date(nowDate.getTime() + DOWNLOAD_TTL_SEC * 1000).toISOString(),
        from_cache: true,
        monthly_used: usedPrior,
      }
    }

    if (usedPrior >= MONTHLY_QUOTA) {
      const resetAt = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() + 1, 1)).toISOString()
      throw new QuotaExceededError(MONTHLY_QUOTA, usedPrior, resetAt)
    }

    // Generate public_slug if missing
    let publicSlug: string | null = (appraisalObj as any).public_slug ?? null
    if (!publicSlug) {
      publicSlug = slugifyAddress((appraisalObj as any).property_address || 'tasacion')
      await appraisalRepo.update(input.appraisalId, input.orgId, { public_slug: publicSlug })
    }

    const url = `${FRONTEND_BASE_URL}/t/${publicSlug}?print=1`
    const bytes = await browserRendering.renderPdf(url, {
      format: 'A4',
      margin: '12mm',
      waitUntil: 'networkidle0',
      timeoutMs: 30000,
    })

    const r2Key = `${R2_KEY_PREFIX}/${input.orgId}/${input.appraisalId}/${contentHash}.pdf`
    await pdfStorage.put(r2Key, bytes, {
      contentType: 'application/pdf',
      contentDisposition: `attachment; filename="tasacion-${publicSlug}.pdf"`,
    })

    const expiresAt = new Date(nowDate.getTime() + R2_TTL_DAYS * 24 * 3600 * 1000).toISOString()
    const entity = AppraisalPdf.create({
      id: idGen.generate(),
      org_id: input.orgId,
      appraisal_id: input.appraisalId,
      content_hash: contentHash,
      r2_key: r2Key,
      size_bytes: bytes.length,
      generated_at: nowDate.toISOString(),
      expires_at: expiresAt,
    })
    await pdfRepo.save(entity)

    const pdf_url = buildDownloadUrl(tokenSigner, r2Key, input.orgId, input.appraisalId, publicSlug)
    return {
      pdf_url,
      expires_at: new Date(nowDate.getTime() + DOWNLOAD_TTL_SEC * 1000).toISOString(),
      from_cache: false,
      monthly_used: usedPrior + 1,
    }
  }
}

function parseJson(v: unknown): unknown {
  if (v === null || v === undefined) return null
  if (typeof v === 'object') return v
  if (typeof v === 'string') { try { return JSON.parse(v) } catch { return null } }
  return null
}

function extractVarKeys(snapshot: any[]): string[] {
  const set = new Set<string>()
  for (const block of snapshot) {
    const d = block?.data ?? {}
    if (Array.isArray(d.vars)) for (const k of d.vars) set.add(String(k))
    if (d.chart_1_var) set.add(String(d.chart_1_var))
    if (d.chart_2_var) set.add(String(d.chart_2_var))
  }
  return Array.from(set)
}

async function computeContentHash(input: {
  snapshot: unknown
  overrides: unknown
  resolvedVars: Record<string, { value: string; type: string }>
  publicSlug: string | null
}): Promise<string> {
  const json = stableStringify(input)
  const bytes = new TextEncoder().encode(json)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function slugifyAddress(raw: string): string {
  const base = raw.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'tasacion'
  const suffix = Math.floor(Math.random() * 9000 + 1000).toString()
  return `${base}-${suffix}`
}

function buildDownloadUrl(
  signer: PdfDownloadTokenSigner,
  r2Key: string,
  orgId: string,
  appraisalId: string,
  slug: string | null,
): string {
  const filename = `tasacion-${slug ?? appraisalId}.pdf`
  return signer.buildDownloadUrl({ r2Key, orgId, appraisalId, filename, ttlSec: DOWNLOAD_TTL_SEC })
}
```

- [ ] **Step 3: Export from application/index.ts**

Edit `vendepro-backend/packages/core/src/application/index.ts`, add:
```typescript
export { GenerateAppraisalPdfUseCase } from './use-cases/appraisals/generate-appraisal-pdf'
export type {
  GenerateAppraisalPdfDeps,
  GenerateAppraisalPdfInput,
  GenerateAppraisalPdfResult,
} from './use-cases/appraisals/generate-appraisal-pdf'
```

- [ ] **Step 4: Run test — expect PASS**

Run:
```bash
cd vendepro-backend && npm test -w @vendepro/core -- --run generate-appraisal-pdf
```

Expected: 8 tests PASS. If test for `countSinceDate` fails because repo port signature differs, adapt the test mock (not the impl).

- [ ] **Step 5: Typecheck**

Run:
```bash
cd vendepro-backend && npm run -w @vendepro/core typecheck 2>&1 | grep -E "generate-appraisal-pdf" | head
```

Expected: no errors.

---

## Phase C — Infrastructure services

### Task 8: `CfBrowserRenderingService` implementation

**Files:**
- Create: `vendepro-backend/packages/infrastructure/src/services/cf-browser-rendering-service.ts`
- Create: `vendepro-backend/packages/infrastructure/tests/services/cf-browser-rendering-service.test.ts`
- Modify: `vendepro-backend/packages/api-properties/package.json` (dependency)

- [ ] **Step 1: Check `@cloudflare/puppeteer` in backend root**

Run:
```bash
grep -r '"@cloudflare/puppeteer"' vendepro-backend/ --include=package.json
```

If already in `api-properties/package.json`, skip install. If not, install it from `vendepro-backend/packages/api-properties/`:
```bash
cd vendepro-backend/packages/api-properties && npm install @cloudflare/puppeteer
```

Add the same dep in `infrastructure/package.json` so tests can compile (install from `packages/infrastructure`).

- [ ] **Step 2: Write the service**

Use Write to create `vendepro-backend/packages/infrastructure/src/services/cf-browser-rendering-service.ts`:

```typescript
import puppeteer from '@cloudflare/puppeteer'
import type { BrowserRenderingService, BrowserRenderPdfOptions } from '@vendepro/core'
import { RenderTimeoutError, RenderFailedError } from '@vendepro/core'

export class CfBrowserRenderingService implements BrowserRenderingService {
  constructor(private readonly binding: Fetcher) {}

  async renderPdf(url: string, opts: BrowserRenderPdfOptions = {}): Promise<Uint8Array> {
    const browser = await puppeteer.launch(this.binding as any)
    try {
      const page = await browser.newPage()
      try {
        await page.goto(url, {
          waitUntil: opts.waitUntil ?? 'networkidle0',
          timeout: opts.timeoutMs ?? 30000,
        })
      } catch (e: any) {
        if (/timeout/i.test(String(e?.message ?? ''))) throw new RenderTimeoutError()
        throw new RenderFailedError(String(e?.message ?? 'page.goto failed'))
      }
      try {
        const margin = opts.margin ?? '12mm'
        const buffer = await page.pdf({
          format: (opts.format ?? 'A4') as any,
          margin: { top: margin, bottom: margin, left: margin, right: margin },
          printBackground: true,
          preferCSSPageSize: true,
        })
        return new Uint8Array(buffer as ArrayBuffer)
      } catch (e: any) {
        throw new RenderFailedError(String(e?.message ?? 'page.pdf failed'))
      }
    } finally {
      try { await browser.close() } catch {}
    }
  }
}
```

- [ ] **Step 3: Re-export from infrastructure**

Edit `vendepro-backend/packages/infrastructure/src/index.ts` (or `src/services/index.ts` if present), add:
```typescript
export { CfBrowserRenderingService } from './services/cf-browser-rendering-service'
```

- [ ] **Step 4: Write smoke test**

Use Write to create `vendepro-backend/packages/infrastructure/tests/services/cf-browser-rendering-service.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { CfBrowserRenderingService } from '../../src/services/cf-browser-rendering-service'
import { RenderTimeoutError } from '@vendepro/core'

vi.mock('@cloudflare/puppeteer', () => {
  return {
    default: {
      launch: vi.fn(),
    },
  }
})

describe('CfBrowserRenderingService', () => {
  it('returns bytes on happy path', async () => {
    const puppeteer = (await import('@cloudflare/puppeteer')).default as any
    const page = { goto: vi.fn().mockResolvedValue(undefined), pdf: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])) }
    const browser = { newPage: vi.fn().mockResolvedValue(page), close: vi.fn().mockResolvedValue(undefined) }
    puppeteer.launch.mockResolvedValue(browser)

    const svc = new CfBrowserRenderingService({} as any)
    const bytes = await svc.renderPdf('https://example.test', { format: 'A4' })
    expect(bytes).toEqual(new Uint8Array([1, 2, 3]))
    expect(page.goto).toHaveBeenCalledWith('https://example.test', expect.objectContaining({ timeout: 30000 }))
  })

  it('maps timeout error to RenderTimeoutError', async () => {
    const puppeteer = (await import('@cloudflare/puppeteer')).default as any
    const page = { goto: vi.fn().mockRejectedValue(new Error('Navigation timeout exceeded')) }
    const browser = { newPage: vi.fn().mockResolvedValue(page), close: vi.fn().mockResolvedValue(undefined) }
    puppeteer.launch.mockResolvedValue(browser)

    const svc = new CfBrowserRenderingService({} as any)
    await expect(svc.renderPdf('https://example.test')).rejects.toBeInstanceOf(RenderTimeoutError)
  })
})
```

- [ ] **Step 5: Run test — expect PASS**

Run:
```bash
cd vendepro-backend && npm test -w @vendepro/infrastructure -- --run cf-browser-rendering
```

Expected: 2 tests PASS.

---

### Task 9: `R2PdfStorage` implementation

**Files:**
- Create: `vendepro-backend/packages/infrastructure/src/services/r2-pdf-storage.ts`
- Create: `vendepro-backend/packages/infrastructure/tests/services/r2-pdf-storage.test.ts`

- [ ] **Step 1: Write the impl**

Use Write to create `vendepro-backend/packages/infrastructure/src/services/r2-pdf-storage.ts`:

```typescript
import type { PdfStorage, PdfObject, PdfPutMeta } from '@vendepro/core'

export class R2PdfStorage implements PdfStorage {
  constructor(private readonly bucket: R2Bucket) {}

  async put(key: string, bytes: Uint8Array, meta: PdfPutMeta): Promise<void> {
    await this.bucket.put(key, bytes, {
      httpMetadata: {
        contentType: meta.contentType,
        contentDisposition: meta.contentDisposition,
      },
    })
  }

  async get(key: string): Promise<PdfObject | null> {
    const obj = await this.bucket.get(key)
    if (!obj) return null
    return {
      body: obj.body as ReadableStream<Uint8Array>,
      size: obj.size,
      contentType: obj.httpMetadata?.contentType ?? 'application/pdf',
      contentDisposition: obj.httpMetadata?.contentDisposition ?? `attachment; filename="${key.split('/').pop()}"`,
    }
  }
}
```

- [ ] **Step 2: Re-export**

Edit `infrastructure/src/index.ts` (or relevant barrel), add:
```typescript
export { R2PdfStorage } from './services/r2-pdf-storage'
```

- [ ] **Step 3: Write smoke test**

Use Write to create `vendepro-backend/packages/infrastructure/tests/services/r2-pdf-storage.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { R2PdfStorage } from '../../src/services/r2-pdf-storage'

describe('R2PdfStorage', () => {
  it('put forwards bytes + httpMetadata', async () => {
    const bucket = { put: vi.fn().mockResolvedValue(undefined), get: vi.fn() }
    const svc = new R2PdfStorage(bucket as any)
    await svc.put('k/1.pdf', new Uint8Array([1, 2]), { contentType: 'application/pdf', contentDisposition: 'attachment; filename="x.pdf"' })
    expect(bucket.put).toHaveBeenCalledWith('k/1.pdf', new Uint8Array([1, 2]), {
      httpMetadata: { contentType: 'application/pdf', contentDisposition: 'attachment; filename="x.pdf"' },
    })
  })

  it('get returns object when present', async () => {
    const bucket = {
      put: vi.fn(),
      get: vi.fn().mockResolvedValue({
        body: new ReadableStream(),
        size: 42,
        httpMetadata: { contentType: 'application/pdf', contentDisposition: 'attachment' },
      }),
    }
    const svc = new R2PdfStorage(bucket as any)
    const out = await svc.get('k/1.pdf')
    expect(out?.size).toBe(42)
    expect(out?.contentType).toBe('application/pdf')
  })

  it('get returns null when not found', async () => {
    const bucket = { put: vi.fn(), get: vi.fn().mockResolvedValue(null) }
    const svc = new R2PdfStorage(bucket as any)
    expect(await svc.get('k/missing.pdf')).toBeNull()
  })
})
```

- [ ] **Step 4: Run test — expect PASS**

Run:
```bash
cd vendepro-backend && npm test -w @vendepro/infrastructure -- --run r2-pdf-storage
```

Expected: 3 tests PASS.

---

### Task 10: `PdfDownloadTokenSignerImpl`

**Files:**
- Create: `vendepro-backend/packages/infrastructure/src/services/pdf-download-token-signer.ts`
- Create: `vendepro-backend/packages/infrastructure/tests/services/pdf-download-token-signer.test.ts`

- [ ] **Step 1: Check existing JWT utility**

Run:
```bash
grep -rn "jsonwebtoken\|jose\|HS256\|createSignedJwt\|verifyJwt" vendepro-backend/packages/ --include="*.ts" | head -10
```

Find the JWT util used for auth cookies/tokens. If there's `signJwt`/`verifyJwt` helpers, reuse them. If not, implement a minimal HS256 sign/verify using `crypto.subtle`.

- [ ] **Step 2: Write the signer**

Use Write to create `vendepro-backend/packages/infrastructure/src/services/pdf-download-token-signer.ts`:

```typescript
import type {
  PdfDownloadTokenSigner,
  PdfDownloadTokenPayload,
} from '@vendepro/core'

interface Opts {
  secret: string
  apiPublicBaseUrl: string  // e.g. "https://vendepro-api-public.workers.dev"
}

export class PdfDownloadTokenSignerImpl implements PdfDownloadTokenSigner {
  constructor(private readonly opts: Opts) {}

  async buildDownloadUrl(input: {
    r2Key: string
    orgId: string
    appraisalId: string
    filename: string
    ttlSec: number
  }): Promise<string> | never {
    // Note: keeping sync signature on port, but signing is async in Cloudflare.
    // We use a small trick: compute hmac synchronously by deferring via await on the caller side.
    // If the port must be sync, we use Deferred pattern. For simplicity, we change the port return
    // to Promise<string>. See Task 5 for port update if needed.
    throw new Error('Use buildDownloadUrlAsync in the call site; this is a stub.')
  }

  async buildDownloadUrlAsync(input: {
    r2Key: string
    orgId: string
    appraisalId: string
    filename: string
    ttlSec: number
  }): Promise<string> {
    const expSec = Math.floor(Date.now() / 1000) + input.ttlSec
    const token = await signHs256(this.opts.secret, {
      r2Key: input.r2Key,
      orgId: input.orgId,
      appraisalId: input.appraisalId,
      exp: expSec,
    })
    const path = `/public/pdf/${encodeURIComponent(input.orgId)}/${encodeURIComponent(input.appraisalId)}/${encodeURIComponent(input.filename)}`
    return `${this.opts.apiPublicBaseUrl}${path}?token=${encodeURIComponent(token)}`
  }

  async verify(token: string): Promise<PdfDownloadTokenPayload | null> {
    const payload = await verifyHs256(this.opts.secret, token)
    if (!payload) return null
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return null
    if (typeof payload.r2Key !== 'string' || typeof payload.orgId !== 'string' || typeof payload.appraisalId !== 'string') return null
    return { r2Key: payload.r2Key, orgId: payload.orgId, appraisalId: payload.appraisalId }
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmacSha256(secret: string, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, data)
  return new Uint8Array(sig)
}

async function signHs256(secret: string, payload: Record<string, unknown>): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)))
  const encPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)))
  const signingInput = `${encHeader}.${encPayload}`
  const sigBytes = await hmacSha256(secret, new TextEncoder().encode(signingInput))
  return `${signingInput}.${base64UrlEncode(sigBytes)}`
}

async function verifyHs256(secret: string, token: string): Promise<Record<string, any> | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [encHeader, encPayload, encSig] = parts
  const signingInput = `${encHeader}.${encPayload}`
  const expected = await hmacSha256(secret, new TextEncoder().encode(signingInput))
  const actual = base64UrlDecode(encSig)
  if (expected.length !== actual.length) return null
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i]
  if (diff !== 0) return null
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(encPayload)))
  } catch {
    return null
  }
}
```

**Decision on port signature:** the port `PdfDownloadTokenSigner` in Task 5 declares `buildDownloadUrl` as **sync** returning `string`. Because HS256 signing on Workers is async, we need to change the port to async.

- [ ] **Step 3: Update the port signature to async**

Edit `vendepro-backend/packages/core/src/application/ports/services/pdf-download-token-signer.ts`:

```typescript
export interface PdfDownloadTokenPayload {
  r2Key: string
  orgId: string
  appraisalId: string
}

export interface PdfDownloadTokenSigner {
  /** Signs a JWT and builds the full download URL. */
  buildDownloadUrl(input: { r2Key: string; orgId: string; appraisalId: string; filename: string; ttlSec: number }): Promise<string>
  /** Verifies a token; returns payload on success, null on expiry/invalid. */
  verify(token: string): Promise<PdfDownloadTokenPayload | null>
}
```

And update `generate-appraisal-pdf.ts`:
- `buildDownloadUrl` returns `Promise<string>` → the `buildDownloadUrl()` helper inside the use case must be `async` and `await`ed where called.
- The test's `buildDownloadUrl: vi.fn().mockReturnValue(...)` keeps working (vi.fn returning a value resolves when awaited).

Remove the stub/non-async methods from the impl. Rename `buildDownloadUrlAsync` to `buildDownloadUrl` and remove the erroring sync method.

Final `pdf-download-token-signer.ts` impl (replace Step 2's stub version with this cleaner one):

```typescript
import type { PdfDownloadTokenSigner, PdfDownloadTokenPayload } from '@vendepro/core'

interface Opts {
  secret: string
  apiPublicBaseUrl: string
}

export class PdfDownloadTokenSignerImpl implements PdfDownloadTokenSigner {
  constructor(private readonly opts: Opts) {}

  async buildDownloadUrl(input: { r2Key: string; orgId: string; appraisalId: string; filename: string; ttlSec: number }): Promise<string> {
    const expSec = Math.floor(Date.now() / 1000) + input.ttlSec
    const token = await signHs256(this.opts.secret, {
      r2Key: input.r2Key,
      orgId: input.orgId,
      appraisalId: input.appraisalId,
      exp: expSec,
    })
    const path = `/public/pdf/${encodeURIComponent(input.orgId)}/${encodeURIComponent(input.appraisalId)}/${encodeURIComponent(input.filename)}`
    return `${this.opts.apiPublicBaseUrl}${path}?token=${encodeURIComponent(token)}`
  }

  async verify(token: string): Promise<PdfDownloadTokenPayload | null> {
    const payload = await verifyHs256(this.opts.secret, token)
    if (!payload) return null
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return null
    if (typeof payload.r2Key !== 'string' || typeof payload.orgId !== 'string' || typeof payload.appraisalId !== 'string') return null
    return { r2Key: payload.r2Key, orgId: payload.orgId, appraisalId: payload.appraisalId }
  }
}

// Helpers (identical to Step 2): base64UrlEncode / base64UrlDecode / hmacSha256 / signHs256 / verifyHs256
// Copy them below from Step 2's code block.
```

Keep the 5 helpers `base64UrlEncode`, `base64UrlDecode`, `hmacSha256`, `signHs256`, `verifyHs256` in the same file.

- [ ] **Step 4: Update use case if needed**

Open `vendepro-backend/packages/core/src/application/use-cases/appraisals/generate-appraisal-pdf.ts`. The two `buildDownloadUrl` call sites (cache hit path + cache miss path) must be `await`ed. If they are not, add `await` and ensure the function `buildDownloadUrl` helper (at the bottom of the file) is `async` and returns `Promise<string>`.

Example change:
```typescript
// before
const pdf_url = buildDownloadUrl(tokenSigner, r2Key, input.orgId, input.appraisalId, publicSlug)
// after
const pdf_url = await buildDownloadUrl(tokenSigner, r2Key, input.orgId, input.appraisalId, publicSlug)
```

And the helper:
```typescript
async function buildDownloadUrl(signer: PdfDownloadTokenSigner, r2Key: string, orgId: string, appraisalId: string, slug: string | null): Promise<string> {
  const filename = `tasacion-${slug ?? appraisalId}.pdf`
  return await signer.buildDownloadUrl({ r2Key, orgId, appraisalId, filename, ttlSec: DOWNLOAD_TTL_SEC })
}
```

- [ ] **Step 5: Write signer test**

Use Write to create `vendepro-backend/packages/infrastructure/tests/services/pdf-download-token-signer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { PdfDownloadTokenSignerImpl } from '../../src/services/pdf-download-token-signer'

describe('PdfDownloadTokenSignerImpl', () => {
  const opts = { secret: 'test-secret-1234567890', apiPublicBaseUrl: 'https://api-pub.test' }

  it('signs and verifies a roundtrip', async () => {
    const s = new PdfDownloadTokenSignerImpl(opts)
    const url = await s.buildDownloadUrl({ r2Key: 'k/x.pdf', orgId: 'o1', appraisalId: 'a1', filename: 'tasacion-x.pdf', ttlSec: 60 })
    expect(url).toContain('api-pub.test/public/pdf/o1/a1/tasacion-x.pdf?token=')
    const token = decodeURIComponent(url.split('token=')[1])
    const payload = await s.verify(token)
    expect(payload).toEqual({ r2Key: 'k/x.pdf', orgId: 'o1', appraisalId: 'a1' })
  })

  it('rejects a tampered token', async () => {
    const s = new PdfDownloadTokenSignerImpl(opts)
    const url = await s.buildDownloadUrl({ r2Key: 'k/x.pdf', orgId: 'o1', appraisalId: 'a1', filename: 'f.pdf', ttlSec: 60 })
    const token = decodeURIComponent(url.split('token=')[1])
    const tampered = token.slice(0, -2) + 'AA'
    expect(await s.verify(tampered)).toBeNull()
  })

  it('rejects an expired token', async () => {
    const s = new PdfDownloadTokenSignerImpl(opts)
    const url = await s.buildDownloadUrl({ r2Key: 'k/x.pdf', orgId: 'o1', appraisalId: 'a1', filename: 'f.pdf', ttlSec: -10 })
    const token = decodeURIComponent(url.split('token=')[1])
    expect(await s.verify(token)).toBeNull()
  })

  it('rejects malformed tokens', async () => {
    const s = new PdfDownloadTokenSignerImpl(opts)
    expect(await s.verify('not-a-jwt')).toBeNull()
    expect(await s.verify('a.b')).toBeNull()
    expect(await s.verify('')).toBeNull()
  })
})
```

- [ ] **Step 6: Re-export**

Edit `infrastructure/src/index.ts` (or services barrel):
```typescript
export { PdfDownloadTokenSignerImpl } from './services/pdf-download-token-signer'
```

- [ ] **Step 7: Run test + typecheck**

Run:
```bash
cd vendepro-backend && npm test -w @vendepro/infrastructure -- --run pdf-download-token-signer
cd vendepro-backend && npm test -w @vendepro/core -- --run generate-appraisal-pdf
cd vendepro-backend && npm run -w @vendepro/core typecheck 2>&1 | grep -E "generate-appraisal-pdf|token-signer" | head
```

Expected: 4 + 8 tests PASS, no typecheck errors on the affected files.

---

## Phase D — API handlers

### Task 11: `POST /appraisals/:id/pdf` in api-properties

**Files:**
- Modify: `vendepro-backend/packages/api-properties/src/routes/appraisals.ts`
- Modify: `vendepro-backend/packages/api-properties/wrangler.jsonc` (add `BROWSER` + confirm `R2` binding)
- Modify: `vendepro-backend/packages/api-properties/src/index.ts` (if it wires env types)

- [ ] **Step 1: Confirm env bindings**

Run:
```bash
cat vendepro-backend/packages/api-properties/wrangler.jsonc
```

Verify presence of `R2` binding (already present from Sub-plan 2 PDF pre-work?). The `BROWSER` binding is new.

- [ ] **Step 2: Update wrangler.jsonc**

Edit `vendepro-backend/packages/api-properties/wrangler.jsonc` to add:
```jsonc
{
  // ... existing config
  "browser": {
    "binding": "BROWSER"
  },
  // confirm r2_buckets entry exists for "R2", if not, add:
  "r2_buckets": [
    { "binding": "R2", "bucket_name": "reportes-mg-assets" }
  ],
  // Ensure API_PUBLIC_URL var is present (vars section):
  "vars": {
    "API_PUBLIC_URL": "https://vendepro-api-public.workers.dev"
  }
}
```

**Important:** look at existing `vars` block; do not overwrite. Merge the new key. Confirm actual api-public production URL with the user if unsure; use `https://vendepro-api-public.workers.dev` as a placeholder — it matches the pattern of other workers in this repo.

- [ ] **Step 3: Update env type**

Find the env type for the worker. Typically in `src/index.ts` or `src/env.ts`:
```typescript
type Env = {
  DB: D1Database
  R2: R2Bucket
  BROWSER: Fetcher
  JWT_SECRET: string
  API_PUBLIC_URL: string
  // ... existing entries
}
```

Add `BROWSER: Fetcher` and `API_PUBLIC_URL: string` if missing.

- [ ] **Step 4: Add the route handler**

Open `vendepro-backend/packages/api-properties/src/routes/appraisals.ts`. Add imports at the top:

```typescript
import {
  GenerateAppraisalPdfUseCase,
  QuotaExceededError,
  RenderTimeoutError,
  RenderFailedError,
  AppraisalNotFoundError,
} from '@vendepro/core'
import {
  D1AppraisalPdfRepository,
  D1OrgVariableRepository,
  D1AppraisalTemplateRepository,
  CfBrowserRenderingService,
  R2PdfStorage,
  PdfDownloadTokenSignerImpl,
} from '@vendepro/infrastructure'
```

Inside `registerAppraisalRoutes(app)`, add the handler (after the existing `POST /appraisals/:id/sync-template` route):

```typescript
  app.post('/appraisals/:id/pdf', async (c) => {
    const useCase = new GenerateAppraisalPdfUseCase({
      appraisalRepo: new D1AppraisalRepository(c.env.DB),
      pdfRepo: new D1AppraisalPdfRepository(c.env.DB),
      orgVarRepo: new D1OrgVariableRepository(c.env.DB),
      templateRepo: new D1AppraisalTemplateRepository(c.env.DB),
      browserRendering: new CfBrowserRenderingService(c.env.BROWSER),
      pdfStorage: new R2PdfStorage(c.env.R2),
      tokenSigner: new PdfDownloadTokenSignerImpl({ secret: c.env.JWT_SECRET, apiPublicBaseUrl: c.env.API_PUBLIC_URL }),
      idGen: new CryptoIdGenerator(),
      now: () => new Date(),
    })
    try {
      const result = await useCase.execute({
        appraisalId: c.req.param('id'),
        orgId: c.get('orgId'),
        userId: c.get('userId'),
      })
      return c.json(result)
    } catch (e: any) {
      if (e instanceof QuotaExceededError) {
        return c.json({ error: 'quota_exceeded', limit: e.limit, used: e.used, reset_at: e.resetAt }, 429)
      }
      if (e instanceof RenderTimeoutError) return c.json({ error: 'render_timeout' }, 503)
      if (e instanceof RenderFailedError) return c.json({ error: 'render_failed', message: e.message }, 500)
      if (e instanceof AppraisalNotFoundError) return c.json({ error: 'not_found' }, 404)
      console.error('generate-pdf unhandled', e)
      return c.json({ error: 'internal' }, 500)
    }
  })
```

- [ ] **Step 5: Typecheck api-properties**

Run:
```bash
cd vendepro-backend && npm run -w @vendepro/api-properties typecheck 2>&1 | grep -E "appraisals\.ts|generate-pdf|pdf" | head
```

Expected: no errors.

---

### Task 12: `GET /public/pdf/:orgId/:appraisalId/:filename` in api-public

**Files:**
- Modify: `vendepro-backend/packages/api-public/src/index.ts`
- Modify: `vendepro-backend/packages/api-public/wrangler.jsonc` (confirm/add `R2`, `JWT_SECRET`)

- [ ] **Step 1: Confirm env bindings in api-public**

Run:
```bash
cat vendepro-backend/packages/api-public/wrangler.jsonc
```

Confirm `R2` bucket binding and `JWT_SECRET` secret. If missing:

```jsonc
{
  // ...
  "r2_buckets": [
    { "binding": "R2", "bucket_name": "reportes-mg-assets" }
  ]
  // JWT_SECRET is set as a secret via: wrangler secret put JWT_SECRET
  // (do not add it to wrangler.jsonc; it's per-env)
}
```

- [ ] **Step 2: Update env type in api-public**

Same pattern — add `R2: R2Bucket` and `JWT_SECRET: string` to the Env type.

- [ ] **Step 3: Add handler**

Open `vendepro-backend/packages/api-public/src/index.ts`. Find the existing routes. Add imports:

```typescript
import { R2PdfStorage, PdfDownloadTokenSignerImpl } from '@vendepro/infrastructure'
```

Add the handler (place it near other public routes):

```typescript
app.get('/public/pdf/:orgId/:appraisalId/:filename', async (c) => {
  const token = c.req.query('token')
  if (!token) return c.text('Missing token', 401)

  const signer = new PdfDownloadTokenSignerImpl({ secret: c.env.JWT_SECRET, apiPublicBaseUrl: '' })
  const payload = await signer.verify(token)
  if (!payload) return c.text('Invalid or expired token', 401)

  if (payload.orgId !== c.req.param('orgId') || payload.appraisalId !== c.req.param('appraisalId')) {
    return c.text('Token mismatch', 403)
  }

  const storage = new R2PdfStorage(c.env.R2)
  const obj = await storage.get(payload.r2Key)
  if (!obj) return c.text('PDF not found', 404)

  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.contentType,
      'Content-Disposition': obj.contentDisposition,
      'Content-Length': obj.size.toString(),
      'Cache-Control': 'private, max-age=900',
    },
  })
})
```

- [ ] **Step 4: Typecheck api-public**

Run:
```bash
cd vendepro-backend && npm run -w @vendepro/api-public typecheck 2>&1 | grep -E "public/pdf|api-public" | head
```

Expected: no errors.

---

## Phase E — Frontend

### Task 13: API wrapper `generatePdf`

**Files:**
- Modify: `vendepro-frontend/src/components/tasaciones/shared/api.ts`

- [ ] **Step 1: Add the wrapper**

Edit the file, appending after the existing wrappers:

```typescript
export async function generatePdf(appraisalId: string): Promise<{
  pdf_url: string
  expires_at: string
  from_cache: boolean
  monthly_used: number
}> {
  const r = await apiFetch('properties', `/appraisals/${appraisalId}/pdf`, { method: 'POST' })
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as any
    const e = new Error(err?.error ?? `HTTP ${r.status}`) as any
    e.code = err?.error
    e.details = err
    throw e
  }
  return (await r.json()) as any
}
```

- [ ] **Step 2: Typecheck frontend**

Run:
```bash
cd vendepro-frontend && npx tsc --noEmit 2>&1 | grep -E "shared/api" | head
```

Expected: no errors.

---

### Task 14: Botón "Descargar PDF" en EditorShell

**Files:**
- Modify: `vendepro-frontend/src/components/tasaciones/editor/EditorShell.tsx`

- [ ] **Step 1: Add state + handler + button**

Open the file. Find the header section (with Back/Ver pública/Publicar buttons). Add near the top of the component:

```typescript
import { generatePdf } from '../shared/api'
// ... existing imports

const [pdfStatus, setPdfStatus] = useState<'idle' | 'generating' | 'error'>('idle')
const [monthlyUsed, setMonthlyUsed] = useState<number | null>(null)

const handleDownloadPdf = async () => {
  if (!state.appraisal.public_slug) {
    if (!confirm('El PDF incluye un link público a /t/... ¿Continuar?')) return
  }
  setPdfStatus('generating')
  try {
    const result = await generatePdf(state.appraisal.id)
    setMonthlyUsed(result.monthly_used)
    window.location.href = result.pdf_url
    setPdfStatus('idle')
  } catch (e: any) {
    setPdfStatus('error')
    if (e.code === 'quota_exceeded') {
      alert(`Alcanzaste el límite de ${e.details.limit} PDFs este mes (se resetea el ${String(e.details.reset_at).slice(0, 10)}).`)
    } else if (e.code === 'render_timeout') {
      alert('La generación tardó más de lo esperado. Reintentá en unos segundos.')
    } else {
      alert(e.message ?? 'Error al generar PDF')
    }
  }
}
```

In the header (after the `Publicar` button, in the same flex row), add:

```tsx
<button
  onClick={handleDownloadPdf}
  disabled={pdfStatus === 'generating' || (monthlyUsed !== null && monthlyUsed >= 50)}
  className="rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
>
  {pdfStatus === 'generating' ? 'Generando...' : pdfStatus === 'error' ? 'Error, reintentar' : 'Descargar PDF'}
</button>
```

Below the header (or somewhere unobtrusive), when `monthlyUsed !== null`, show the quota:

```tsx
{monthlyUsed !== null && (
  <div className={`px-4 py-1 text-xs ${monthlyUsed >= 45 ? (monthlyUsed >= 50 ? 'text-rose-600' : 'text-amber-600') : 'text-slate-500'}`}>
    PDFs este mes: {monthlyUsed} / 50
  </div>
)}
```

- [ ] **Step 2: Ensure `useState` is imported**

The top of the file should already have `import { useState, ... } from 'react'`. Confirm `useState` is in the list.

- [ ] **Step 3: Typecheck frontend**

Run:
```bash
cd vendepro-frontend && npx tsc --noEmit 2>&1 | grep -E "EditorShell" | head
```

Expected: no errors.

- [ ] **Step 4: Unit test still green**

Run:
```bash
cd vendepro-frontend && npx vitest run 2>&1 | tail -5
```

Expected: 25/25 tests passing (this phase adds no tests; prior ones must still run).

---

## Phase F — Final verification + single commit

### Task 15: Full verification

- [ ] **Step 1: Full backend typecheck**

Run:
```bash
cd vendepro-backend && npm run -w @vendepro/core typecheck 2>&1 | tail -5
cd vendepro-backend && npm run -w @vendepro/infrastructure typecheck 2>&1 | tail -5
cd vendepro-backend && npm run -w @vendepro/api-properties typecheck 2>&1 | tail -5
cd vendepro-backend && npm run -w @vendepro/api-public typecheck 2>&1 | tail -5
```

Expected: no NEW errors caused by this sub-plan (pre-existing errors in unrelated files are OK, but any error in the files this plan touches must be fixed).

- [ ] **Step 2: Full backend test suite**

Run:
```bash
cd vendepro-backend && npm test -w @vendepro/core 2>&1 | tail -10
cd vendepro-backend && npm test -w @vendepro/infrastructure 2>&1 | tail -10
```

Expected: all new tests pass (5 stable-stringify + 8 generate-pdf + 2 browser-rendering + 3 r2-storage + 4 token-signer = 22 new tests). Plus existing 588 core tests. Plus existing infra tests (some pre-existing flaky due to miniflare timeouts — those are pre-existing and not a blocker if they were failing before).

- [ ] **Step 3: Frontend typecheck + tests + build**

Run:
```bash
cd vendepro-frontend && npx tsc --noEmit 2>&1 | tail -10
cd vendepro-frontend && npx vitest run 2>&1 | tail -5
cd vendepro-frontend && npx next build 2>&1 | tail -10
```

Expected: clean typecheck, 25 tests pass, Next build succeeds.

- [ ] **Step 4: Git status sanity**

Run:
```bash
git status -s | head -30
```

Expected changes:
- `vendepro-backend/packages/core/src/shared/stable-stringify.ts` (new) + index.ts (modified)
- `vendepro-backend/packages/core/src/domain/errors/*.ts` (4 new + index.ts modified)
- `vendepro-backend/packages/core/src/application/ports/services/*.ts` (3 new + index.ts)
- `vendepro-backend/packages/core/src/application/use-cases/appraisals/generate-appraisal-pdf.ts` (new)
- `vendepro-backend/packages/core/src/application/index.ts` (modified)
- `vendepro-backend/packages/core/tests/shared/stable-stringify.test.ts` (new)
- `vendepro-backend/packages/core/tests/use-cases/appraisals/generate-appraisal-pdf.test.ts` (new)
- `vendepro-backend/packages/infrastructure/src/services/*.ts` (3 new)
- `vendepro-backend/packages/infrastructure/src/index.ts` (modified)
- `vendepro-backend/packages/infrastructure/tests/services/*.test.ts` (3 new)
- `vendepro-backend/packages/api-properties/src/routes/appraisals.ts` (modified)
- `vendepro-backend/packages/api-properties/wrangler.jsonc` (modified)
- `vendepro-backend/packages/api-properties/src/index.ts` or env type file (modified)
- `vendepro-backend/packages/api-properties/package.json` (new dep `@cloudflare/puppeteer`)
- `vendepro-backend/package-lock.json` (modified by the npm install)
- `vendepro-backend/packages/api-public/src/index.ts` (modified)
- `vendepro-backend/packages/api-public/wrangler.jsonc` (possibly modified)
- `vendepro-frontend/src/components/tasaciones/shared/api.ts` (modified)
- `vendepro-frontend/src/components/tasaciones/editor/EditorShell.tsx` (modified)

If anything else shows up that is NOT from this plan, stage only the files listed.

---

### Task 16: Manual E2E checklist (record results)

Run these manually — they don't commit anything. Record results so the user has confidence.

- [ ] **Step 1: Spin up local dev + seeded D1**

Run:
```bash
cd vendepro-backend && ./start-local.sh
```

(Or whatever equivalent start command launches the workers locally with D1 seeds + R2 local.)

In another terminal:
```bash
cd vendepro-frontend && npm run dev
```

- [ ] **Step 2: Create a tasación and open the editor**

Via the UI: login, go to `/tasaciones/nueva`, pick template Casa, fill minimal fields, publish. Open `/tasaciones/{id}/editar`. Confirm Publicar → public_slug appears.

- [ ] **Step 3: Test PDF button**

Click "Descargar PDF". Expected:
- Spinner appears for 5-15s (local Browser Rendering may not be available; if binding fails, proceed with remote `wrangler dev --remote` or document the limitation).
- On success: browser downloads a `.pdf` file. Open it — verify content includes cover + property data + FODA + comparables, page breaks correct, web-only blocks (cta_whatsapp etc.) NOT visible.
- Quota counter "X / 50 este mes" appears below the button.

If local Browser Rendering is unavailable, the full E2E must be validated against staging/production post-deploy (Task 18).

- [ ] **Step 4: Test cache hit**

Click "Descargar PDF" again immediately. Expected: near-instant response, same file, counter does NOT increment.

- [ ] **Step 5: Test quota override**

Hit the endpoint in a loop until `monthly_used` reaches 50. The 51st call should return 429 with `{error: 'quota_exceeded', limit:50, used:50, reset_at:'...'}`.

```bash
for i in {1..52}; do
  curl -s -X POST http://localhost:8703/appraisals/{id}/pdf -H "Cookie: reportes_session=..." -w '%{http_code} ' -o /dev/null
done
```

Note: cache hits don't count, so to really exercise this you need to mutate overrides between calls (each change produces a new hash). Skip this test if time-constrained — production smoke test covers it.

---

### Task 17: One final commit

- [ ] **Step 1: Stage all sub-plan files**

From repo root, stage the exact paths listed in Task 15 Step 4. Use explicit paths to avoid picking up unrelated files:

```bash
git add vendepro-backend/packages/core/src/shared/stable-stringify.ts \
        vendepro-backend/packages/core/src/shared/index.ts \
        vendepro-backend/packages/core/src/domain/errors \
        vendepro-backend/packages/core/src/application/ports/services \
        vendepro-backend/packages/core/src/application/ports/index.ts \
        vendepro-backend/packages/core/src/application/use-cases/appraisals/generate-appraisal-pdf.ts \
        vendepro-backend/packages/core/src/application/index.ts \
        vendepro-backend/packages/core/tests/shared/stable-stringify.test.ts \
        vendepro-backend/packages/core/tests/use-cases/appraisals/generate-appraisal-pdf.test.ts \
        vendepro-backend/packages/infrastructure/src/services \
        vendepro-backend/packages/infrastructure/src/index.ts \
        vendepro-backend/packages/infrastructure/tests/services \
        vendepro-backend/packages/api-properties \
        vendepro-backend/packages/api-public \
        vendepro-backend/package.json \
        vendepro-backend/package-lock.json \
        vendepro-frontend/src/components/tasaciones/shared/api.ts \
        vendepro-frontend/src/components/tasaciones/editor/EditorShell.tsx \
        docs/superpowers/plans/2026-04-24-tasaciones-templates-pdf.md
```

- [ ] **Step 2: Create the commit**

```bash
git commit -m "$(cat <<'EOF'
feat(tasaciones): PDF generation vía Cloudflare Browser Rendering (Sub-plan 3, scope A)

Sub-plan 3 de 3 (scope A) — PDF generation. Cierra el feature de
tasaciones templates con export a PDF.

Backend:
- GenerateAppraisalPdfUseCase orquesta: load + hash + cache lookup +
  quota check + slug-on-demand + Browser Rendering + R2 put + persist
- CfBrowserRenderingService via @cloudflare/puppeteer en api-properties
- R2PdfStorage para bucket reportes-mg-assets, prefix appraisals/pdfs/
- PdfDownloadTokenSignerImpl con HS256 usando JWT_SECRET existente
- stableStringify garantiza determinismo del content_hash
- Errores tipados: QuotaExceeded(429), RenderTimeout(503), RenderFailed(500)

Endpoints:
- POST /appraisals/:id/pdf en api-properties (auth agent/admin)
- GET /public/pdf/:orgId/:appraisalId/:filename?token=... en api-public
  (JWT 15 min, streamea blob desde R2 con contentDisposition adecuado)

Frontend:
- Botón "Descargar PDF" en header del EditorShell
- Confirm modal cuando public_slug === null (primera descarga publica)
- Quota counter "X / 50 este mes" con colores amber/rose según umbral
- Handlers específicos para quota_exceeded y render_timeout

Cache: por content_hash = sha256(stableStringify(snapshot + overrides +
resolvedVars + publicSlug)). Cache hits no cuentan contra quota.
Quota: 50 PDFs/mes/org.

Config manual post-deploy (documentada):
1. Cloudflare dashboard → activar Browser Rendering en worker
   vendepro-api-properties
2. R2 bucket reportes-mg-assets → lifecycle rule: prefix
   appraisals/pdfs/, expire after 30 days
3. Confirmar binding R2 + secret JWT_SECRET en api-public

Out of scope (NO incluye): migración de tasaciones legacy, cron cleanup
de appraisal_pdfs, botón en landing pública.

Tests nuevos: 22 unit/integration
  - stable-stringify (5), generate-appraisal-pdf (8),
    cf-browser-rendering (2), r2-pdf-storage (3),
    pdf-download-token-signer (4)

Spec: docs/superpowers/specs/2026-04-24-tasaciones-templates-pdf-design.md
Plan: docs/superpowers/plans/2026-04-24-tasaciones-templates-pdf.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Verify commit**

Run:
```bash
git log -1 --stat | head -40
```

Expected: single commit, ~22+ files changed, insertions >1000 lines.

---

### Task 18: Merge to main + push + post-deploy config

- [ ] **Step 1: Merge the feature branch back to main**

The controller calls `superpowers:finishing-a-development-branch` to handle merge + push. Same flow as Sub-plan 2.

- [ ] **Step 2: Post-deploy — activate Browser Rendering**

In Cloudflare dashboard:
1. Go to Workers & Pages → `vendepro-api-properties` → Settings → Browser Rendering → Enable.
2. Deploy latest (should happen automatically via GH Actions on push).

- [ ] **Step 3: Post-deploy — R2 lifecycle rule**

In Cloudflare dashboard:
1. R2 → `reportes-mg-assets` bucket → Settings → Object lifecycle rules → Add rule.
2. Prefix: `appraisals/pdfs/`
3. Action: Delete objects after 30 days.
4. Save.

- [ ] **Step 4: Post-deploy — smoke test on production**

Use an existing production tasación (or create one via the UI on the deployed frontend). Click "Descargar PDF" in the editor. Expected: 5-15s, then PDF downloads. Verify visually:
- Cover page.
- Property data page.
- FODA page.
- Comparables page (if any).
- Work conditions page.
- NO: cta_whatsapp, agent_contact_card, video_gallery, extra_media (web-only hidden).
- Page breaks correct (each major block starts on a new page).

If the PDF is blank or missing content, check worker logs via `wrangler tail vendepro-api-properties` for `console.error` output.

- [ ] **Step 5: Record production findings**

Document in a short Slack message or commit follow-up the outcome: PDF size, duration, any quirks. This is the closing signal of Sub-plan 3.

---

**End of Sub-plan 3.** Feature completo:
- Sub-plan 1 (merged to main 2026-04-24): backend foundation (tables, entities, use cases, routes, seeds).
- Sub-plan 2 (merged to main 2026-04-24): frontend completo (wizard, editor, admin, public renderer).
- Sub-plan 3 (this): PDF generation via Cloudflare Browser Rendering.

Próximos opcionales no cubiertos:
- Migración de tasaciones legacy al modelo template (propio spec + plan).
- Cron cleanup de `appraisal_pdfs` expirados.
- Botón "Descargar PDF" en la landing pública (con rate-limit por IP).
