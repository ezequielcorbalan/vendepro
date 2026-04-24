# Tasaciones Templates — PDF Generation (Sub-plan 3, scope A)

**Fecha:** 2026-04-24
**Autor:** Ezequiel Corbalán + Claude
**Estado:** Diseño aprobado, pendiente de plan de implementación
**Continuación de:**
- `docs/superpowers/specs/2026-04-23-tasaciones-templates-design.md` (spec global, §7 define el contrato PDF)
- `docs/superpowers/plans/2026-04-23-tasaciones-templates-backend.md` (Sub-plan 1 — backend foundation, creó `appraisal_pdfs`)
- `docs/superpowers/specs/2026-04-24-tasaciones-templates-frontend-design.md` (Sub-plan 2 — frontend completo)

---

## 1. Alcance y objetivo

Este sub-plan implementa la **generación de PDF** de tasaciones vía Cloudflare Browser Rendering. El agente clickea "Descargar PDF" en el editor y obtiene un archivo PDF listo para compartir por fuera del sistema (WhatsApp, email).

**Scope acotado (decisión del usuario: scope A):**
- Endpoint `POST /appraisals/:id/pdf` + use case + servicios (Browser Rendering + R2).
- Cache por `content_hash` (evita regeneraciones costosas).
- Quota mensual 50 PDFs/org (cache hits no cuentan).
- Botón "Descargar PDF" en el editor de tasación (solo).
- Endpoint intermediario `/public/pdf/...?token=...` para descargar el blob desde R2 con JWT de 15 min.

**Fuera de alcance (difiere a futuros sub-planes):**
- Migración de tasaciones legacy al modelo template (`MigrateLegacyAppraisalUseCase`).
- Cron de cleanup de `appraisal_pdfs` expirados.
- Cleanup de `components/tasaciones/legacy/` y columnas legacy en `appraisals`.
- Botón en landing pública `/t/[slug]` (la descarga es agent-only por ahora).
- Rate-limit por IP del endpoint intermediario (la ventana de 15 min del JWT + quota por org alcanza).
- Bulk download, histórico de PDFs, AI features.

---

## 2. Decisiones de alto nivel

| Decisión | Elegido | Razón |
|---|---|---|
| Flujo | Síncrono (el agente espera el PDF con spinner) | PDFs de 5-15s no justifican polling + tracking de jobs |
| Dominio que Browser Rendering carga | `https://app.vendepro.com.ar/t/{slug}?print=1` | Reusa el renderer del Sub-plan 2 ya en producción |
| Descarga | Endpoint intermediario `/public/pdf/...?token=...` en `api-public` | Evita AWS SDK en worker, permite auditar, control TTL propio |
| Token de descarga | JWT con `{r2_key, orgId, appraisalId, exp}`, firmado con secret ya existente (`JWT_SECRET`) | Validez 15 min, stateless |
| Quota | 50 PDFs/mes/org, cache hits no cuentan | Conservador para arranque, se ajusta por demanda real |
| Cache invalidation | Por `content_hash` (snapshot + overrides + resolvedVars + public_slug) | Automático — cambio de data = nuevo hash = nuevo render |
| Public_slug on-demand | Sí, el use case lo genera si falta antes de renderizar | Primera descarga publica la tasación — confirmación UX en frontend |
| Errores tipados | `QuotaExceededError`, `RenderTimeoutError`, `RenderFailedError` | Hono mapea a códigos HTTP específicos |
| R2 lifecycle | 30 días, regla manual en CF dashboard (prefix `appraisals/pdfs/`) | Cleanup automático de archivos; rows en D1 quedan (cron futuro) |

---

## 3. Arquitectura

### 3.1 Data flow (happy path)

