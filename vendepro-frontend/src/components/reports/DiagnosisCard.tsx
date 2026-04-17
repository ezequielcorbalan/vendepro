import { AlertTriangle, Camera, Map, Video, Share2, DollarSign, Box } from 'lucide-react'

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
 * Cartel de diagnóstico con los 5 pasos de comercialización de MG,
 * mostrado cuando un barrio está significativamente por debajo de
 * su benchmark de avisos vendidos.
 */
export default function DiagnosisCard({
  neighborhood,
  deltaPct,
  activeViewsPerDay,
  soldViewsPerDay,
}: DiagnosisCardProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-red-800 text-sm sm:text-base">
            Tus activos en {neighborhood} están {Math.abs(deltaPct).toFixed(0)}% por debajo de los vendidos
          </p>
          <p className="text-xs sm:text-sm text-red-600 mt-0.5">
            Tus activos: <strong>{activeViewsPerDay} vis/día</strong>
            {' · '}
            Los que vendiste: <strong>{soldViewsPerDay} vis/día</strong>
          </p>
          <p className="text-xs text-gray-600 mt-3 mb-2">
            Revisá los <strong>5 pasos de comercialización</strong> (Marcela Genta):
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {STEPS.map(s => {
              const Icon = s.icon
              return (
                <div key={s.label} className="flex items-start gap-2 text-xs">
                  <Icon className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-gray-700">{s.label}</p>
                    <p className="text-gray-500 text-[10px]">{s.hint}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
