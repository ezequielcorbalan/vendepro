// Tipos y config del módulo de automatizaciones (secuencias drip).

export interface AutomationStep {
  delay_hours: number
  subject: string
  preheader: string
  html: string
  text: string
}

export interface EmailAutomation {
  id: string
  name: string
  status: 'draft' | 'active' | 'paused'
  trigger_event?: string | null
  steps_json?: string | null
  step_count?: number
  active_enrollments?: number
  created_at: string
}

export interface AutomationDetail extends EmailAutomation {
  enrollment_counts: Record<string, number>
  sends: { sent: number; failed: number }
}

export interface Enrollment {
  id: string
  email: string
  name?: string | null
  current_step: number
  status: 'active' | 'completed' | 'cancelled' | 'unsubscribed'
  next_run_at?: string | null
  enrolled_at: string
}

export const AUTOMATION_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Borrador', cls: 'bg-gray-100 text-gray-600' },
  active: { label: 'Activa', cls: 'bg-green-50 text-green-600' },
  paused: { label: 'Pausada', cls: 'bg-amber-50 text-amber-600' },
}

export const ENROLLMENT_STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'En curso', cls: 'text-blue-600' },
  completed: { label: 'Completada', cls: 'text-green-600' },
  cancelled: { label: 'Cancelada', cls: 'text-gray-400' },
  unsubscribed: { label: 'Se dio de baja', cls: 'text-red-500' },
}

// Disparadores por evento del CRM. null = solo inscripción manual.
export const TRIGGER_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: '', label: 'Solo inscripción manual', hint: 'Vos elegís cuándo y a quién inscribir' },
  { value: 'lead_created', label: 'Lead nuevo', hint: 'Cuando entra un lead al CRM' },
  { value: 'stage:contactado', label: 'Lead contactado', hint: 'Cuando un lead pasa a “contactado”' },
  { value: 'stage:calificado', label: 'Lead calificado', hint: 'Cuando un lead pasa a “calificado”' },
  { value: 'stage:en_tasacion', label: 'Lead en tasación', hint: 'Cuando un lead pasa a “en tasación”' },
  { value: 'stage:captado', label: 'Lead captado', hint: 'Cuando un lead pasa a “captado”' },
  { value: 'stage:perdido', label: 'Lead perdido', hint: 'Reactivación de leads perdidos' },
]

export function triggerLabel(trigger?: string | null): string {
  if (!trigger) return 'Manual'
  return TRIGGER_OPTIONS.find(t => t.value === trigger)?.label ?? trigger
}

export function parseSteps(json?: string | null): AutomationStep[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export function describeDelay(hours: number): string {
  if (hours <= 0) return 'Al inscribirse'
  if (hours < 24) return `${hours} h después`
  const days = Math.round(hours / 24)
  return `${days} día${days === 1 ? '' : 's'} después`
}

export const fmtDateTime = (s?: string | null) =>
  s ? new Date(s.replace(' ', 'T')).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
