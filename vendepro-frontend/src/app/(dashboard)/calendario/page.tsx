'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Plus, X, ChevronLeft, ChevronRight, Calendar, Phone, Users, Home, Eye,
  ClipboardList, RefreshCw, FileText, FileSignature, CheckCircle2, Trash2,
  Link2, CalendarPlus
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/Switch'
import { Card, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Alert } from '@/components/ui/Alert'
import { Heading, Text } from '@/components/ui/Typography'
import { Field, Input, Select, Textarea } from '@/components/ui/Input'
import { CallButton, WhatsAppButton } from '@/components/ui/ContactButtons'
import { EVENT_TYPES } from '@/lib/crm-config'
import { apiFetch } from '@/lib/api'
import { getScopedAgentId } from '@/lib/agent-scope'

const ICON_MAP: Record<string, any> = {
  Phone, Users, Home, Eye, ClipboardList, RefreshCw, FileText, FileSignature, Calendar,
}

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAY_NAMES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']

function pad(n: number) { return String(n).padStart(2, '0') }
function fmtDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }
function isSameDay(a: Date, b: Date) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate() }
function daysInMonth(y: number, m: number) { return new Date(y, m+1, 0).getDate() }
function firstDayOfWeek(y: number, m: number) {
  const d = new Date(y, m, 1).getDay()
  return d === 0 ? 6 : d - 1
}
function fmtTime(s: string | null) {
  if (!s) return ''
  const d = new Date(s)
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/**
 * Google devuelve UTC (`...Z`) para eventos con hora y `YYYY-MM-DD` para los de
 * día completo. Los del CRM se guardan "naive" en hora local, y el calendario
 * agrupa por `start_at.split('T')[0]`. Sin normalizar, un evento de las 23:00
 * de Argentina (02:00 UTC) caería en el día siguiente.
 */
function googleToLocalNaive(iso: string, allDay: boolean): string {
  if (!iso) return ''
  // Día completo: la fecha ya es la correcta, no hay que convertir zona.
  if (allDay) return iso.length === 10 ? `${iso}T00:00` : iso
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function getET(key: string) {
  return (EVENT_TYPES as any)[key] || EVENT_TYPES.otro
}

// ── Link "Agregar a Google Calendar" para el cliente ────────────
// Semi-automático: se genera al instante, se copia o se manda por WhatsApp.
// No requiere que nadie conecte nada: es un link público de Google.

/** '2026-07-10T15:00' → '20260710T150000' (hora argentina; los ISO absolutos se convierten a UTC-3). */
function gcalStamp(s: string): string {
  if (/Z$|[+-]\d{2}:\d{2}$/.test(s)) {
    const ar = new Date(new Date(s).getTime() - 3 * 3600 * 1000) // ARG = UTC-3 fijo
    return ar.toISOString().slice(0, 19).replace(/[-:]/g, '')
  }
  const compact = s.replace(/[-:]/g, '').split('.')[0]
  return compact.length === 13 ? `${compact}00` : compact.slice(0, 15)
}

function stampPlusOneHour(stamp: string): string {
  const iso = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(9, 11)}:${stamp.slice(11, 13)}:${stamp.slice(13, 15)}Z`
  return new Date(new Date(iso).getTime() + 3600e3).toISOString().slice(0, 19).replace(/[-:]/g, '')
}

function clientCalendarLink(ev: { title: string; start_at: string | null; end_at?: string | null; notes?: string | null; description?: string | null }): string | null {
  if (!ev.start_at) return null
  const start = gcalStamp(ev.start_at)
  const end = ev.end_at ? gcalStamp(ev.end_at) : stampPlusOneHour(start)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${start}/${end}`,
    ctz: 'America/Argentina/Buenos_Aires',
  })
  const details = ev.description ?? ev.notes
  if (details) params.set('details', details)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function clientInviteMessage(ev: { title: string; start_at: string | null; end_at?: string | null; notes?: string | null; description?: string | null }): string {
  const when = ev.start_at
    ? `${new Date(ev.start_at).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })} a las ${fmtTime(ev.start_at)} hs`
    : ''
  const link = clientCalendarLink(ev)
  return `¡Hola! Te confirmo nuestra cita: *${ev.title}*${when ? ` el ${when}` : ''}.${link ? ` Podés agendarla en tu calendario desde acá: ${link}` : ''}`
}

