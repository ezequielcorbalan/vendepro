export default function Step1Welcome({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center text-center px-4 py-6 gap-5">
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center shadow-lg shadow-pink-200">
        <span className="text-4xl">🏡</span>
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-ink">
          ¡Bienvenido{name ? `, ${name.split(' ')[0]}` : ''}!
        </h2>
        <p className="text-gray-500 text-sm max-w-sm">
          VendéPro es el CRM diseñado para inmobiliarias. En unos minutos te mostramos cómo sacarle el máximo provecho.
        </p>
      </div>
      <div className="w-full max-w-sm space-y-3 text-left">
        {[
          ['🎯', 'Gestioná leads, tasaciones y propiedades en un solo lugar'],
          ['🔄', 'Seguí cada operación desde el primer contacto hasta la venta'],
          ['📅', 'Automatizá tu seguimiento y nunca pierdas un cliente'],
        ].map(([icon, text]) => (
          <div key={text} className="flex items-start gap-3 p-3 bg-gray-50 rounded-card">
            <span className="text-lg leading-none mt-0.5">{icon}</span>
            <p className="text-sm text-gray-700">{text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