```
/tasaciones/[id]/editar        POST /appraisals/:id/pdf
     │                                      │
     ▼ click "Descargar PDF"                ▼
[generatePdf API wrapper]     [GenerateAppraisalPdfUseCase]
     │                                      │
     │                          1. load appraisal + snapshot + overrides
     │                          2. load resolved_vars (via OrgVariableRepo)
     │                          3. compute content_hash (SHA-256 de stable JSON)
     │                          4. cache lookup: pdfRepo.findActiveByHash()
     │                                 │
     │                          cache HIT                   cache MISS
     │                          signed token             quota check (>= 50 → 429)
     │                          return URL               generate public_slug if null
     │                                                   browser renders
     │                                                   R2 put blob
     │                                                   pdfRepo.save() row
     │                                                   signed token, return URL
     │                                      │
     ▼     200 { pdf_url, expires_at, from_cache, monthly_used }
     │
     ▼
window.location.href = pdf_url
     │
     ▼
GET /public/pdf/{orgId}/{appraisalId}/{hash}.pdf?token=...   (api-public)
     │
     ▼
verify JWT, r2.get(key), stream response with
  Content-Type: application/pdf
  Content-Disposition: attachment; filename="tasacion-{slug}.pdf"
     │
     ▼
browser downloads the file
```

### 3.2 Componentes nuevos

**Backend:**
- `packages/core/src/application/use-cases/appraisals/generate-appraisal-pdf.ts` — use case principal
- `packages/core/src/application/ports/services/browser-rendering-service.ts` — puerto
- `packages/core/src/application/ports/services/pdf-storage.ts` — puerto
- `packages/core/src/domain/errors/quota-exceeded-error.ts` — error tipado
- `packages/core/src/domain/errors/render-timeout-error.ts`
- `packages/core/src/domain/errors/render-failed-error.ts`
- `packages/core/src/shared/stable-stringify.ts` — util deterministic JSON
- `packages/core/tests/use-cases/appraisals/generate-appraisal-pdf.test.ts`
- `packages/core/tests/shared/stable-stringify.test.ts`
- `packages/infrastructure/src/services/cf-browser-rendering-service.ts` — impl
- `packages/infrastructure/src/services/r2-pdf-storage.ts` — impl
- `packages/infrastructure/src/services/pdf-download-token.ts` — JWT sign/verify
- `packages/infrastructure/tests/services/*.test.ts`

**Backend modificado:**
- `packages/api-properties/src/routes/appraisals.ts` — nuevo `POST /appraisals/:id/pdf` handler
- `packages/api-properties/wrangler.jsonc` — binding `BROWSER` + confirmar `R2`
- `packages/api-properties/package.json` — dep `@cloudflare/puppeteer`
- `packages/api-public/src/index.ts` — nuevo `GET /public/pdf/:orgId/:appraisalId/:filename` handler

**Frontend modificado:**
- `src/components/tasaciones/editor/EditorShell.tsx` — botón "Descargar PDF" + estados
- `src/components/tasaciones/shared/api.ts` — wrapper `generatePdf(id)`

**Configuración manual (fuera del repo, documentada en plan):**
- CF dashboard → activar Browser Rendering en `vendepro-api-properties`
- CF dashboard → R2 bucket lifecycle: prefix `appraisals/pdfs/`, expire after 30 days

---

## 4. Backend detallado

### 4.1 `GenerateAppraisalPdfUseCase`

```typescript
interface Deps {
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

interface Input { appraisalId: string; orgId: string; userId: string }

interface Result {
  pdf_url: string
  expires_at: string         // ISO
  from_cache: boolean
  monthly_used: number
}
```

**Pasos internos:**