function ETIcon({ type, className }: { type: string; className?: string }) {
  const cfg = getET(type)
  const Ico = ICON_MAP[cfg.icon] || Calendar
  return <Ico className={className || 'w-4 h-4'} />
}

export default function CalendarioPage() {
  const { toast } = useToast()
  const now = new Date()
  const [events, setEvents] = useState<any[]>([])
  // Eventos del Google Calendar personal: sólo lectura, para ver la agenda
  // completa sin salir del CRM.
  const [googleEvents, setGoogleEvents] = useState<any[]>([])
  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleReason, setGoogleReason] = useState<string | null>(null)
  const [googleEmail, setGoogleEmail] = useState<string | null>(null)
  const [showGoogle, setShowGoogle] = useState(true)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'month' | 'agenda'>('month')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '',
    event_type: 'llamada',
    start_at: '',
    end_at: '',
    notes: '',
  })

  const loadEvents = () => {
    const start = `${year}-${pad(month + 1)}-01`
    const endD = new Date(year, month + 1, 0)
    const end = fmtDate(endD)
    const agentId = getScopedAgentId()
    const agentParam = agentId ? `&agent_id=${agentId}` : ''
    apiFetch('crm', `/calendar?start=${start}&end=${end}${agentParam}`)
      .then(r => r.json() as Promise<any>)
      .then(d => { setEvents(Array.isArray(d) ? d : (d.events || [])); setLoading(false) })
      .catch(() => setLoading(false))
  }

  // Google va por separado: si falla o tarda, el calendario del CRM se ve igual.
  const loadGoogleEvents = () => {
    const start = new Date(year, month, 1).toISOString()
    const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
    apiFetch('crm', `/integrations/google/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)
      .then(r => r.json() as Promise<any>)
      .then(d => {
        setGoogleConnected(!!d?.connected)
        setGoogleReason(d?.reason ?? null)
        setGoogleEmail(d?.email ?? null)
        setGoogleEvents(
          Array.isArray(d?.events)
            ? d.events.map((e: any) => ({
                id: `google-${e.id}`,
                title: e.summary,
                start_at: googleToLocalNaive(e.start, e.all_day),
                end_at: googleToLocalNaive(e.end, e.all_day),
                notes: e.description ?? null,
                event_type: 'otro',
                completed: 0,
                all_day: e.all_day ? 1 : 0,
                html_link: e.html_link,
                __google: true,
              }))
            : [],
        )
      })
      .catch(() => { setGoogleConnected(false); setGoogleEvents([]); setGoogleReason('error_red') })
  }

  useEffect(() => { loadEvents(); loadGoogleEvents() }, [year, month])

  /** Conectado pero sin permiso de lectura: hay que volver a autorizar. */
  const googleSinPermisos = googleConnected && googleReason === 'insufficient_scopes'

  /** Lo que se muestra: los del CRM más los de Google, si el switch está activo. */
  const visibleEvents = useMemo(
    () => (showGoogle ? [...events, ...googleEvents] : events),
    [events, googleEvents, showGoogle],
  )

  const eventsByDay = useMemo(() => {
    const map: Record<string, any[]> = {}
    visibleEvents.forEach(ev => {
      const day = (ev.start_at || ev.created_at || '').split('T')[0]
      if (!map[day]) map[day] = []
      map[day].push(ev)
    })
    return map
  }, [visibleEvents])

  const handlePrev = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const handleNext = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const handleCreate = async () => {
    if (!form.title || !form.start_at) return
    setSaving(true)
    try {
      const res = await apiFetch('crm', '/calendar', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      const data = (await res.json()) as any
      if (data.id) {
        // Link para el cliente listo en el portapapeles (best-effort).
        const link = clientCalendarLink(form)
        let copied = false
        if (link) {
          try { await navigator.clipboard.writeText(link); copied = true } catch { /* sin permiso: queda el botón por evento */ }
        }
        toast(copied ? 'Evento creado · link para el cliente copiado' : 'Evento creado')
        setShowCreate(false)
        setForm({ title: '', event_type: 'llamada', start_at: '', end_at: '', notes: '' })
        loadEvents()
      } else {
        toast(data.error || 'Error al crear', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
    setSaving(false)
  }

  const completeEvent = async (id: string) => {
    await apiFetch('crm', '/calendar', {
      method: 'PUT',
      body: JSON.stringify({ id, completed: 1 }),
    })
    toast('Evento completado')
    loadEvents()
  }

  const deleteEvent = async (id: string) => {
    if (!confirm('¿Eliminar este evento?')) return
    await apiFetch('crm', `/calendar?id=${id}`, { method: 'DELETE' })
    toast('Evento eliminado', 'warning')
    loadEvents()
  }

  const copyClientLink = async (ev: any) => {
    const link = clientCalendarLink(ev)
    if (!link) { toast('El evento no tiene fecha de inicio', 'error'); return }
    try {
      await navigator.clipboard.writeText(link)
      toast('Link copiado — mandáselo al cliente para que lo agende')
    } catch {
      prompt('Copiá el link para el cliente:', link)
    }
  }

  // Build month grid
  const firstDay = firstDayOfWeek(year, month)
  const numDays = daysInMonth(year, month)
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: numDays }, (_, i) => i + 1)]
  // pad to complete weeks
  while (cells.length % 7 !== 0) cells.push(null)

  const todayStr = fmtDate(now)
  const selectedEvents = selectedDate ? (eventsByDay[selectedDate] || []) : []

  return (
    <div className="space-y-4">
      <PageHeader
        title="Calendario"
        subtitle={
          `${events.length} evento${events.length !== 1 ? 's' : ''} del CRM este mes` +
          (googleConnected && googleEmail && !googleSinPermisos
            // Se nombra la cuenta siempre, incluso con 0 eventos: si alguien
            // conectó la personal en vez de la de trabajo, ver el mail es la
            // única forma de darse cuenta de por qué el calendario está vacío.
            ? ` · ${showGoogle ? googleEvents.length : 0} de ${googleEmail}`
            : '')
        }
        actions={
          <>
            {googleConnected && (
              <Switch
                checked={showGoogle && !googleSinPermisos}
                onChange={setShowGoogle}
                disabled={googleSinPermisos}
                label={
                  googleSinPermisos
                    ? 'Google (sin permisos)'
                    : `${googleEmail ?? 'Google'} (${googleEvents.length})`
                }
              />
            )}
            <SegmentedControl
              options={[{ value: 'month', label: 'Mes' }, { value: 'agenda', label: 'Agenda' }]}
              value={view}
              onChange={v => setView(v as 'month' | 'agenda')}
            />
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>
              <span className="hidden sm:inline">Nuevo evento</span>
            </Button>
          </>
        }
      />

      {/* Conectó la cuenta pero el consentimiento no incluyó el permiso de
          calendario: el token existe y no sirve. Es accionable, así que se
          dice qué pasó y cómo arreglarlo. */}
      {googleSinPermisos && (
        <Alert tone="warning" title="Permisos insuficientes en Google Calendar">
          {googleEmail ? <strong>{googleEmail}</strong> : 'Tu cuenta'} está conectada, pero no autorizaste
          el acceso al calendario, así que no podemos mostrar tus eventos. Volvé a conectarla y dejá
          tildada la casilla de Google Calendar.
          <div className="mt-3">
            <Link
              href="/configuracion/conexiones"
              className="inline-flex items-center text-sm px-4 py-2 gap-2 rounded-control bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Ir a Integraciones
            </Link>
          </div>
        </Alert>
      )}

      {view === 'month' ? (
        <Card padded={false} className="overflow-hidden">
          {/* Nav */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <button onClick={handlePrev} aria-label="Mes anterior" className="p-2 hover:bg-gray-100 rounded-control"><ChevronLeft className="w-5 h-5" /></button>
            <Heading level={4} as="h2">{MONTH_NAMES[month]} {year}</Heading>
            <button onClick={handleNext} aria-label="Mes siguiente" className="p-2 hover:bg-gray-100 rounded-control"><ChevronRight className="w-5 h-5" /></button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b">
            {DAY_NAMES.map(d => (
              <div key={d} className="text-center py-2 text-xs font-medium text-gray-400">{d}</div>
            ))}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const dateStr = day ? `${year}-${pad(month + 1)}-${pad(day)}` : ''
              const dayEvents = dateStr ? (eventsByDay[dateStr] || []) : []
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDate
              return (
                <div
                  key={i}
                  onClick={() => day && setSelectedDate(isSelected ? null : dateStr)}
                  className={`min-h-[80px] p-1 border-b border-r border-gray-100 cursor-pointer transition-colors ${day ? 'hover:bg-gray-50' : 'bg-gray-50/50'} ${isSelected ? 'bg-blue-50' : ''}`}
                >
                  {day && (
                    <>
                      <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1 ${isToday ? 'bg-primary text-white' : 'text-gray-700'}`}>
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map(ev => {
                          const cfg = getET(ev.event_type)
                          // Los de Google van neutros: el color codifica el tipo
                          // de evento del CRM, y estos no tienen tipo.
                          const chip = ev.__google
                            ? 'bg-gray-100 text-gray-600 border border-dashed border-gray-300'
                            : `${cfg.bg} ${cfg.color}`
                          return (
                            <div key={ev.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${chip} ${ev.completed ? 'opacity-50' : ''}`}>
                              {ev.all_day ? '' : `${fmtTime(ev.start_at)} `}{ev.title}
                            </div>
                          )
                        })}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] text-gray-400 px-1">+{dayEvents.length - 3} más</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      ) : (
        // Agenda view
        <div className="space-y-3">
          {loading ? (
            <div className="animate-pulse space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-200 rounded-card" />)}
            </div>
          ) : visibleEvents.length === 0 ? (
            <EmptyState
              icon={<Calendar className="w-7 h-7" />}
              title="Sin eventos este mes"
              description="Creá un evento para organizar tu agenda."
              action={
                <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>
                  Nuevo evento
                </Button>
              }
            />
          ) : (
            visibleEvents
              .sort((a, b) => (a.start_at || '').localeCompare(b.start_at || ''))
              .map(ev => {
                const cfg = getET(ev.event_type)
                const Ico = ICON_MAP[cfg.icon] || Calendar
                const isOverdue = !ev.completed && ev.start_at && new Date(ev.start_at) < now
                return (
                  <Card key={ev.id} padded={false} className={`p-4 flex items-start gap-3 ${ev.completed ? 'opacity-60' : ''}`}>
                    <div className={`w-9 h-9 rounded-control flex items-center justify-center shrink-0 ${ev.__google ? 'bg-gray-100 text-gray-500' : `${cfg.bg} ${cfg.color}`}`}>
                      <Ico className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Text weight="medium" className={ev.completed ? 'line-through text-gray-400' : undefined}>{ev.title}</Text>
                        {ev.__google && <StatusBadge label="Google" color="bg-gray-100 text-gray-700" />}
                        {isOverdue && !ev.__google && <StatusBadge label="VENCIDO" color="bg-danger/10 text-danger" />}
                        {ev.completed === 1 && <CheckCircle2 className="w-4 h-4 text-success" />}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        <span>{ev.start_at ? new Date(ev.start_at).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }) : ''}</span>
                        {ev.start_at && <span>{fmtTime(ev.start_at)}</span>}
                        {ev.lead_name && <span>· {ev.lead_name}</span>}
                        {ev.agent_name && <span>· {ev.agent_name}</span>}
                      </div>
                      {ev.notes && <p className="text-xs text-gray-400 mt-1 truncate">{ev.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Los de Google son externos: se ven, no se tocan. Editarlos
                          o borrarlos desde acá borraría un evento personal del
                          agente, que no es lo que el CRM administra. */}
                      {ev.__google ? (
                        ev.html_link && (
                          <a href={ev.html_link} target="_blank" rel="noopener noreferrer"
                            title="Abrir en Google Calendar"
                            className="p-1.5 rounded-control hover:bg-gray-100 text-gray-400 hover:text-primary">
                            <Link2 className="w-3.5 h-3.5" />
                          </a>
                        )
                      ) : (
                        <>
                          {ev.lead_phone && (
                            <>
                              <CallButton phone={ev.lead_phone} iconOnly className="w-8 h-8" />
                              <WhatsAppButton
                                phone={ev.lead_phone} iconOnly className="w-8 h-8"
                                message={ev.start_at ? clientInviteMessage(ev) : undefined}
                              />
                            </>
                          )}
                          {ev.start_at && (
                            <button onClick={() => copyClientLink(ev)} title="Copiar link para que el cliente lo agende"
                              className="p-1.5 rounded-control hover:bg-gray-100 text-gray-400 hover:text-primary">
                              <Link2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!ev.completed && (
                            <button onClick={() => completeEvent(ev.id)} title="Marcar como completado"
                              className="p-1.5 rounded-control hover:bg-gray-100 text-gray-400 hover:text-success">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => deleteEvent(ev.id)} title="Eliminar evento"
                            className="p-1.5 rounded-control hover:bg-gray-100 text-gray-400 hover:text-danger">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </Card>
                )
              })
          )}
        </div>
      )}

      {/* Selected day events panel */}
      {selectedDate && selectedEvents.length > 0 && (
        <Card padded={false} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <CardTitle>
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </CardTitle>
            <button onClick={() => setSelectedDate(null)} aria-label="Cerrar" className="p-1 hover:bg-gray-100 rounded-control"><X className="w-4 h-4 text-gray-400" /></button>
          </div>
          <div className="space-y-2">
            {selectedEvents.map(ev => {
              const cfg = getET(ev.event_type)
              return (
                <div key={ev.id} className={`flex items-center gap-3 p-2 rounded-control ${cfg.bg}`}>
                  <ETIcon type={ev.event_type} className={`w-4 h-4 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${cfg.color} truncate`}>{ev.title}</p>
                    <p className="text-xs text-gray-400">{fmtTime(ev.start_at)}{ev.lead_name ? ` · ${ev.lead_name}` : ''}</p>
                  </div>
                  {ev.start_at && (
                    <button onClick={() => copyClientLink(ev)} title="Copiar link para que el cliente lo agende"
                      className="text-gray-400 hover:text-primary">
                      <Link2 className="w-4 h-4" />
                    </button>
                  )}
                  {ev.completed === 1 && <CheckCircle2 className="w-4 h-4 text-success" />}
                  {!ev.completed && (
                    <button onClick={() => completeEvent(ev.id)} title="Marcar como completado"
                      className="text-gray-400 hover:text-success">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal
          open
          sheet
          onClose={() => setShowCreate(false)}
          title="Nuevo evento"
          icon={<CalendarPlus className="w-5 h-5" />}
          footer={
            <>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={!form.title || !form.start_at} loading={saving}>Crear</Button>
            </>
          }
        >
            <div className="space-y-3">
              <Field label="Título" required>
                <Input placeholder="Título del evento" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </Field>
              <Field label="Tipo de evento">
                <Select value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}>
                  {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Inicio" required>
                  <Input type="datetime-local" value={form.start_at} onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))} />
                </Field>
                <Field label="Fin">
                  <Input type="datetime-local" value={form.end_at} onChange={e => setForm(f => ({ ...f, end_at: e.target.value }))} />
                </Field>
              </div>
              <Field label="Notas">
                <Textarea placeholder="Notas..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="min-h-0" />
              </Field>
            </div>
        </Modal>
      )}
    </div>
  )
}
