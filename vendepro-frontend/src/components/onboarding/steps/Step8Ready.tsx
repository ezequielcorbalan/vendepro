import { ArrowRight, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  name: string
  onClose: () => void
}

export default function Step8Ready({ name, onClose }: Props) {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center text-center px-4 py-6 gap-6">
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center shadow-lg shadow-pink-200">
        <span className="text-4xl">🚀</span>
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-800">
          ¡Todo listo{name ? `, ${name.split(' ')[0]}` : ''}!
        </h2>
        <p className="text-gray-500 text-sm max-w-sm">
          Ya conocés VendéPro. Empezá cargando tu primer lead o explorando el dashboard.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <button
          onClick={onClose}
          className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-700 px-4 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Ir al Dashboard
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => { onClose(); router.push('/leads') }}
          className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-brand-pink to-brand-orange text-white px-4 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-md shadow-pink-200"
        >
          <Users className="w-4 h-4" />
          Cargar mi primer Lead
        </button>
      </div>

      <p className="text-xs text-gray-400">
        Podés volver a ver este tutorial desde{' '}
        <span className="text-gray-500 font-medium">Configuración → Ayuda</span>
      </p>
    </div>
  )
}
