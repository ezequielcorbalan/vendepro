const STATUS_CLASSES: Record<string, string> = {
  activo: 'bg-green-100 text-green-700',
  por_vencer: 'bg-orange-100 text-orange-700',
  finalizado: 'bg-gray-100 text-gray-600',
  rescindido: 'bg-red-100 text-red-700',
  pagado: 'bg-green-100 text-green-700',
  pendiente: 'bg-orange-100 text-orange-700',
  vencido: 'bg-red-100 text-red-700',
  disponible: 'bg-green-100 text-green-700',
  ocupada: 'bg-blue-100 text-blue-700',
  en_mantenimiento: 'bg-yellow-100 text-yellow-700',
  borrador: 'bg-gray-100 text-gray-600',
  enviada: 'bg-blue-100 text-blue-700',
  emitida: 'bg-blue-100 text-blue-700',
  anulada: 'bg-red-100 text-red-700',
  activo_service: 'bg-green-100 text-green-700',
}

const STATUS_LABELS: Record<string, string> = {
  activo: 'Activo',
  por_vencer: 'Por vencer',
  finalizado: 'Finalizado',
  rescindido: 'Rescindido',
  pagado: 'Pagado',
  pendiente: 'Pendiente',
  vencido: 'Vencido',
  disponible: 'Disponible',
  ocupada: 'Ocupada',
  en_mantenimiento: 'En mantenimiento',
  borrador: 'Borrador',
  enviada: 'Enviada',
  emitida: 'Emitida',
  anulada: 'Anulada',
}

export default function Badge({ status, label }: { status: string; label?: string }) {
  const cls = STATUS_CLASSES[status] || 'bg-gray-100 text-gray-600'
  const text = label || STATUS_LABELS[status] || status
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {text}
    </span>
  )
}
