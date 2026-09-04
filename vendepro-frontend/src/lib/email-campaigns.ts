// Tipos y config compartida del módulo de campañas de email.

export interface CampaignSegment {
  source: 'contacts' | 'leads'
  contact_type?: string | null
  stages?: string[] | null
}

export interface EmailCampaign {
  id: string
  name: string
  subject?: string | null
  preheader?: string | null
  html?: string | null
  text?: string | null
  segment_json?: string | null
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'
  scheduled_at?: string | null
  total_recipients: number
  sent_count: number
  failed_count: number
  sent_at?: string | null
  created_at: string
}

export interface CampaignSend {
  id: string
  email: string
  name?: string | null
  status: 'pending' | 'sent' | 'failed'
  error?: string | null
  sent_at?: string | null
}

export const CAMPAIGN_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Borrador', cls: 'bg-gray-100 text-gray-600' },
  scheduled: { label: 'Programada', cls: 'bg-blue-50 text-blue-600' },
  sending: { label: 'Enviando…', cls: 'bg-amber-50 text-amber-600' },
  sent: { label: 'Enviada', cls: 'bg-green-50 text-green-600' },
  cancelled: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-400' },
}

export const LEAD_STAGES = [
  { key: 'nuevo', label: 'Nuevo' },
  { key: 'asignado', label: 'Asignado' },
  { key: 'contactado', label: 'Contactado' },
  { key: 'calificado', label: 'Calificado' },
  { key: 'en_tasacion', label: 'En tasación' },
  { key: 'presentada', label: 'Presentada' },
  { key: 'seguimiento', label: 'Seguimiento' },
  { key: 'captado', label: 'Captado' },
  { key: 'perdido', label: 'No captado' },
]

export const CONTACT_TYPES = [
  { key: '', label: 'Todos los contactos' },
  { key: 'propietario', label: 'Propietarios' },
  { key: 'comprador', label: 'Compradores' },
  { key: 'inversor', label: 'Inversores' },
]

export const CAMPAIGN_KINDS = [
  { key: 'nueva_propiedad', label: 'Nueva propiedad' },
  { key: 'newsletter', label: 'Newsletter' },
  { key: 'seguimiento', label: 'Seguimiento' },
  { key: 'reactivacion', label: 'Reactivación' },
  { key: 'otro', label: 'Otro' },
]

export function describeSegment(segment: CampaignSegment | null): string {
  if (!segment) return 'Sin audiencia'
  if (segment.source === 'contacts') {
    const t = CONTACT_TYPES.find(x => x.key === (segment.contact_type ?? ''))
    return t?.label ?? 'Contactos'
  }
  const stages = segment.stages ?? []
  if (stages.length === 0) return 'Todos los leads'
  return `Leads: ${stages.map(s => LEAD_STAGES.find(x => x.key === s)?.label ?? s).join(', ')}`
}

export function parseSegment(json?: string | null): CampaignSegment | null {
  if (!json) return null
  try { return JSON.parse(json) } catch { return null }
}

export const fmtDateTime = (s?: string | null) =>
  s ? new Date(s.replace(' ', 'T')).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
