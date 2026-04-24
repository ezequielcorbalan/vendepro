export const RENTAL_TYPES = [
  { value: 'residencial', label: 'Residencial' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'temporal', label: 'Temporal' },
]

export const CURRENCIES = [
  { value: 'ARS', label: 'ARS (Pesos)' },
  { value: 'USD', label: 'USD (Dólares)' },
]

export const PAYMENT_DAYS = Array.from({ length: 28 }, (_, i) => i + 1)

export const ADJUSTMENT_FREQUENCIES = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'cuatrimestral', label: 'Cuatrimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
]

export const ADJUSTMENT_TYPES = [
  { value: 'tasa_fija', label: 'Tasa fija' },
  { value: 'manual', label: 'Manual' },
  { value: 'ipc_2m', label: 'IPC (2 meses rezago)' },
  { value: 'ipc_1m', label: 'IPC (1 mes rezago)' },
  { value: 'icl', label: 'ICL (BCRA)' },
  { value: 'personalizado', label: 'Índice personalizado' },
  { value: 'sin_ajuste', label: 'Sin ajuste' },
]

export const GUARANTEE_TYPES = [
  { value: 'sin_garantia', label: 'Sin garantía' },
  { value: 'real', label: 'Garantía real' },
  { value: 'personal_fiador', label: 'Garantía personal / Fiador' },
  { value: 'seguro_caucion', label: 'Seguro de caución' },
]

export const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'mercado_pago', label: 'Mercado Pago' },
  { value: 'otro', label: 'Otro' },
]

export const PAYMENT_TYPES = [
  { value: 'alquiler', label: 'Alquiler' },
  { value: 'llave', label: 'Llave' },
  { value: 'expensas', label: 'Expensas' },
  { value: 'deposito', label: 'Depósito' },
  { value: 'otros', label: 'Otros' },
]

export const EXPENSE_CATEGORIES = [
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'reparacion', label: 'Reparación' },
  { value: 'honorarios', label: 'Honorarios' },
  { value: 'impuestos', label: 'Impuestos' },
  { value: 'seguros', label: 'Seguros' },
  { value: 'expensas', label: 'Expensas' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'otros', label: 'Otros' },
]

export const PROPERTY_TYPES = [
  { value: 'departamento', label: 'Departamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'local', label: 'Local comercial' },
  { value: 'oficina', label: 'Oficina' },
  { value: 'cochera', label: 'Cochera' },
  { value: 'otro', label: 'Otro' },
]

export const RENTAL_STATUS_LABELS: Record<string, string> = {
  activo: 'Activo',
  por_vencer: 'Por vencer',
  finalizado: 'Finalizado',
  rescindido: 'Rescindido',
}

export const RENTAL_STATUS_COLORS: Record<string, string> = {
  activo: 'bg-green-100 text-green-700',
  por_vencer: 'bg-orange-100 text-orange-700',
  finalizado: 'bg-gray-100 text-gray-600',
  rescindido: 'bg-red-100 text-red-700',
}

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pagado: 'bg-green-100 text-green-700',
  pendiente: 'bg-orange-100 text-orange-700',
  vencido: 'bg-red-100 text-red-700',
}

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://rentals.api.vendepro.com.ar'
