'use client'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Copy, Check, Monitor } from 'lucide-react'
import { useState } from 'react'
import type { Landing } from '@/lib/landings/types'
import { publicLandingUrl, publicLandingHostPath } from '@/lib/landings/slug'
import { landingKindLabel } from '@/lib/landings/kind-label'
import StatusBadge from './StatusBadge'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'

export default function LandingMobileInfo({ landing }: { landing: Landing }) {
  const [copied, setCopied] = useState(false)
  const url = publicLandingUrl(landing.full_slug)
  const kindLabel = landingKindLabel(landing.kind)

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link href="/landings" className="p-1.5 hover:bg-gray-100 rounded-lg" aria-label="Volver">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </Link>
        <h1 className="font-semibold text-ink truncate flex-1">Detalle de landing</h1>
      </header>

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-card border border-gray-200 overflow-hidden">
          {landing.og_image_url ? (
            <img src={landing.og_image_url} alt="" className="w-full h-40 object-cover" />
          ) : (
            <div className="h-40 bg-gradient-to-br from-brand-pink/10 to-brand-orange/10 flex items-center justify-center text-gray-400">
              <span className="text-xs uppercase tracking-wider">Sin preview</span>
            </div>
          )}
          <div className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold text-ink text-lg leading-tight">
                {landing.seo_title || landing.full_slug}
              </h2>
              <StatusBadge status={landing.status} />
            </div>
            {landing.seo_description && (
              <p className="text-sm text-gray-600 line-clamp-2">{landing.seo_description}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 pt-1">
              <span className="px-2 py-0.5 rounded-md bg-gray-100">{kindLabel}</span>
              <span>Creada {new Date(landing.created_at).toLocaleDateString('es-AR')}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-card border border-gray-200 p-4 space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">URL pública</p>
            <p className="text-sm font-mono text-ink break-all">{publicLandingHostPath(landing.full_slug)}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={copyUrl}
              className="inline-flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-ink text-sm font-medium py-2.5 rounded-control transition-colors"
            >
              {copied ? <><Check className="w-4 h-4" /> Copiado</> : <><Copy className="w-4 h-4" /> Copiar</>}
            </button>
            {landing.status === 'published' ? (
              <a
                href={url}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center justify-center gap-1.5 bg-gradient-to-br from-brand-pink to-brand-orange hover:opacity-90 text-white text-sm font-semibold py-2.5 rounded-control"
              >
                <ExternalLink className="w-4 h-4" /> Abrir
              </a>
            ) : (
              <button
                disabled
                className="inline-flex items-center justify-center gap-1.5 bg-gray-100 text-gray-400 text-sm font-medium py-2.5 rounded-control cursor-not-allowed"
                title="La landing aún no está publicada"
              >
                <ExternalLink className="w-4 h-4" /> Abrir
              </button>
            )}
          </div>
        </div>

        {landing.status === 'draft' && landing.last_review_note && (
          <Alert tone="warning" title="Publicación rechazada">
            {landing.last_review_note}
          </Alert>
        )}

        <div className="bg-white rounded-card border border-dashed border-gray-300">
          <EmptyState
            icon={<Monitor className="w-6 h-6" />}
            title="El editor solo está disponible en desktop"
            description="Abrí esta landing desde una computadora para editar los bloques, usar la IA y cambiar la configuración."
          />
        </div>
      </div>
    </div>
  )
}
