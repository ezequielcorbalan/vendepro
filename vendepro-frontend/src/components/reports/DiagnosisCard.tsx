import { Camera, Map, Video, Share2, DollarSign, Box } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Text } from '@/components/ui/Typography'

interface DiagnosisCardProps {
  neighborhood: string
  deltaPct: number
  activeViewsPerDay: number
  soldViewsPerDay: number
}

const STEPS = [
  { icon: DollarSign, label: 'Precio de publicación', hint: '¿está dentro de mercado?' },
  { icon: Camera,     label: 'Fotos profesionales',   hint: '36+ fotos de buena calidad' },
  { icon: Box,        label: 'Tour Virtual 360°',     hint: 'recorrido inmersivo' },
  { icon: Map,        label: 'Plano',                 hint: 'dimensiones y distribución' },
  { icon: Video,      label: 'Video',                 hint: '30-60 segundos editado' },
  { icon: Share2,     label: 'Redes sociales',        hint: 'YouTube, Instagram, etc.' },
]

/**
 * Cartel de diagnóstico con los pasos de comercialización de MG, mostrado
 * cuando un barrio o aviso está por debajo de su benchmark. Es un callout de
 * estado, así que va sobre Alert con el tono danger del DS.
 */
export default function DiagnosisCard({
  neighborhood,
  deltaPct,
  activeViewsPerDay,
  soldViewsPerDay,
}: DiagnosisCardProps) {
  return (
    <Alert tone="danger" title={`${Math.abs(deltaPct).toFixed(0)}% por debajo del benchmark`}>
      <Text size="sm" tone="muted">
        En {neighborhood}: tu aviso tiene <strong className="text-ink">{activeViewsPerDay} vis/día</strong>
        {' · '}
        los vendidos <strong className="text-ink">{soldViewsPerDay} vis/día</strong>
      </Text>

      <div className="mt-4 pt-4 border-t border-danger/20">
        <Text size="xs" weight="medium" className="mb-3 text-gray-700">
          Revisá los pasos de comercialización
          <Text size="xs" as="span" tone="muted" className="font-normal"> — Marcela Genta</Text>
        </Text>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {STEPS.map(s => {
            const Icon = s.icon
            return (
              <div
                key={s.label}
                className="flex items-start gap-2 p-2 rounded-control bg-white border border-gray-200"
              >
                <div className="w-7 h-7 rounded-control bg-primary/10 text-primary flex items-center justify-center shrink-0" aria-hidden="true">
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <Text size="xs" weight="medium">{s.label}</Text>
                  <Text size="xs" tone="muted" className="leading-tight">{s.hint}</Text>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Alert>
  )
}
