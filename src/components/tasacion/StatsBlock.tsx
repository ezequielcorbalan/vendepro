import { Home, TrendingUp, Calendar } from 'lucide-react'

interface StatsBlockProps {
  block: any
  settings: Record<string, string>
  primary: string
  accent: string
  presentationMode: boolean
}

export default function StatsBlock({ block, settings, primary, accent, presentationMode }: StatsBlockProps) {
  const propsPublicadas = settings.tasacion_datos_props_publicadas
  const vendidasMes = settings.tasacion_datos_vendidas_mes
  const escrituras = settings.tasacion_datos_escrituras_mes
  const mesRef = settings.tasacion_datos_mes_referencia

  if (!propsPublicadas && !escrituras) return null

  const pct = vendidasMes && propsPublicadas && Number(propsPublicadas) > 0
    ? (Number(vendidasMes) / Number(propsPublicadas) * 100).toFixed(1)
    : null

  return (
    <div className="p-5 sm:p-8">
      <h2 className={`text-lg sm:text-xl font-bold mb-2 flex items-center gap-2 ${presentationMode ? 'text-white' : 'text-gray-800'}`}>
        <span className="w-1.5 h-8 rounded-full" style={{ background: `linear-gradient(to bottom, ${primary}, ${accent})` }} />
        {block.title}
      </h2>
      {block.description && (
        <p className={`text-sm leading-relaxed mb-5 ${presentationMode ? 'text-gray-400' : 'text-gray-500'}`}>
          {block.description}
        </p>
      )}
      {mesRef && (
        <div className="inline-block bg-gray-100 rounded-full px-3 py-1 mb-5">
          <p className="text-[11px] font-medium text-gray-500">Datos de {mesRef}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {propsPublicadas && (
          <div className={`relative overflow-hidden rounded-2xl p-6 text-center ${presentationMode ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'}`}>
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-t-2xl" />
            <div className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center ${presentationMode ? 'bg-indigo-500/20' : 'bg-indigo-50'}`}>
              <Home className={`w-6 h-6 ${presentationMode ? 'text-indigo-300' : 'text-indigo-500'}`} />
            </div>
            <p className={`font-black ${presentationMode ? 'text-white text-4xl' : 'text-gray-800 text-3xl sm:text-4xl'}`}>
              {Number(propsPublicadas).toLocaleString('es-AR')}
            </p>
            <p className={`text-sm mt-1.5 font-medium ${presentationMode ? 'text-gray-400' : 'text-gray-500'}`}>Propiedades en venta</p>
          </div>
        )}
        {pct && (
          <div className={`relative overflow-hidden rounded-2xl p-6 text-center ${presentationMode ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'}`}>
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-400 to-emerald-500 rounded-t-2xl" />
            <div className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center ${presentationMode ? 'bg-green-500/20' : 'bg-green-50'}`}>
              <TrendingUp className={`w-6 h-6 ${presentationMode ? 'text-green-300' : 'text-green-500'}`} />
            </div>
            <p className={`font-black ${presentationMode ? 'text-white text-4xl' : 'text-gray-800 text-3xl sm:text-4xl'}`}>
              {pct}%
            </p>
            <p className={`text-sm mt-1.5 font-medium ${presentationMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Se vende por mes ({Number(vendidasMes).toLocaleString('es-AR')})
            </p>
          </div>
        )}
        {escrituras && (
          <div className={`relative overflow-hidden rounded-2xl p-6 text-center ${presentationMode ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'}`}>
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: `linear-gradient(to right, ${primary}, ${accent})` }} />
            <div className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center`} style={{ background: `${accent}15` }}>
              <Calendar className="w-6 h-6" style={{ color: accent }} />
            </div>
            <p className={`font-black ${presentationMode ? 'text-white text-4xl' : 'text-gray-800 text-3xl sm:text-4xl'}`}>
              {Number(escrituras).toLocaleString('es-AR')}
            </p>
            <p className={`text-sm mt-1.5 font-medium ${presentationMode ? 'text-gray-400' : 'text-gray-500'}`}>Escrituras por mes</p>
          </div>
        )}
      </div>
    </div>
  )
}
