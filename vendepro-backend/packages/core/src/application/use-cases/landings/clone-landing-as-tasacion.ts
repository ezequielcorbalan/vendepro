import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { AppraisalRepository } from '../../ports/repositories/appraisal-repository'
import type { IdGenerator } from '../../ports/id-generator'
import type { Actor } from '../../../domain/rules/landing-rules'
import {
  Appraisal,
  type AppraisalProposalBlock,
  type AppraisalMarketSituationBlock,
  type AppraisalWorkConditionsBlock,
} from '../../../domain/entities/appraisal'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface CloneLandingAsTasacionInput {
  actor: Actor
  orgId: string
  landingId: string
  property_id?: string | null
  lead_id?: string | null
  contact_id?: string | null
  address?: string | null
}

export interface CloneLandingAsTasacionOutput {
  appraisal_id: string
  public_slug: string | null
}

/**
 * Crea una nueva Tasación (Appraisal) a partir de una landing-plantilla.
 * Best-effort: copia los bloques cuyos tipos puedan mapearse a los campos
 * `proposal`, `market_situation` o `work_conditions` del Appraisal. Otros
 * bloques se ignoran por ahora — el editor visual sigue viviendo en la
 * landing original.
 *
 * El mapeo actual es heurístico: como los bloques de landing no tienen un
 * tipo "proposal" explícito, intentamos identificarlos por el `id` del
 * bloque (convención del frontend al sembrar la plantilla). Si no hay
 * coincidencia, dejamos los campos en null y la tasación se crea vacía.
 */
export class CloneLandingAsTasacionUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly appraisals: AppraisalRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: CloneLandingAsTasacionInput): Promise<CloneLandingAsTasacionOutput> {
    const landing = await this.landings.findById(input.landingId, input.orgId)
    if (!landing) throw new NotFoundError('Landing', input.landingId)

    const blocks = landing.blocks
    const proposal = pickProposalBlock(blocks)
    const market = pickMarketSituationBlock(blocks)
    const work = pickWorkConditionsBlock(blocks)

    const id = this.idGen.generate()
    const appraisal = Appraisal.create({
      id,
      org_id: input.orgId,
      property_address: input.address ?? 'Sin dirección',
      neighborhood: 'Sin barrio',
      city: 'Buenos Aires',
      property_type: 'departamento',
      covered_area: null,
      total_area: null,
      semi_area: null,
      weighted_area: null,
      strengths: null,
      weaknesses: null,
      opportunities: null,
      threats: null,
      publication_analysis: null,
      suggested_price: null,
      test_price: null,
      expected_close_price: null,
      usd_per_m2: null,
      canva_design_id: null,
      canva_edit_url: null,
      agent_id: input.actor.userId,
      lead_id: input.lead_id ?? null,
      status: 'draft',
      public_slug: null,
      proposal,
      market_situation: market,
      work_conditions: work,
      video_links: null,
      comparables: [],
    })
    await this.appraisals.save(appraisal)

    // Persistimos template_landing_id + property_id via update() para no
    // ensanchar Appraisal.create con campos que solo aplican al clonado.
    const patch: Record<string, unknown> = { template_landing_id: input.landingId }
    if (input.property_id) patch.property_id = input.property_id
    await this.appraisals.update(id, input.orgId, patch)

    const refreshed = await this.appraisals.findById(id, input.orgId)
    return { appraisal_id: id, public_slug: refreshed?.public_slug ?? null }
  }
}

// ── Heurísticas de mapeo bloque-landing → campo-appraisal ──────────────
// Los bloques de landing no tienen un tipo "proposal" / "market" / "work"
// explícito. Convenimos que el frontend, al definir la plantilla, usa ids
// que contienen las palabras clave abajo. Si no hay match, devolvemos null
// y la tasación se crea sin esos campos.

function pickProposalBlock(blocks: any[]): AppraisalProposalBlock | null {
  const b = blocks.find((b) => isProposalLike(b))
  if (!b) return null
  const d = b.data ?? {}
  return {
    title: d.title ?? d.eyebrow ?? undefined,
    subtitle: d.subtitle ?? null,
    body: extractBody(d),
    show_agent_signature: undefined,
  }
}

function pickMarketSituationBlock(blocks: any[]): AppraisalMarketSituationBlock | null {
  const b = blocks.find((b) => isMarketLike(b))
  if (!b) return null
  const d = b.data ?? {}
  return {
    title: d.title ?? undefined,
    body: extractBody(d),
    media_urls: extractMediaUrls(d),
  }
}

function pickWorkConditionsBlock(blocks: any[]): AppraisalWorkConditionsBlock | null {
  const b = blocks.find((b) => isWorkLike(b))
  if (!b) return null
  const d = b.data ?? {}
  return {
    honorarios_pct: null,
    honorarios_usd: null,
    exclusividad: undefined,
    exclusividad_meses: null,
    extras: Array.isArray(d.items) ? d.items.map((i: any) => i?.title).filter(Boolean) : [],
    legal_text: extractBody(d),
  }
}

function isProposalLike(b: any): boolean {
  const id = String(b?.id ?? '').toLowerCase()
  return id.includes('proposal') || id.includes('propuesta')
}

function isMarketLike(b: any): boolean {
  const id = String(b?.id ?? '').toLowerCase()
  return id.includes('market') || id.includes('mercado')
}

function isWorkLike(b: any): boolean {
  const id = String(b?.id ?? '').toLowerCase()
  return id.includes('work') || id.includes('condicion') || id.includes('honorar')
}

function extractBody(d: any): string | null {
  if (typeof d?.body === 'string') return d.body
  if (typeof d?.subtitle === 'string') return d.subtitle
  if (typeof d?.disclaimer === 'string') return d.disclaimer
  return null
}

function extractMediaUrls(d: any): string[] {
  if (Array.isArray(d?.media_urls)) return d.media_urls.filter((u: any) => typeof u === 'string')
  if (Array.isArray(d?.images)) return d.images.map((i: any) => i?.url).filter((u: any) => typeof u === 'string')
  if (typeof d?.background_image_url === 'string') return [d.background_image_url]
  return []
}
