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
 * mostrado cuando un barrio o aviso está por debajo de su benchmark.
 * Usa gradientes y shadows para dar profundidad visual.
 */
export default function DiagnosisCard({
  neighborhood,
  deltaPct,
  activeViewsPerDay,
  soldViewsPerDay,
}: DiagnosisCardProps) {
  return (
    <div className="rounded-xl overflow-hidden shadow-sm border border-red-200 bg-gradient-to-br from-red-50 via-orange-50/50 to-red-50">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-md shrink-0" aria-hidden="true">
          <AlertTriangle className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-red-800 text-sm sm:text-base">
            {Math.abs(deltaPct).toFixed(0)}% por debajo del benchmark
          </p>
          <p className="text-xs sm:text-sm text-red-600/90 mt-0.5">
            En {neighborhood}: tu aviso tiene <strong>{activeViewsPerDay} vis/día</strong>
            {' · '}
            los vendidos <strong>{soldViewsPerDay} vis/día</strong>
          </p>
          <div className="mt-4 pt-4 border-t border-red-200/60">
            <p className="text-xs text-gray-700 mb-3 font-medium">
              Revisá los 5 pasos de comercialización
              <span className="text-gray-500 font-normal"> — Marcela Genta</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {STEPS.map(s => {
                const Icon = s.icon
                return (
                  <div
                    key={s.label}
                    className="flex items-start gap-2 p-2 rounded-lg bg-white/70 border border-red-100/60 shadow-sm"
                  >
                    <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#ff8017]/20 to-[#ff007c]/20 flex items-center justify-center shrink-0" aria-hidden="true">
                      <Icon className="w-3.5 h-3.5 text-[#ff007c]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 text-xs">{s.label}</p>
                      <p className="text-gray-500 text-[10px] leading-tight">{s.hint}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
