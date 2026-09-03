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
