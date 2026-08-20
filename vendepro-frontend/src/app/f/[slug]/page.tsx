import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import FichaPublicaClient from './FichaPublicaClient'

const API_PUBLIC = process.env.NEXT_PUBLIC_API_PUBLIC_URL ?? 'https://public.api.vendepro.com.ar'

async function fetchLink(slug: string) {
  const res = await fetch(`${API_PUBLIC}/public/ficha/${slug}`, { cache: 'no-store' })
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
    const data = await fetchLink(slug)
    return {
      title: data?.org?.name
        ? `Ficha de tasación — ${data.org.name}`
        : 'Ficha de tasación',
      // El link es la única credencial del formulario: no debe indexarse.
      robots: { index: false, follow: false },
    }
  } catch {
    return { title: 'Ficha de tasación', robots: { index: false, follow: false } }
  }
}

export default async function FichaPublicaPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const data = await fetchLink(slug)
  if (!data) notFound()

  return <FichaPublicaClient slug={slug} data={data} apiPublic={API_PUBLIC} />
}
