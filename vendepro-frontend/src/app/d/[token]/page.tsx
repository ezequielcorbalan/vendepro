import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import DocPortalClient from './DocPortalClient'
import type { PublicDocPortal } from '@/lib/doc-portal'

const API_PUBLIC = process.env.NEXT_PUBLIC_API_PUBLIC_URL ?? 'https://public.api.vendepro.com.ar'

type Fetched = { status: 'ok'; data: PublicDocPortal } | { status: 'closed' } | { status: 'missing' }

async function fetchPortal(token: string): Promise<Fetched> {
  const res = await fetch(`${API_PUBLIC}/public/docs/${encodeURIComponent(token)}`, { cache: 'no-store' })
  // 410 = link revocado o propiedad cerrada: el propietario tiene que saber
  // que le pida otro, no ver un "no existe".
  if (res.status === 410) return { status: 'closed' }
  if (!res.ok) return { status: 'missing' }
  return { status: 'ok', data: (await res.json()) as any }
}

export const metadata: Metadata = {
  title: 'Documentación de tu propiedad',
  // El link es la única credencial del propietario: no debe indexarse.
  robots: { index: false, follow: false },
}

export default async function DocPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const result = await fetchPortal(token).catch((): Fetched => ({ status: 'missing' }))
  if (result.status === 'missing') notFound()

  return (
    <DocPortalClient
      token={token}
      apiPublic={API_PUBLIC}
      data={result.status === 'ok' ? result.data : null}
    />
  )
}
