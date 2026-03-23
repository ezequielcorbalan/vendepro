'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Plus, X, ChevronLeft, ChevronRight, Calendar, Phone, Users, Home, Eye,
  ClipboardList, RefreshCw, FileText, FileSignature, Loader2, Filter,
  CheckCircle, Search, Clock, Trash2, MessageCircle, Link2, CalendarDays,
} from 'lucide-react'

/* ──────────────────────────────────────────────────────────
   EVENT TYPE CONFIG
   ────────────────────────────────────────────────────────── */

const ICON_MAP: Record<string, any> = {
  Phone, Users, Home, Eye, ClipboardList, RefreshCw, FileText, FileSignature, Calendar,
}

const EVENT_TYPES: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  llamada:          { label: 'Llamada',          color: 'text-blue-700',    bg: 'bg-blue-100',    icon: 'Phone' },
  reunion:          { label: 'Reunión',          color: 'text-purple-700',  bg: 'bg-purple-100',  icon: 'Users' },
  visita_captacion: { label: 'Visita captación', color: 'text-green-700',   bg: 'bg-green-100',   icon: 'Home' },
  visita_comprador: { label: 'Visita comprador', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: 'Eye' },
  tasacion:         { label: 'Tasación',         color: 'text-orange-700',  bg: 'bg-orange-100',  icon: 'ClipboardList' },
  seguimiento:      { label: 'Seguimiento',      color: 'text-yellow-700',  bg: 'bg-yellow-100',  icon: 'RefreshCw' },
  admin:            { label: 'Administrativa',   color: 'text-gray-700',    bg: 'bg-gray-100',    icon: 'FileText' },
  firma:            { label: 'Firma',            color: 'text-pink-700',    bg: 'bg-pink-100',    icon: 'FileSignature' },
  otro:             { label: 'Otro',             color: 'text-slate-700',   bg: 'bg-slate-100',   icon: 'Calendar' },
}

function getET(key: string) {
  return EVENT_TYPES[key] || EVENT_TYPES.otro
}
function ETIcon({ type, className }: { type: string; className?: string }) {
  const cfg = getET(type)
  const Ico = ICON_MAP[cfg.icon] || Calendar
  return <Ico className={className || 'w-4 h-4'} />
}

/* ──────────────────────────────────────────────────────────
   DATE HELPERS
   ────────────────────────────────────────────────────────── */

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAY_NAMES_SHORT = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']

function pad(n: number) { return String(n).padStart(2, '0') }
function fmtDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }
function fmtDatetime(d: Date) { return `${fmtDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}` }
function isSameDay(a: Date, b: Date) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate() }
function daysInMonth(y: number, m: number) { return new Date(y, m+1, 0).getDate() }
function firstDayOfWeek(y: number, m: number) {
  const d = new Date(y, m, 1).getDay()
  return d === 0 ? 6 : d - 1
}
function startOfWeek(d: Date) {
  const r = new Date(d)
  const day = r.getDay()
  const diff = day === 0 ? 6 : day - 1
  r.setDate(r.getDate() - diff)
  r.setHours(0,0,0,0)
  return r
}
function fmtTime(s: string | null) {
  if (!s) return ''
  const d = new Date(s)
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
}
function fmtShortDate(d: Date) {
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
}

type ViewType = 'month' | 'week' | 'day' | 'agenda'
type StatusFilter = 'all' | 'pending' | 'completed' | 'overdue'

/* ──────────────────────────────────────────────────────────
   MAIN COMPONENT
   ────────────────────────────────────────────────────────── */

