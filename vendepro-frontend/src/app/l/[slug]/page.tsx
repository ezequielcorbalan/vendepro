import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PublicLandingShell from '@/components/landings/public/PublicLandingShell'
import { getPublicLanding } from '@/lib/landings/public-api'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const landing = await getPublicLanding(slug).catch(() => null)
  if (!landing) return { title: 'No disponible' }
  return {
    title: landing.seo_title ?? slug,
    description: landing.seo_description ?? undefined,
    openGraph: {
      title: landing.seo_title ?? slug,
      description: landing.seo_description ?? undefined,
      images: landing.og_image_url ? [landing.og_image_url] : undefined,
    },
    robots: 'index, follow',
  }
}

export const revalidate = 60

export default async function PublicLandingPage({ params }: Props) {
  const { slug } = await params
  const landing = await getPublicLanding(slug)
  if (!landing) notFound()
  return <PublicLandingShell slug={slug} blocks={landing.blocks as any} />
}
