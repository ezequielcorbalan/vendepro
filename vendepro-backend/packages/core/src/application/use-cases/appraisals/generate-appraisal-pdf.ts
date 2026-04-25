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
    const rawVars = varKeys.length > 0
      ? await orgVarRepo.resolveKeys(input.orgId, varKeys)
      : {}
    // Extract scalar values only — full entity objects would contaminate the
    // content hash with metadata (created_at, updated_at) that changes
    // independently of the actual variable value, breaking cache reuse.
    const resolvedVars: Record<string, unknown> = Object.fromEntries(
      Object.entries(rawVars).map(([k, v]) => {
        const obj = (typeof (v as any)?.toObject === 'function') ? (v as any).toObject() : v
        return [k, { value: obj?.value ?? null, value_type: obj?.value_type ?? null }]
      })
    )

    const nowDate = now()

    const contentHash = await computeContentHash({
      snapshot,
      overrides,
      resolvedVars,
      publicSlug: (appraisalObj as any).public_slug ?? null,
    })

    // Adapted: plan used findActiveByHash/countSinceDate; actual port uses findCachedByHash/countByOrgSince
    const cached = await pdfRepo.findCachedByHash(contentHash, nowDate)
    const firstOfMonth = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), 1)).toISOString()
    const usedPrior = await pdfRepo.countByOrgSince(input.orgId, firstOfMonth)

    if (cached) {
      const cachedObj = typeof (cached as any).toObject === 'function' ? (cached as any).toObject() : cached
      const pdf_url = await buildDownloadUrl(tokenSigner, cachedObj.r2_key, input.orgId, input.appraisalId, (appraisalObj as any).public_slug)
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

    const pdf_url = await buildDownloadUrl(tokenSigner, r2Key, input.orgId, input.appraisalId, publicSlug)
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
  resolvedVars: Record<string, unknown>
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

async function buildDownloadUrl(
  signer: PdfDownloadTokenSigner,
  r2Key: string,
  orgId: string,
  appraisalId: string,
  slug: string | null,
): Promise<string> {
  const filename = `tasacion-${slug ?? appraisalId}.pdf`
  return await signer.buildDownloadUrl({ r2Key, orgId, appraisalId, filename, ttlSec: DOWNLOAD_TTL_SEC })
}
