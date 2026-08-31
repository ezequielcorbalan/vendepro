'use client'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import type { Landing } from '@/lib/landings/types'
import { publicLandingUrl, publicLandingHostPath } from '@/lib/landings/slug'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { LANDING_STATUSES } from '@/lib/crm-config'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Heading, Text } from '@/components/ui/Typography'

export default function LandingCard({ landing }: { landing: Landing }) {
  const publicUrl = publicLandingUrl(landing.full_slug)
  const kindLabel = landing.kind === 'lead_capture' ? 'Captación' : 'Propiedad'
  const isTasacionTemplate = landing.template_type === 'tasacion'

  return (
    <Card padded={false} interactive className="overflow-hidden">
      <Link href={`/landings/${landing.id}`} className="block">
        <div className="h-36 bg-primary/10 flex items-center justify-center text-gray-400">
          {landing.og_image_url
            ? <img src={landing.og_image_url} alt="" className="w-full h-full object-cover" />
            : <span className="text-xs uppercase tracking-wider">Sin preview</span>}
        </div>
        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <Heading level={4} className="line-clamp-1">{landing.seo_title || landing.full_slug}</Heading>
            <StatusBadge label={LANDING_STATUSES[landing.status]?.label ?? landing.status} color={LANDING_STATUSES[landing.status]?.color} />
          </div>
          <Text size="xs" tone="muted" className="truncate">{publicLandingHostPath(landing.full_slug)}</Text>
          <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
            <Badge tone="neutral">{kindLabel}</Badge>
            {isTasacionTemplate && <Badge tone="primary">Plantilla tasación</Badge>}
            <span>{new Date(landing.updated_at).toLocaleDateString('es-AR')}</span>
          </div>
        </div>
      </Link>
      <div className="px-4 pb-4 flex items-center gap-2">
        {landing.status === 'published' && (
          <a href={publicUrl} target="_blank" rel="noopener" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            <ExternalLink className="w-3.5 h-3.5" /> Ver pública
          </a>
        )}
      </div>
    </Card>
  )
}