export default function CalendarioPage() {
  const today = useRef(new Date())
  const now = today.current

  // ----- View state -----
  const [isMobile, setIsMobile] = useState(false)
  const [view, setView] = useState<ViewType>('week')
  const [currentDate, setCurrentDate] = useState(now) // anchor date for navigation
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // ----- Data -----
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // ----- Filters -----
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all')
  const [filterMine, setFilterMine] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false) // mobile drawer

  // ----- Modal / expanded event -----
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')

  const [form, setForm] = useState({
    title: '', event_type: 'llamada', start_at: '', end_at: '', all_day: false,
    description: '', lead_id: '', contact_id: '', property_id: '',
  })

  // ----- Responsive detection -----
  useEffect(() => {
    const check = () => {
      const m = window.innerWidth < 640
      setIsMobile(m)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Set default view on first render based on screen size
  const initialViewSet = useRef(false)
  useEffect(() => {
    if (!initialViewSet.current) {
      setView(isMobile ? 'agenda' : 'week')
      initialViewSet.current = true
    }
  }, [isMobile])

  // ----- Compute fetch range based on view & currentDate -----
  const fetchRange = useMemo(() => {
    const d = currentDate
    if (view === 'month') {
      const s = new Date(d.getFullYear(), d.getMonth(), 1)
      const e = new Date(d.getFullYear(), d.getMonth()+1, 0, 23, 59, 59)
      // include surrounding days
      s.setDate(s.getDate() - 7)
      e.setDate(e.getDate() + 7)
      return { start: fmtDate(s), end: fmtDate(e) }
    }
    if (view === 'week') {
      const s = startOfWeek(d)
      const e = new Date(s)
      e.setDate(e.getDate() + 6)
      return { start: fmtDate(s), end: fmtDate(e) }
    }
    if (view === 'day') {
      return { start: fmtDate(d), end: fmtDate(d) }
    }
    // agenda: next 30 days
    const s = new Date(d)
    const e = new Date(d)
    e.setDate(e.getDate() + 30)
    return { start: fmtDate(s), end: fmtDate(e) }
  }, [view, currentDate])

  // ----- Fetch events -----
  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('start', fetchRange.start)
      params.set('end', fetchRange.end)
      if (filterType) params.set('type', filterType)
      if (filterStatus === 'pending') params.set('status', 'pending')
      if (filterStatus === 'completed') params.set('status', 'completed')
      if (filterStatus === 'overdue') params.set('overdue', '1')
      if (filterMine) params.set('mine', '1')
      const res = await fetch(`/api/calendar?${params.toString()}`)
      const data = (await res.json()) as any
      setEvents(Array.isArray(data) ? data : [])
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [fetchRange, filterType, filterStatus, filterMine])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  // ----- Client-side search filter -----
  const filteredEvents = useMemo(() => {
    if (!searchText.trim()) return events
    const q = searchText.toLowerCase()
    return events.filter((e: any) =>
      (e.title || '').toLowerCase().includes(q) ||
      (e.description || '').toLowerCase().includes(q) ||
      (e.lead_name || '').toLowerCase().includes(q) ||
      (e.contact_name || '').toLowerCase().includes(q)
    )
  }, [events, searchText])

  // ----- Navigation helpers -----
  function navigate(dir: -1 | 1) {
    setCurrentDate(prev => {
      const d = new Date(prev)
      if (view === 'month') d.setMonth(d.getMonth() + dir)
      else if (view === 'week') d.setDate(d.getDate() + 7 * dir)
      else if (view === 'day') d.setDate(d.getDate() + dir)
      else d.setDate(d.getDate() + 30 * dir) // agenda
      return d
    })
    setExpandedEventId(null)
  }
  function goToday() {
    setCurrentDate(new Date())
    setSelectedDate(new Date())
    setExpandedEventId(null)
  }
  function goToDay(d: Date) {
    setCurrentDate(d)
    setSelectedDate(d)
    setView('day')
  }

  // ----- Navigation title -----
  const navTitle = useMemo(() => {
    const d = currentDate
    if (view === 'month') return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
    if (view === 'week') {
      const s = startOfWeek(d)
      const e = new Date(s); e.setDate(e.getDate()+6)
      if (s.getMonth() === e.getMonth()) return `${s.getDate()} – ${e.getDate()} ${MONTH_NAMES[s.getMonth()]} ${s.getFullYear()}`
      return `${s.getDate()} ${MONTH_NAMES[s.getMonth()].slice(0,3)} – ${e.getDate()} ${MONTH_NAMES[e.getMonth()].slice(0,3)} ${s.getFullYear()}`
    }
    if (view === 'day') return fmtShortDate(d)
    return `Agenda — próximos 30 días`
  }, [view, currentDate])

  // ----- CRUD -----
  async function handleCreate() {
    if (!form.title || (!form.all_day && !form.start_at)) return
    setSaving(true)
    try {
      const body: any = {
        title: form.title,
        event_type: form.event_type,
        start_at: form.all_day ? fmtDate(new Date(form.start_at || Date.now())) : form.start_at,
        end_at: form.end_at || form.start_at || null,
        all_day: form.all_day,
        description: form.description || null,
        lead_id: form.lead_id || null,
        contact_id: form.contact_id || null,
        property_id: form.property_id || null,
      }
      const res = await fetch('/api/calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = (await res.json()) as any
      if (data.id) {
        setShowCreateModal(false)
        resetForm()
        await fetchEvents()
      }
    } finally { setSaving(false) }
  }

  async function handleToggleComplete(id: string) {
    // Optimistic
    setEvents(prev => prev.map(e => e.id === id ? { ...e, completed: e.completed ? 0 : 1 } : e))
    try {
      await fetch('/api/calendar', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, _action: 'toggle_complete' }) })
    } catch { fetchEvents() }
  }

  async function handleReschedule(id: string) {
    if (!rescheduleDate) return
    try {
      await fetch('/api/calendar', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, _action: 'reschedule', start_at: rescheduleDate, end_at: rescheduleDate }) })
      setRescheduleId(null)
      setRescheduleDate('')
      await fetchEvents()
    } catch { /* */ }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este evento?')) return
    setEvents(prev => prev.filter(e => e.id !== id))
    try {
      await fetch(`/api/calendar?id=${id}`, { method: 'DELETE' })
    } catch { fetchEvents() }
  }

  function resetForm() {
    setForm({ title: '', event_type: 'llamada', start_at: '', end_at: '', all_day: false, description: '', lead_id: '', contact_id: '', property_id: '' })
  }

  // ----- Events grouped by date (for agenda / day) -----
  const eventsByDate = useMemo(() => {
    const map: Record<string, any[]> = {}
    filteredEvents.forEach((e: any) => {
      const key = (e.start_at || '').slice(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(e)
    })
    return map
  }, [filteredEvents])

  // ----- Events for specific day (month view chips) -----
  function eventsOnDay(d: Date) {
    const key = fmtDate(d)
    return eventsByDate[key] || []
  }

  /* ──────────────────────────────────────────────────────────
     EVENT CARD (shared between Day / Agenda)
     ────────────────────────────────────────────────────────── */
  function EventCard({ e }: { e: any }) {
    const cfg = getET(e.event_type)
    const isCompleted = !!e.completed
    const isOverdue = !!e.overdue && !isCompleted
    const expanded = expandedEventId === e.id

    return (
      <div
        className={`rounded-lg border bg-white transition-all ${
          isOverdue ? 'border-l-4 border-l-red-500 bg-amber-50/40' :
          isCompleted ? 'opacity-60 border-gray-200' :
          'border-gray-200'
        } ${expanded ? 'ring-2 ring-[#ff007c]/30' : ''}`}
      >
        <div
          className="flex items-start gap-3 p-3 cursor-pointer"
          onClick={() => setExpandedEventId(expanded ? null : e.id)}
        >
          {/* Type badge */}
          <div className={`flex-shrink-0 p-1.5 rounded-md ${cfg.bg}`}>
            <ETIcon type={e.event_type} className={`w-4 h-4 ${cfg.color}`} />
          </div>

          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium text-gray-800 ${isCompleted ? 'line-through' : ''}`}>
              {isCompleted && <CheckCircle className="w-3.5 h-3.5 text-green-500 inline mr-1 -mt-0.5" />}
              {e.title}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
              {e.start_at && <span className="text-xs text-gray-500"><Clock className="w-3 h-3 inline mr-0.5 -mt-0.5" />{fmtTime(e.start_at)}{e.end_at && e.end_at !== e.start_at ? ` – ${fmtTime(e.end_at)}` : ''}</span>}
              {e.all_day ? <span className="text-xs text-gray-400">Todo el día</span> : null}
            </div>

            {/* Linked entities */}
            <div className="flex flex-wrap gap-2 mt-1">
              {e.lead_name && (
                <a href={`/leads/${e.lead_id}`} className="text-xs text-blue-600 hover:underline" onClick={ev => ev.stopPropagation()}>
                  👤 {e.lead_name}
                </a>
              )}
              {e.contact_name && (
                <span className="text-xs text-gray-500">📇 {e.contact_name}</span>
              )}
              {e.property_address && (
                <a href={`/propiedades/${e.property_id}`} className="text-xs text-blue-600 hover:underline" onClick={ev => ev.stopPropagation()}>
                  🏠 {e.property_address}
                </a>
              )}
            </div>

            {e.agent_name && <p className="text-xs text-gray-400 mt-0.5">Agente: {e.agent_name}</p>}
          </div>

          {isOverdue && <span className="text-[10px] font-semibold text-red-600 bg-red-100 px-1.5 py-0.5 rounded flex-shrink-0">VENCIDO</span>}
        </div>

        {/* Expanded actions */}
        {expanded && (
          <div className="border-t border-gray-100 px-3 py-2 space-y-2">
            {e.description && <p className="text-xs text-gray-600">{e.description}</p>}

            {/* Reschedule inline */}
            {rescheduleId === e.id && (
              <div className="flex items-center gap-2">
                <input type="datetime-local" value={rescheduleDate} onChange={ev => setRescheduleDate(ev.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs flex-1" />
                <button onClick={() => handleReschedule(e.id)} className="text-xs bg-[#ff007c] text-white px-2 py-1 rounded hover:opacity-90">OK</button>
                <button onClick={() => { setRescheduleId(null); setRescheduleDate('') }} className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => handleToggleComplete(e.id)} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border transition-colors ${isCompleted ? 'bg-green-50 border-green-200 text-green-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <CheckCircle className="w-3.5 h-3.5" /> {isCompleted ? 'Desmarcar' : 'Completar'}
              </button>

              {e.phone ? (
                <>
                  <a href={`tel:${e.phone}`} className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">
                    <Phone className="w-3.5 h-3.5" /> Llamar
                  </a>
                  <a href={`https://wa.me/${e.phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-green-200 text-green-700 hover:bg-green-50">
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-gray-100 text-gray-300 cursor-not-allowed">
                    <Phone className="w-3.5 h-3.5" /> Llamar
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-gray-100 text-gray-300 cursor-not-allowed">
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </span>
                </>
              )}

              <button onClick={() => { setRescheduleId(e.id); setRescheduleDate(e.start_at ? fmtDatetime(new Date(e.start_at)) : '') }} className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">
                <CalendarDays className="w-3.5 h-3.5" /> Reprogramar
              </button>

              <button onClick={() => handleDelete(e.id)} className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" /> Eliminar
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ──────────────────────────────────────────────────────────
     FILTER BAR / DRAWER
     ────────────────────────────────────────────────────────── */
  function FiltersContent() {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text" value={searchText} onChange={ev => setSearchText(ev.target.value)}
            placeholder="Buscar eventos..."
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff007c]/40"
          />
        </div>

        {/* Type */}
        <select value={filterType} onChange={ev => setFilterType(ev.target.value)} className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm bg-white">
          <option value="">Todos los tipos</option>
          {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        {/* Status */}
        <select value={filterStatus} onChange={ev => setFilterStatus(ev.target.value as StatusFilter)} className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm bg-white">
          <option value="all">Todos</option>
          <option value="pending">Pendientes</option>
          <option value="completed">Completados</option>
          <option value="overdue">Vencidos</option>
        </select>

        {/* Mine toggle */}
        <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={filterMine} onChange={ev => setFilterMine(ev.target.checked)} className="accent-[#ff007c] w-4 h-4" />
          Solo mis eventos
        </label>
      </div>
    )
  }

  /* ──────────────────────────────────────────────────────────
     MONTH VIEW
     ────────────────────────────────────────────────────────── */
  function MonthView() {
    const y = currentDate.getFullYear()
    const m = currentDate.getMonth()
    const dim = daysInMonth(y, m)
    const fd = firstDayOfWeek(y, m)

    return (
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100">
          {DAY_NAMES_SHORT.map(d => <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: fd }).map((_, i) => <div key={`e-${i}`} className="min-h-[90px] border-b border-r border-gray-50" />)}
          {Array.from({ length: dim }).map((_, i) => {
            const day = i + 1
            const date = new Date(y, m, day)
            const isToday = isSameDay(date, now)
            const dayEvts = eventsOnDay(date)
            return (
              <div
                key={day}
                onClick={() => goToDay(date)}
                className={`min-h-[90px] border-b border-r border-gray-50 p-1.5 cursor-pointer hover:bg-gray-50 transition-colors`}
              >
                <span className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? 'bg-[#ff007c] text-white' : 'text-gray-700'}`}>{day}</span>
                <div className="mt-1 space-y-0.5">
                  {dayEvts.slice(0, 3).map((e: any) => {
                    const cfg = getET(e.event_type)
                    return <div key={e.id} className={`${cfg.bg} ${cfg.color} text-[10px] font-medium px-1 py-0.5 rounded truncate`}>{e.title}</div>
                  })}
                  {dayEvts.length > 3 && <p className="text-[10px] text-gray-400 pl-1">+{dayEvts.length - 3} más</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  /* ──────────────────────────────────────────────────────────
     WEEK VIEW
     ────────────────────────────────────────────────────────── */
  function WeekView() {
    const weekStart = startOfWeek(currentDate)
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate()+i); return d })
    const hours = Array.from({ length: 13 }, (_, i) => i + 8) // 08-20

    return (
      <div className="bg-white rounded-xl shadow-sm overflow-auto">
        {/* Header */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="border-r border-gray-100" />
          {days.map((d, i) => {
            const isToday = isSameDay(d, now)
            return (
              <div key={i} className={`text-center py-2 border-r border-gray-100 cursor-pointer hover:bg-gray-50 ${isToday ? 'bg-[#ff007c]/5' : ''}`} onClick={() => goToDay(d)}>
                <p className="text-[10px] font-semibold text-gray-400 uppercase">{DAY_NAMES_SHORT[i]}</p>
                <p className={`text-sm font-bold ${isToday ? 'text-[#ff007c]' : 'text-gray-700'}`}>{d.getDate()}</p>
              </div>
            )
          })}
        </div>

        {/* Time grid */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)]" style={{ minHeight: 13 * 60 }}>
          {/* Time labels */}
          <div className="border-r border-gray-100">
            {hours.map(h => (
              <div key={h} className="h-[60px] flex items-start justify-end pr-2 pt-0.5">
                <span className="text-[10px] text-gray-400">{pad(h)}:00</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((d, di) => {
            const dayEvts = eventsOnDay(d)
            return (
              <div key={di} className="relative border-r border-gray-100">
                {/* Hour lines */}
                {hours.map(h => <div key={h} className="h-[60px] border-b border-gray-50" />)}
                {/* Events */}
                {dayEvts.map((e: any) => {
                  const cfg = getET(e.event_type)
                  const start = new Date(e.start_at)
                  const end = e.end_at ? new Date(e.end_at) : new Date(start.getTime() + 60*60000)
                  const startMin = start.getHours() * 60 + start.getMinutes()
                  const endMin = end.getHours() * 60 + end.getMinutes()
                  const top = Math.max(0, (startMin - 8 * 60))
                  const height = Math.max(20, endMin - startMin)
                  const isCompleted = !!e.completed
                  return (
                    <div
                      key={e.id}
                      onClick={() => setExpandedEventId(expandedEventId === e.id ? null : e.id)}
                      className={`absolute left-0.5 right-0.5 rounded px-1 py-0.5 cursor-pointer overflow-hidden border-l-2 ${cfg.bg} ${isCompleted ? 'opacity-50' : ''}`}
                      style={{ top: `${top}px`, height: `${height}px`, borderColor: cfg.color.replace('text-', '').includes('blue') ? '#1d4ed8' : cfg.color.replace('text-', '').includes('purple') ? '#7e22ce' : cfg.color.replace('text-', '').includes('green') ? '#15803d' : cfg.color.replace('text-', '').includes('orange') ? '#c2410c' : cfg.color.replace('text-', '').includes('pink') ? '#be185d' : cfg.color.replace('text-', '').includes('yellow') ? '#a16207' : cfg.color.replace('text-', '').includes('emerald') ? '#047857' : '#475569' }}
                      title={`${e.title} (${fmtTime(e.start_at)} – ${fmtTime(e.end_at)})`}
                    >
                      <p className={`text-[10px] font-semibold ${cfg.color} truncate ${isCompleted ? 'line-through' : ''}`}>{e.title}</p>
                      <p className="text-[9px] text-gray-500">{fmtTime(e.start_at)}</p>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  /* ──────────────────────────────────────────────────────────
     DAY VIEW
     ────────────────────────────────────────────────────────── */
  function DayView() {
    const dayEvts = eventsOnDay(currentDate)
    return (
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 capitalize">{fmtShortDate(currentDate)}</h3>
        {dayEvts.length === 0 ? (
          <EmptyState text="No hay eventos para este día" />
        ) : (
          <div className="space-y-2">
            {dayEvts.sort((a: any, b: any) => (a.start_at || '').localeCompare(b.start_at || '')).map((e: any) => <EventCard key={e.id} e={e} />)}
          </div>
        )}
      </div>
    )
  }

  /* ──────────────────────────────────────────────────────────
     AGENDA VIEW
     ────────────────────────────────────────────────────────── */
  function AgendaView() {
    const sortedDates = Object.keys(eventsByDate).sort()
    const nonEmpty = sortedDates.filter(k => (eventsByDate[k] || []).length > 0)

    if (nonEmpty.length === 0) return <EmptyState text="No hay eventos en los próximos 30 días" />

    return (
      <div className="space-y-4">
        {nonEmpty.map(dateKey => {
          const d = new Date(dateKey + 'T12:00:00')
          const evts = eventsByDate[dateKey]
          return (
            <div key={dateKey}>
              <p className="text-xs font-bold text-gray-400 uppercase mb-1.5 sticky top-0 bg-gray-50/80 backdrop-blur-sm py-1 px-1 -mx-1 rounded capitalize">
                {isSameDay(d, now) ? 'Hoy' : fmtShortDate(d)}
              </p>
              <div className="space-y-2">
                {evts.sort((a: any, b: any) => (a.start_at || '').localeCompare(b.start_at || '')).map((e: any) => <EventCard key={e.id} e={e} />)}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  /* ──────────────────────────────────────────────────────────
     EMPTY STATE
     ────────────────────────────────────────────────────────── */
  function EmptyState({ text }: { text: string }) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-10 text-center">
        <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-3" />
        <p className="text-sm text-gray-400">{text}</p>
      </div>
    )
  }

  /* ──────────────────────────────────────────────────────────
     RENDER
     ────────────────────────────────────────────────────────── */
  const viewOptions: { key: ViewType; label: string }[] = [
    { key: 'month', label: 'Mes' },
    { key: 'week', label: 'Semana' },
    { key: 'day', label: 'Día' },
    { key: 'agenda', label: 'Agenda' },
  ]

  return (
    <div>
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-[#ff007c]" /> Calendario
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Eventos y actividades programadas</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Google Calendar placeholder */}
          <button className="hidden sm:inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-500 hover:border-gray-300 transition-colors" title="Integración con Google Calendar — Próximamente">
            <Link2 className="w-3.5 h-3.5" /> <span>Google Calendar</span> <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded-full">Pronto</span>
          </button>
          <button onClick={() => { resetForm(); setShowCreateModal(true) }} className="inline-flex items-center gap-1.5 bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Nuevo evento
          </button>
        </div>
      </div>

      {/* ── VIEW SELECTOR + NAV + FILTERS ── */}
      <div className="mb-4 space-y-3">
        {/* Top row: view pills + nav + filter icon (mobile) */}
        <div className="flex items-center justify-between gap-2">
          {/* View selector pills */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {viewOptions.map(v => (
              <button key={v.key} onClick={() => { setView(v.key); setExpandedEventId(null) }} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === v.key ? 'bg-white text-[#ff007c] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {v.label}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
            <button onClick={goToday} className="text-xs font-medium text-[#ff007c] hover:underline px-2 hidden sm:block">Hoy</button>
            <button onClick={() => navigate(1)} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronRight className="w-5 h-5 text-gray-600" /></button>

            {/* Mobile filter icon */}
            <button onClick={() => setFiltersOpen(true)} className="sm:hidden p-1.5 hover:bg-gray-100 rounded-lg ml-1">
              <Filter className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Nav title */}
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 capitalize">{navTitle}</h2>
          <button onClick={goToday} className="sm:hidden text-xs font-medium text-[#ff007c]">Hoy</button>
        </div>

        {/* Desktop filters */}
        <div className="hidden sm:block">
          <FiltersContent />
        </div>
      </div>

      {/* ── MOBILE FILTER DRAWER ── */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 sm:hidden" onClick={() => setFiltersOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute right-0 top-0 bottom-0 w-[85%] max-w-xs bg-white shadow-xl p-4 space-y-4 overflow-y-auto" onClick={ev => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800">Filtros</h3>
              <button onClick={() => setFiltersOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <FiltersContent />
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 text-gray-400 py-16">
          <Loader2 className="w-5 h-5 animate-spin" /> Cargando eventos...
        </div>
      ) : (
        <>
          {filteredEvents.length === 0 && events.length > 0 && searchText ? (
            <EmptyState text="No se encontraron eventos con estos filtros" />
          ) : (
            <>
              {view === 'month' && <MonthView />}
              {view === 'week' && <WeekView />}
              {view === 'day' && <DayView />}
              {view === 'agenda' && <AgendaView />}
            </>
          )}

          {/* Week view expanded event overlay */}
          {view === 'week' && expandedEventId && (() => {
            const ev = filteredEvents.find((e: any) => e.id === expandedEventId)
            if (!ev) return null
            return (
              <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" onClick={() => setExpandedEventId(null)}>
                <div className="absolute inset-0 bg-black/30" />
                <div className="relative bg-white rounded-t-xl sm:rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto m-0 sm:m-4" onClick={ev => ev.stopPropagation()}>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-800">Detalle del evento</h3>
                      <button onClick={() => setExpandedEventId(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
                    </div>
                    <EventCard e={ev} />
                  </div>
                </div>
              </div>
            )
          })()}
        </>
      )}

      {/* ── CREATE EVENT MODAL ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto" onClick={ev => ev.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-gray-800">Nuevo evento</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>

            {/* Form */}
            <div className="p-4 space-y-3">
              {/* Title */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Título *</label>
                <input type="text" value={form.title} onChange={ev => setForm(f => ({ ...f, title: ev.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50" placeholder="Ej: Llamar al propietario" />
              </div>

              {/* Type */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Tipo</label>
                <select value={form.event_type} onChange={ev => setForm(f => ({ ...f, event_type: ev.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>

              {/* All day toggle */}
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.all_day} onChange={ev => setForm(f => ({ ...f, all_day: ev.target.checked }))} className="accent-[#ff007c] w-4 h-4" />
                Todo el día
              </label>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{form.all_day ? 'Fecha *' : 'Inicio *'}</label>
                  <input type={form.all_day ? 'date' : 'datetime-local'} value={form.start_at} onChange={ev => setForm(f => ({ ...f, start_at: ev.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50" />
                </div>
                {!form.all_day && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Fin</label>
                    <input type="datetime-local" value={form.end_at} onChange={ev => setForm(f => ({ ...f, end_at: ev.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50" />
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Descripción</label>
                <textarea value={form.description} onChange={ev => setForm(f => ({ ...f, description: ev.target.value }))} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50" />
              </div>

              {/* Link IDs */}
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">Vinculación (opcional)</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-medium text-gray-400 mb-0.5 block">Lead ID</label>
                    <input type="text" value={form.lead_id} onChange={ev => setForm(f => ({ ...f, lead_id: ev.target.value }))} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs" placeholder="lead_xxx" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-gray-400 mb-0.5 block">Contact ID</label>
                    <input type="text" value={form.contact_id} onChange={ev => setForm(f => ({ ...f, contact_id: ev.target.value }))} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs" placeholder="contact_xxx" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-gray-400 mb-0.5 block">Property ID</label>
                    <input type="text" value={form.property_id} onChange={ev => setForm(f => ({ ...f, property_id: ev.target.value }))} className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs" placeholder="prop_xxx" />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 p-4 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={() => setShowCreateModal(false)} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={handleCreate} disabled={saving || !form.title || (!form.all_day && !form.start_at)} className="bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
