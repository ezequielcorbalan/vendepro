import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PublicAppraisalShell from '@/components/tasaciones/PublicAppraisalShell'
import GtmScript from '@/components/marketing/GtmScript'

const API_PUBLIC = process.env.NEXT_PUBLIC_API_PUBLIC_URL ?? 'http://localhost:8708'

function parseJsonField<T>(v: unknown): T | null {
  if (!v) return null
  if (typeof v === 'object') return v as T
  if (typeof v === 'string') {
    try { return JSON.parse(v) as T } catch { return null }
  }
  return null
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
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const res = await fetch(`${API_PUBLIC}/public/appraisal/${slug}`, { cache: 'no-store' })
  if (!res.ok) notFound()

  const data = (await res.json()) as any
  if (!data || !data.appraisal) notFound()

  const appraisal = data.appraisal || {}
  // The backend may have already parsed these (when toObject keeps typed blocks)
  // or they may arrive as *_json strings depending on the worker response shape.
  const proposal = appraisal.proposal ?? parseJsonField<any>(appraisal.proposal_json)
  const market_situation = appraisal.market_situation ?? parseJsonField<any>(appraisal.market_situation_json)
  const work_conditions = appraisal.work_conditions ?? parseJsonField<any>(appraisal.work_conditions_json)
  const video_links = appraisal.video_links ?? parseJsonField<string[]>(appraisal.video_links_json)

  const org = data.org || {}
  const branding = {
    name: org.name ?? data.branding?.name ?? 'Inmobiliaria',
    logo_url: org.logo_url ?? data.branding?.logo_url ?? null,
    primary: org.brand_color ?? data.branding?.primary ?? '#ff007c',
    accent: data.branding?.accent ?? '#ff8017',
  }

  return (
    <>
      <GtmScript
        containerId={org.gtm_container_id ?? data.gtm_container_id ?? null}
        stapeEndpoint={org.stape_endpoint ?? data.stape_endpoint ?? null}
      />
      <PublicAppraisalShell
        data={{
          appraisal: {
            ...appraisal,
            proposal,
            market_situation,
            work_conditions,
            video_links,
          },
          comparables: data.comparables || appraisal.comparables || [],
          branding,
        }}
      />
    </>
  )
}
