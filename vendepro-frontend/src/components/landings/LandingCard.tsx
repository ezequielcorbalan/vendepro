'use client'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import type { Landing } from '@/lib/landings/types'
import StatusBadge from './StatusBadge'

export default function LandingCard({ landing }: { landing: Landing }) {
  const publicUrl = `https://${landing.full_slug}.landings.vendepro.com.ar`
  const kindLabel = landing.kind === 'lead_capture' ? 'Captación' : 'Propiedad'

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <Link href={`/landings/${landing.id}`} className="block">
        <div className="h-36 bg-gradient-to-br from-[#ff007c]/10 to-[#ff8017]/10 flex items-center justify-center text-gray-400">
          {landing.og_image_url
            ? <img src={landing.og_image_url} alt="" className="w-full h-full object-cover" />
            : <span className="text-xs uppercase tracking-wider">Sin preview</span>}
        </div>
        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 line-clamp-1">{landing.seo_title || landing.full_slug}</h3>
            <StatusBadge status={landing.status} />
          </div>
          <p className="text-xs text-gray-500 truncate">{landing.full_slug}.landings.vendepro.com.ar</p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="px-2 py-0.5 rounded-md bg-gray-100">{kindLabel}</span>
            <span>{new Date(landing.updated_at).toLocaleDateString('es-AR')}</span>
          </div>
        </div>
      </Link>
      <div className="px-4 pb-4 flex items-center gap-2">
        {landing.status === 'published' && (
          <a href={publicUrl} target="_blank" rel="noopener" className="text-xs text-[#ff007c] hover:underline inline-flex items-center gap-1">
            <ExternalLink className="w-3.5 h-3.5" /> Ver pública
          </a>
        )}
      </div>
    </div>
  )
}
