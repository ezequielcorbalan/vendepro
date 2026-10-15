/** Lo que devuelve api-crm para la bandeja y el hilo. */

export interface Conversation {
  id: string
  channel: string
  lead: { id: string; full_name: string | null; stage: string | null; pipeline: string; address?: string | null } | null
  status: 'open' | 'pending' | 'resolved'
  contact_id: string | null
  contact_name: string | null
  assignee_id: string | null
  assignee_name: string | null
  labels: string[]
  last_message: string | null
  last_activity_at: string | null
  window_open: boolean
}

export interface Message {
  id: string
  direction: 'in' | 'out'
  sender_type: 'contact' | 'agent' | 'bot'
  sender_name: string | null
  content: string | null
  attachments: Array<{ type: string }>
  created_at: string
}

export const ESTADO: Record<string, { label: string; color: string }> = {
  open: { label: 'Abierta', color: 'bg-success/10 text-success' },
  pending: { label: 'Pendiente', color: 'bg-warning/10 text-warning' },
  resolved: { label: 'Resuelta', color: 'bg-gray-100 text-gray-600' },
}

/** Hora si es de hoy; si no, el día. Es como se lee una bandeja de chat. */
export function hora(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const hoy = new Date().toDateString() === d.toDateString()
  return hoy
    ? d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}
