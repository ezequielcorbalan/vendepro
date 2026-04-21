import type { LandingStatus } from '@/lib/landings/types'

const STYLES: Record<LandingStatus, { bg: string; text: string; label: string }> = {
  'draft':          { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Borrador' },
  'pending_review': { bg: 'bg-amber-100', text: 'text-amber-800', label: 'En revisión' },
  'published':      { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Publicada' },
  'archived':       { bg: 'bg-gray-200', text: 'text-gray-500', label: 'Archivada' },
}

export default function StatusBadge({ status }: { status: LandingStatus }) {
  const s = STYLES[status]
  return <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
}
