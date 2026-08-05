import { ClipboardList } from 'lucide-react'

export default function Step4Tasaciones() {
  return (
    <div className="flex flex-col items-center text-center px-4 py-6 gap-5">
      <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center">
        <ClipboardList className="w-8 h-8 text-purple-600" />
      </div>
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-ink">Tasaciones profesionales</h2>
        <p className="text-gray-500 text-sm max-w-sm">
          Cuando un propietario quiere vender, abrís una Tasación vinculada al lead y gestionás todo el proceso desde ahí.
        </p>
      </div>
      <div className="w-full max-w-sm space-y-3 text-left">
        {[
          ['📝', 'Completá el informe con bloques editables: descripción, comparables, entorno'],
          ['📄', 'Generá un PDF profesional con tu marca para presentar al cliente'],
          ['🤝', 'Registrá las condiciones de trabajo: comisión, exclusividad, precio acordado'],
          ['✅', 'Al aprobar la tasación, se crea automáticamente la Propiedad en el pipeline'],
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
