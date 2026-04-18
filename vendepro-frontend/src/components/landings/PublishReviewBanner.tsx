import { XCircle } from 'lucide-react'

export default function PublishReviewBanner({ note }: { note: string }) {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-start gap-3">
      <XCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-amber-900">Publicación rechazada</p>
        <p className="text-sm text-amber-800">{note}</p>
      </div>
    </div>
  )
}
