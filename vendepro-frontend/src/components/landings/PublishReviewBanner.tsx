import { XCircle } from 'lucide-react'

// Banner de ancho completo (no un callout boxeado): usa los tokens semánticos
// de Alert (warning) pero sin el contenedor con radio/padding de card, porque
// vive edge-to-edge entre el toolbar del editor y el canvas.
export default function PublishReviewBanner({ note }: { note: string }) {
  return (
    <div className="bg-warning/10 border-b border-warning/30 px-4 py-3 flex items-start gap-3">
      <XCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-ink">Publicación rechazada</p>
        <p className="text-sm text-ink">{note}</p>
      </div>
    </div>
  )
}
