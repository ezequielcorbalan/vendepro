import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import VisitFormClient from './VisitFormClient'
import GtmScript from '@/components/marketing/GtmScript'

const API_PUBLIC = process.env.NEXT_PUBLIC_API_PUBLIC_URL ?? 'https://public.api.vendepro.com.ar'

async function fetchForm(slug: string) {
  const res = await fetch(`${API_PUBLIC}/public/property-visit-form/${slug}`, { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()) as any
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  try {
    const data = await fetchForm(slug)
    return {
      title: data?.property?.address
        ? `Ficha de visita — ${data.property.address}`
        : 'Ficha de visita',
      robots: { index: false, follow: false },
    }
  } catch {
    return { title: 'Ficha de visita', robots: { index: false } }
  }
}

export default async function VisitFormPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const data = await fetchForm(slug)
  if (!data) notFound()

  return (
    <>
      <GtmScript
        containerId={data.org?.gtm_container_id ?? data.gtm_container_id ?? null}
        stapeEndpoint={data.org?.stape_endpoint ?? data.stape_endpoint ?? null}
      />
      <VisitFormClient slug={slug} data={data} apiPublic={API_PUBLIC} />
    </>
  )
}
