'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { landingsApi } from '@/lib/landings/api'
import type { Landing } from '@/lib/landings/types'
import BlockRenderer from '@/components/landings/BlockRenderer'

export default function LandingPreviewPage() {
  const params = useParams<{ id: string }>()
  const [landing, setLanding] = useState<Landing | null>(null)

  useEffect(() => {
    landingsApi.get(params.id).then(r => setLanding(r.landing))
  }, [params.id])

  if (!landing) {
    return <div className="p-12 text-center text-gray-500">Cargando preview…</div>
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-amber-50 text-amber-900 text-center text-xs py-2 border-b border-amber-200">
        Vista previa interna · status: <strong>{landing.status}</strong>
      </div>
      <BlockRenderer blocks={landing.blocks} mode="public" />
    </div>
  )
}
