const stages = [
  { label: 'Lead', color: 'bg-blue-100 text-blue-700' },
  { label: 'Contacto', color: 'bg-cyan-100 text-cyan-700' },
  { label: 'Tasación', color: 'bg-purple-100 text-purple-700' },
  { label: 'Propiedad', color: 'bg-green-100 text-green-700' },
  { label: 'Reserva', color: 'bg-orange-100 text-orange-700' },
  { label: 'Venta', color: 'bg-pink-100 text-pink-700' },
]

export default function Step2Pipeline() {
  return (
    <div className="flex flex-col items-center text-center px-4 py-6 gap-5">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff007c] to-[#ff8017] flex items-center justify-center shadow-md shadow-pink-200">
        <span className="text-3xl">🔄</span>
      </div>
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-gray-800">El pipeline comercial</h2>
        <p className="text-gray-500 text-sm max-w-sm">
          Todo el ciclo de vida de una operación, desde el primer lead hasta el cierre.
        </p>
      </div>

      {/* Pipeline visual */}
      <div className="w-full max-w-md">
        {/* Desktop: horizontal */}
        <div className="hidden sm:flex items-center justify-center flex-wrap gap-1">
          {stages.map((s, i) => (
            <div key={s.label} className="flex items-center gap-1">
              <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${s.color}`}>
                {s.label}
              </span>
              {i < stages.length - 1 && (
                <span className="text-gray-300 text-sm">→</span>
              )}
            </div>
          ))}
        </div>
        {/* Mobile: vertical */}
        <div className="sm:hidden flex flex-col items-center gap-1">
          {stages.map((s, i) => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <span className={`px-4 py-1.5 rounded-full text-xs font-semibold ${s.color}`}>
                {s.label}
              </span>
              {i < stages.length - 1 && (
                <span className="text-gray-300 text-xs">↓</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="w-full max-w-sm space-y-3 text-left">
        {[
          ['📌', 'Cada etapa tiene sus acciones y seguimientos definidos'],
          ['🚨', 'El sistema te avisa cuando un lead está vencido o sin actividad'],
          ['🔍', 'Filtrá por etapa desde leads, tasaciones o propiedades'],
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
