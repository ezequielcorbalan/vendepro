import { BookUser } from 'lucide-react'

export default function Step3Leads() {
  return (
    <div className="flex flex-col items-center text-center px-4 py-6 gap-5">
      <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center">
        <BookUser className="w-8 h-8 text-blue-600" />
      </div>
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-gray-800">Capturá tus prospectos</h2>
        <p className="text-gray-500 text-sm max-w-sm">
          Cada interesado entra como Lead y avanza por el pipeline hasta convertirse en una captación o venta.
        </p>
      </div>
      <div className="w-full max-w-sm space-y-3 text-left">
        {[
          ['📡', 'Registrá la fuente de cada lead: portal, referido, redes sociales, etc.'],
          ['📋', 'Asigná seguimientos con fecha y próximo paso concreto'],
          ['🏷️', 'Etiquetá entre Propietario, Comprador, Inversor o Aliado'],
          ['🔴', 'Leads sin actividad por varios días se marcan automáticamente como vencidos'],
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
