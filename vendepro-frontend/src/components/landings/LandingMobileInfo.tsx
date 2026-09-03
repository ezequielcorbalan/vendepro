'use client'
import { ArrowLeft, ExternalLink, Copy, Check, Monitor } from 'lucide-react'
import { useState } from 'react'
import type { Landing } from '@/lib/landings/types'
import { publicLandingUrl, publicLandingHostPath } from '@/lib/landings/slug'
import { landingKindLabel } from '@/lib/landings/kind-label'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { LANDING_STATUSES } from '@/lib/crm-config'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Heading, Text } from '@/components/ui/Typography'
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
        <Button href="/landings" variant="ghost" size="icon" aria-label="Volver">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </Button>
        <Heading level={4} as="h1" className="truncate flex-1">Detalle de landing</Heading>
      </header>

      <div className="p-4 space-y-4">
        <Card padded={false} className="overflow-hidden">
          {landing.og_image_url ? (
            <img src={landing.og_image_url} alt="" className="w-full h-40 object-cover" />
          ) : (
            <div className="h-40 bg-gray-100 flex items-center justify-center text-gray-400">
              <span className="text-xs uppercase tracking-wider">Sin preview</span>
            </div>
          )}
          <div className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <Heading level={3} className="leading-tight">
                {landing.seo_title || landing.full_slug}
              </Heading>
              <StatusBadge label={LANDING_STATUSES[landing.status]?.label ?? landing.status} color={LANDING_STATUSES[landing.status]?.color} />
            </div>
            {landing.seo_description && (
              <Text size="sm" tone="muted" className="line-clamp-2">{landing.seo_description}</Text>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 pt-1">
              <Badge tone="neutral">{kindLabel}</Badge>
              <span>Creada {new Date(landing.created_at).toLocaleDateString('es-AR')}</span>
            </div>
          </div>
        </Card>

        <Card className="space-y-3">
          <div>
            <Text size="xs" tone="muted" weight="semibold" className="uppercase tracking-wider mb-1">URL pública</Text>
            <Text size="sm" className="font-mono break-all">{publicLandingHostPath(landing.full_slug)}</Text>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="lg"
              onClick={copyUrl}
              icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            >
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
            {landing.status === 'published' ? (
              <Button
                href={url}
                target="_blank"
                rel="noopener"
                size="lg"
                icon={<ExternalLink className="w-4 h-4" />}
              >
                Abrir
              </Button>
            ) : (
              <Button
                variant="outline"
                size="lg"
                disabled
                title="La landing aún no está publicada"
                icon={<ExternalLink className="w-4 h-4" />}
              >
                Abrir
              </Button>
            )}
          </div>
        </Card>

        {landing.status === 'draft' && landing.last_review_note && (
          <Alert tone="warning" title="Publicación rechazada">
            {landing.last_review_note}
          </Alert>
        )}

        <Card padded={false} className="border-dashed border-gray-300">
          <EmptyState
            icon={<Monitor className="w-6 h-6" />}
            title="El editor solo está disponible en desktop"
            description="Abrí esta landing desde una computadora para editar los bloques, usar la IA y cambiar la configuración."
          />
        </Card>
      </div>
    </div>
  )
}
