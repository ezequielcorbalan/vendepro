import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PublicAppraisalShell from '@/components/tasaciones/legacy/PublicAppraisalShell'
import { TemplateRenderer } from '@/components/tasaciones/renderer/TemplateRenderer'
import type { AppraisalContext, TemplateBlock, BlockOverrides, ResolvedVars } from '@/components/tasaciones/renderer/types'
import GtmScript from '@/components/marketing/GtmScript'
import '@/components/tasaciones/renderer/print.css'

const API_PUBLIC = process.env.NEXT_PUBLIC_API_PUBLIC_URL ?? 'https://public.api.vendepro.com.ar'

function parseJson<T>(v: unknown): T | null {
  if (!v) return null
  if (typeof v === 'object') return v as T
  if (typeof v === 'string') { try { return JSON.parse(v) as T } catch { return null } }
  return null
}

function buildAppraisalContext(data: any): AppraisalContext {
  const a = data.appraisal

  // NOTE: The backend /public/appraisal/:slug endpoint currently returns a
  // flat appraisal row without a full JOIN to users (agent) or the full
  // organizations row. This means `data.agent` and `data.org.brand_accent_color`
  // may be null even when those records exist in D1. Block components are
  // defensive (AgentContactCardBlock returns null when no name), so the
  // renderer degrades gracefully. If a future phase wants live agent data
  // in public landings, extend the backend's GetPublicAppraisalUseCase to
  // include agent/org JOIN fields. Today the admin can wire agent info
  // statically inside a block's `data` (e.g. name/phone in agent_contact_card).

  return {
    id: a.id,
    property_address: a.property_address,
    neighborhood: a.neighborhood ?? null,
    city: a.city ?? null,
    property_type: a.property_type ?? null,
    covered_area: a.covered_area ?? null,
    total_area: a.total_area ?? null,
    semi_area: a.semi_area ?? null,
    weighted_area: a.weighted_area ?? null,
    swot: {
      strengths: a.strengths ?? null,
      weaknesses: a.weaknesses ?? null,
      opportunities: a.opportunities ?? null,
      threats: a.threats ?? null,
    },
    prices: {
      suggested: a.suggested_price ?? null,
      test: a.test_price ?? null,
      expected_close: a.expected_close_price ?? null,
      usd_per_m2: a.usd_per_m2 ?? null,
    },
    comparables: a.comparables ?? [],
    agent: data.agent ?? null,
    org: data.org ?? data.branding ?? null,
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  try {
    const res = await fetch(`${API_PUBLIC}/public/appraisal/${slug}`, { cache: 'no-store' })
    if (!res.ok) return { title: 'Informe de tasación', robots: { index: false } }
    const data = (await res.json()) as any
    const appraisal = data?.appraisal
    if (!appraisal) return { title: 'Informe de tasación', robots: { index: false } }
    const org = data.org || data.branding || { name: 'Inmobiliaria' }
    return {
      title: `Tasación — ${appraisal.property_address}`,
      description: `Informe de tasación profesional para ${appraisal.property_address}. Preparado por ${org.name}.`,
      robots: { index: false, follow: false },
    }
  } catch {
    return { title: 'Informe de tasación', robots: { index: false } }
  }
}

export default async function PublicTasacionPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ print?: string }>
}) {
  const { slug } = await params
  const qp = await searchParams

  const res = await fetch(`${API_PUBLIC}/public/appraisal/${slug}`, { cache: 'no-store' })
  if (!res.ok) notFound()
  const data = (await res.json()) as any
  if (!data?.appraisal) notFound()

  const isPrint = qp?.print === '1'
  const snapshot = parseJson<TemplateBlock[]>(data.appraisal.template_snapshot_json)
  const hasTemplate = !!data.appraisal.template_id && snapshot !== null && snapshot.length > 0

  if (hasTemplate) {
    const overrides = parseJson<BlockOverrides>(data.appraisal.block_overrides_json) ?? {}
    const appraisal = buildAppraisalContext(data)
    const resolvedVars = (data.resolved_vars as ResolvedVars | undefined) ?? {}
    return (
      <>
        <TemplateRenderer
          snapshot={snapshot}
          overrides={overrides}
          appraisal={appraisal}
          resolvedVars={resolvedVars}
          mode={isPrint ? 'print' : 'web'}
          className="min-h-screen bg-white"
        />
        <GtmScript />
      </>
    )
  }

  return <PublicAppraisalShell data={data} />
}
