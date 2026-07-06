import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import UnsubscribeClient from './UnsubscribeClient'

const API_PUBLIC = process.env.NEXT_PUBLIC_API_PUBLIC_URL ?? 'https://public.api.vendepro.com.ar'

export const metadata: Metadata = {
  title: 'Cancelar suscripción',
  robots: { index: false, follow: false },
}

async function verifyToken(token: string) {
  const res = await fetch(`${API_PUBLIC}/public/unsubscribe/${encodeURIComponent(token)}`, { cache: 'no-store' })
  if (!res.ok) return null
  return (await res.json()) as any
}

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const data = await verifyToken(token)
  if (!data?.ok) notFound()

  return <UnsubscribeClient token={token} email={data.email} apiPublic={API_PUBLIC} />
}