1. `appraisal = appraisalRepo.findById(appraisalId, orgId)` → if null: `AppraisalNotFoundError`.
2. Parse `snapshot = JSON.parse(appraisal.template_snapshot_json)` (o empty array).
3. Parse `overrides = JSON.parse(appraisal.block_overrides_json ?? '{}')`.
4. Extract var keys from snapshot (blocks' `data.vars` array + `chart_1_var` + `chart_2_var`).
5. `resolvedVars = orgVarRepo.resolveKeys(orgId, keys)` (empty if no keys).
6. `contentHash = sha256(stableStringify({ snapshot, overrides, resolvedVars, publicSlug: appraisal.public_slug }))`.
7. `cached = pdfRepo.findActiveByHash(contentHash, now)` (active = `expires_at > now`).
8. **If cached:**
   - `monthly_used = pdfRepo.countSinceDate(orgId, firstOfMonth)`
   - `token = tokenSigner.sign({ r2Key: cached.r2_key, orgId, appraisalId, ttlSec: 900 })`
   - Return `{ pdf_url: buildDownloadUrl(cached.r2_key, token), expires_at: now + 15min, from_cache: true, monthly_used }`.
9. **If not cached (MISS):**
   - `used = pdfRepo.countSinceDate(orgId, firstOfMonth)`; if `used >= 50`: throw `QuotaExceededError(50, used, firstOfNextMonth)`.
   - If `appraisal.public_slug === null`: generate slug (reuse `/appraisals/publish` algorithm) → `appraisalRepo.update(appraisalId, orgId, { public_slug })`.
   - `url = `https://app.vendepro.com.ar/t/${slug}?print=1``
   - `bytes = browserRendering.renderPdf(url, { format: 'A4', margin: '12mm', waitUntil: 'networkidle0', timeout: 30_000 })` → may throw `RenderTimeoutError` / `RenderFailedError`.
   - `r2Key = `appraisals/pdfs/${orgId}/${appraisalId}/${contentHash}.pdf``
   - `pdfStorage.put(r2Key, bytes, { contentType: 'application/pdf', contentDisposition: `attachment; filename="tasacion-${slug}.pdf"` })`
   - `pdfRepo.save(AppraisalPdf.create({ id, orgId, appraisalId, contentHash, r2Key, sizeBytes: bytes.length, generatedAt: now, expiresAt: now + 30d }))`
   - `token = tokenSigner.sign({ r2Key, orgId, appraisalId, ttlSec: 900 })`
   - Return `{ pdf_url: buildDownloadUrl(r2Key, token), expires_at: now + 15min, from_cache: false, monthly_used: used + 1 }`.

### 4.2 `stableStringify`

```typescript
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']'
  const keys = Object.keys(value as Record<string, unknown>).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify((value as any)[k])).join(',') + '}'
}
```

Tests: identical output for `{a:1,b:2}` and `{b:2,a:1}`; handles nested objects, arrays, null, primitives.

### 4.3 `BrowserRenderingService` port + `CfBrowserRenderingService` impl

```typescript
// port
export interface BrowserRenderingService {
  renderPdf(url: string, opts: { format?: 'A4' | 'Letter'; margin?: string; waitUntil?: 'networkidle0'; timeout?: number }): Promise<Uint8Array>
}
```

Impl uses `@cloudflare/puppeteer`:
```typescript
import puppeteer from '@cloudflare/puppeteer'

export class CfBrowserRenderingService implements BrowserRenderingService {
  constructor(private readonly binding: Fetcher) {}
  async renderPdf(url: string, opts): Promise<Uint8Array> {
    const browser = await puppeteer.launch(this.binding)
    try {
      const page = await browser.newPage()
      try {
        await page.goto(url, { waitUntil: opts.waitUntil ?? 'networkidle0', timeout: opts.timeout ?? 30000 })
      } catch (e: any) {
        if (/timeout/i.test(e?.message ?? '')) throw new RenderTimeoutError()
        throw new RenderFailedError(e?.message ?? 'goto failed')
      }
      const buffer = await page.pdf({
        format: opts.format ?? 'A4',
        margin: { top: opts.margin ?? '12mm', bottom: opts.margin ?? '12mm', left: opts.margin ?? '12mm', right: opts.margin ?? '12mm' },
        printBackground: true,
        preferCSSPageSize: true,
      })
      return new Uint8Array(buffer)
    } finally {
      await browser.close()
    }
  }
}
```

### 4.4 `PdfStorage` port + `R2PdfStorage` impl

```typescript
// port
export interface PdfStorage {
  put(key: string, bytes: Uint8Array, meta: { contentType: string; contentDisposition: string }): Promise<void>
  get(key: string): Promise<{ body: ReadableStream; size: number; contentType: string; contentDisposition: string } | null>
}
```

Impl uses `R2Bucket` binding:
```typescript
export class R2PdfStorage implements PdfStorage {
  constructor(private readonly bucket: R2Bucket) {}
  async put(key, bytes, meta) {
    await this.bucket.put(key, bytes, {
      httpMetadata: { contentType: meta.contentType, contentDisposition: meta.contentDisposition }
    })
  }
  async get(key) {
    const obj = await this.bucket.get(key)
    if (!obj) return null
    return {
      body: obj.body,
      size: obj.size,
      contentType: obj.httpMetadata?.contentType ?? 'application/pdf',
      contentDisposition: obj.httpMetadata?.contentDisposition ?? 'attachment',
    }
  }
}
```

### 4.5 `PdfDownloadTokenSigner`

JWT con payload `{ r2Key, orgId, appraisalId, exp }`, firmado con HS256 usando `JWT_SECRET` que ya usa el resto de la app.

```typescript
export interface PdfDownloadTokenSigner {
  sign(input: { r2Key: string; orgId: string; appraisalId: string; ttlSec: number }): string
  verify(token: string): { r2Key: string; orgId: string; appraisalId: string } | null
}
```

Impl usa la misma utilidad JWT existente (`jose` o manual HS256 — alinearse con la auth existente del repo).

### 4.6 Endpoint intermediario en `api-public`

```typescript
// GET /public/pdf/:orgId/:appraisalId/:filename?token=...
app.get('/public/pdf/:orgId/:appraisalId/:filename', async (c) => {
  const token = c.req.query('token')
  if (!token) return c.text('Missing token', 401)
  const tokenSigner = new PdfDownloadTokenSigner(c.env.JWT_SECRET)
  const payload = tokenSigner.verify(token)
  if (!payload) return c.text('Invalid or expired token', 401)
  // Verify path matches token
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

El `buildDownloadUrl(r2Key, token)` del use case arma el URL absoluto: `https://<api-public-host>/public/pdf/{orgId}/{appraisalId}/{filename}?token=...`. El host de api-public lo tiene el worker via env (`API_PUBLIC_URL` o similar — reuso de lo existente).

### 4.7 Endpoint en `api-properties`

```typescript
// POST /appraisals/:id/pdf (auth required)
app.post('/appraisals/:id/pdf', async (c) => {
  const useCase = new GenerateAppraisalPdfUseCase({
    appraisalRepo: new D1AppraisalRepository(c.env.DB),
    pdfRepo: new D1AppraisalPdfRepository(c.env.DB),
    orgVarRepo: new D1OrgVariableRepository(c.env.DB),
    templateRepo: new D1AppraisalTemplateRepository(c.env.DB),
    browserRendering: new CfBrowserRenderingService(c.env.BROWSER),
    pdfStorage: new R2PdfStorage(c.env.R2),
    tokenSigner: new PdfDownloadTokenSigner(c.env.JWT_SECRET, c.env.API_PUBLIC_URL),
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
    if (e instanceof QuotaExceededError) return c.json({ error: 'quota_exceeded', limit: e.limit, used: e.used, reset_at: e.resetAt }, 429)
    if (e instanceof RenderTimeoutError) return c.json({ error: 'render_timeout' }, 503)
    if (e instanceof RenderFailedError) return c.json({ error: 'render_failed', message: e.message }, 500)
    if (e instanceof AppraisalNotFoundError) return c.json({ error: 'not_found' }, 404)
    console.error('generate-pdf unhandled', e)
    return c.json({ error: 'internal' }, 500)
  }
})
```

---

## 5. Frontend detallado

### 5.1 Botón en `EditorShell.tsx`

**Ubicación:** header, al lado de `Publicar`/`Ver pública`. Visible en desktop (también mobile pero compacto).

**Estados:**

| Estado | Label | Disabled |
|---|---|---|
| `idle` | `Descargar PDF` | no |
| `generating` | `Generando PDF...` (spinner) | sí |
| `error` | `Error, reintentar` | no |

Post-download exitosa → back to `idle`.

### 5.2 Flujo de confirmación (primera descarga)

Si `appraisal.public_slug === null`:

```
[Modal] ¿Descargar PDF?

Este PDF incluye un link público a https://app.vendepro.com.ar/t/{slug-autogenerado}.
Cualquiera con el link podrá ver la tasación.

[Cancelar]  [Descargar y publicar]
```

Si ya hay slug, descarga directa sin modal.

### 5.3 Quota display

Abajo del botón: texto chiquito `X / 50 este mes`. Color:
- `used < 40` → slate-500
- `40 <= used < 50` → amber-600
- `used >= 50` → rose-600 + botón disabled + tooltip "Alcanzaste el límite de 50 este mes"

El `monthly_used` viene en el response del endpoint; el frontend lo guarda en estado local después de cada descarga. En load inicial del editor NO se muestra (se muestra recién después del primer intento).

### 5.4 API wrapper

```typescript
// shared/api.ts
export async function generatePdf(appraisalId: string): Promise<{ pdf_url: string; expires_at: string; from_cache: boolean; monthly_used: number }> {
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

### 5.5 Handler y download trigger

```typescript
const handleDownload = async () => {
  if (!state.appraisal.public_slug) {
    if (!confirm('El PDF incluye un link público. ¿Continuar?')) return
  }
  setPdfStatus('generating')
  try {
    const result = await generatePdf(state.appraisal.id)
    setQuota(result.monthly_used)
    window.location.href = result.pdf_url
    setPdfStatus('idle')
  } catch (e: any) {
    setPdfStatus('error')
    if (e.code === 'quota_exceeded') {
      alert(`Alcanzaste el límite de ${e.details.limit} PDFs este mes (se resetea el ${e.details.reset_at.slice(0,10)}).`)
    } else if (e.code === 'render_timeout') {
      alert('La generación tardó más de lo esperado. Reintentá en unos segundos.')
    } else {
      alert(e.message ?? 'Error al generar PDF')
    }
  }
}
```

---

## 6. Errores y estados

Ver tabla en §4 y §5.

**Logging:** render errors y quota violations se loguean con `console.error` en los workers. Visible via `wrangler tail` y CF dashboard.

**Observabilidad futura (out of scope):** track de latencia de renderPdf (para ver si necesita subir timeout), cache hit rate (para evaluar quota).

---

## 7. Testing

### 7.1 Unit (core)

- `stable-stringify.test.ts` (5 tests) — primitives, arrays, nested objects, null, key ordering.
- `generate-appraisal-pdf.test.ts` (8 tests) —
  - cache hit path (no llama renderer)
  - cache miss happy path (llama renderer, persiste, devuelve URL)
  - content_hash determinism (2 runs = mismo hash con mismo input)
  - content_hash sensitivity (override cambia → hash cambia)
  - quota check falla en 50
  - quota check no falla en cache hit
  - public_slug generation cuando null
  - render timeout propagates como RenderTimeoutError

### 7.2 Integration (infrastructure)

- `cf-browser-rendering-service.test.ts` (3 tests) — mock binding, happy path, timeout path.
- `r2-pdf-storage.test.ts` (3 tests) — put + get + not-found.
- `pdf-download-token.test.ts` (4 tests) — sign roundtrip, expired, malformed, mismatch.

### 7.3 E2E manual (checklist al cerrar)

- [ ] Agente genera PDF de tasación con template Casa → archivo .pdf válido descarga.
- [ ] R2 dashboard muestra el objeto en `appraisals/pdfs/{org}/{id}/{hash}.pdf`.
- [ ] Mismo PDF 5 min después → cache hit (instantáneo), quota no incrementa.
- [ ] Cambiar override → nuevo hash, nuevo render, quota +1.
- [ ] Forzar 50 PDFs (script) → 51º devuelve 429 con payload correcto.
- [ ] PDF oculta bloques web-only (cta_whatsapp, video_gallery, extra_media, agent_contact_card).
- [ ] PDF respeta page-breaks (proposal_commercial, property_data, comparables_list, price_projection, work_conditions).
- [ ] Editor muestra "X / 50 este mes" después del primer intento.
- [ ] Primera descarga con `public_slug === null` muestra modal de confirmación.
- [ ] Tasación legacy (sin template_id) → el botón "Descargar PDF" debe estar oculto o dar error limpio (spec 5.1 es editor-only; ver nota abajo).

**Nota sobre tasaciones legacy:** el editor nuevo (`EditorShell`) sólo se monta para tasaciones con `template_id` o snapshot. Tasaciones legacy siguen usando el shell viejo (Sub-plan 2 §7). Por lo tanto el botón de PDF no aparece en ellas — el usuario primero debe migrar (futuro Sub-plan con scope B/C).

---

## 8. Plan de configuración manual (post-deploy)

Post-merge a main, hacer manualmente en CF dashboard:

1. **Activar Browser Rendering** en el worker `vendepro-api-properties` (Settings → Browser Rendering → Enable).
2. **R2 lifecycle rule** en el bucket `reportes-mg-assets`:
   - Prefix: `appraisals/pdfs/`
   - Rule: expire after 30 days
3. **Verificar binding `R2`** en `api-public` (ya existe para assets — confirmar).

Estos 3 pasos bloquean producción. Documentarlos en el plan + `.claude/rules/deploy-debug.md`.

---

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Browser Rendering no habilitado en CF → worker crashea | Paso manual documentado, validar en dev primero con `wrangler dev --remote` |
| Frontend SSR demora > 30s | Plan incluye test E2E con tasación real; ajustar timeout o prerender si aparece |
| `public_slug` generation duplicada en concurrent requests | `appraisalRepo.update` es atomic; race conservadora — el último gana, ambas instancias terminan con el mismo slug resultado idéntico |
| Cache stale si se cambia el template desde admin sin sync de la tasación | El `template_snapshot_json` del appraisal es la fuente; no cambia hasta `sync-template`. Cache correcto |
| R2 objeto expira antes de D1 row | Endpoint intermediario devuelve 404; frontend re-triggers → cache MISS → nuevo render. Funcional sin intervención |
| Bad actor usa token de descarga de otra org | JWT firma `orgId + appraisalId + r2Key`; handler verifica match path vs payload antes de servir |
| Render produce PDF corrupto | Alto costo de detección. Asumimos que si `page.pdf()` resolvió sin throw, el output es válido. Manual review al arrancar |
| Deps nuevas en api-properties (`@cloudflare/puppeteer`) rompen build | CI cubre; si hay error, revertir commit (un solo commit por spec) |

---

## 10. Fuera de alcance (YAGNI — explícito)

- Migración de tasaciones legacy (`MigrateLegacyAppraisalUseCase`).
- Cron scheduler para limpiar `appraisal_pdfs` rows expirados.
- Cleanup de `components/tasaciones/legacy/`.
- Cleanup de columnas legacy en `appraisals` (proposal_json, market_situation_json, work_conditions_json, video_links_json).
- Botón de descarga en la landing pública `/t/[slug]`.
- Rate-limit por IP en el endpoint intermediario.
- Histórico de PDFs (listar, re-descargar un PDF viejo).
- Notificaciones (email al agente cuando el PDF está listo).
- Async job queue.

---

**Fin del spec.**
