import { Building2 } from 'lucide-react'

export default function Step5Propiedades() {
  return (
    <div className="flex flex-col items-center text-center px-4 py-6 gap-5">
      <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
        <Building2 className="w-8 h-8 text-green-600" />
      </div>
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-ink">Gestión de propiedades</h2>
        <p className="text-gray-500 text-sm max-w-sm">
          Una vez captada la propiedad, la gestionás desde documentación hasta la venta o alquiler.
        </p>
      </div>

      {/* Pipeline mini */}
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        {[
          { label: 'Captada', color: 'bg-blue-100 text-blue-700' },
          { label: 'Publicada', color: 'bg-green-100 text-green-700' },
          { label: 'Reservada', color: 'bg-orange-100 text-orange-700' },
          { label: 'Vendida', color: 'bg-pink-100 text-pink-700' },
        ].map((s, i, arr) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.color}`}>{s.label}</span>
            {i < arr.length - 1 && <span className="text-gray-300 text-xs">→</span>}
          </div>
        ))}
      </div>

      <div className="w-full max-w-sm space-y-3 text-left">
        {[
          ['📸', 'Cargá fotos, fichas técnicas y documentación requerida'],
          ['🌐', 'Creá landing pages personalizadas para cada propiedad con un clic'],
          ['👁️', 'Registrá visitas de compradores y vinculalas a contactos'],
          ['💼', 'Gestioná ofertas, reservas y condiciones finales de la operación'],
        ].map(([icon, text]) => (
          <div key={text} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
            <span className="text-lg leading-none mt-0.5">{icon}</span>
            <p className="text-sm text-gray-700">{text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
