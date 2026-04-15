'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Plus, X, ChevronLeft, ChevronRight, Calendar, Phone, Users, Home, Eye,
  ClipboardList, RefreshCw, FileText, FileSignature, CheckCircle2, Trash2,
  MessageCircle
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { EVENT_TYPES } from '@/lib/crm-config'
import { apiFetch } from '@/lib/api'

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

function getET(key: string) {
  return (EVENT_TYPES as any)[key] || EVENT_TYPES.otro
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
    apiFetch('crm', `/calendar?start=${start}&end=${end}`)
      .then(r => r.json() as Promise<any>)
      .then(d => { setEvents(Array.isArray(d) ? d : (d.events || [])); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadEvents() }, [year, month])

  const eventsByDay = useMemo(() => {
    const map: Record<string, any[]> = {}
    events.forEach(ev => {
      const day = (ev.start_at || ev.created_at || '').split('T')[0]
      if (!map[day]) map[day] = []
      map[day].push(ev)
    })
    return map
  }, [events])

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
        toast('Evento creado')
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Calendario</h1>
          <p className="text-sm text-gray-500">{events.length} evento{events.length !== 1 ? 's' : ''} este mes</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {(['month', 'agenda'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${view === v ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
                {v === 'month' ? 'Mes' : 'Agenda'}
              </button>
            ))}
          </div>
          <button onClick={() => setShowCreate(true)} className="bg-[#ff007c] text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 hover:opacity-90">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nuevo evento</span>
          </button>
        </div>
      </div>

      {view === 'month' ? (
        <div className="bg-white rounded-xl border overflow-hidden">
          {/* Nav */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <button onClick={handlePrev} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
            <h2 className="font-semibold text-gray-800">{MONTH_NAMES[month]} {year}</h2>
            <button onClick={handleNext} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight className="w-5 h-5" /></button>
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
                      <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1 ${isToday ? 'bg-[#ff007c] text-white' : 'text-gray-700'}`}>
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map(ev => {
                          const cfg = getET(ev.event_type)
                          return (
                            <div key={ev.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${cfg.bg} ${cfg.color} ${ev.completed ? 'opacity-50' : ''}`}>
                              {fmtTime(ev.start_at)} {ev.title}
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
        </div>
      ) : (
        // Agenda view
        <div className="space-y-3">
          {loading ? (
            <div className="animate-pulse space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-200 rounded-xl" />)}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Sin eventos este mes</p>
            </div>
          ) : (
            events
              .sort((a, b) => (a.start_at || '').localeCompare(b.start_at || ''))
              .map(ev => {
                const cfg = getET(ev.event_type)
                const Ico = ICON_MAP[cfg.icon] || Calendar
                const isOverdue = !ev.completed && ev.start_at && new Date(ev.start_at) < now
                return (
                  <div key={ev.id} className={`bg-white border rounded-xl p-4 flex items-start gap-3 ${isOverdue ? 'border-red-200 bg-red-50/30' : ''} ${ev.completed ? 'opacity-60' : ''}`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.color}`}>
                      <Ico className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-medium ${ev.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{ev.title}</p>
                        {isOverdue && <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-medium">VENCIDO</span>}
                        {ev.completed === 1 && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        <span>{ev.start_at ? new Date(ev.start_at).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }) : ''}</span>
                        {ev.start_at && <span>{fmtTime(ev.start_at)}</span>}
                        {ev.lead_name && <span>· {ev.lead_name}</span>}
                        {ev.agent_name && <span>· {ev.agent_name}</span>}
                      </div>
                      {ev.notes && <p className="text-xs text-gray-400 mt-1 truncate">{ev.notes}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {ev.lead_phone && (
                        <>
                          <a href={`tel:${ev.lead_phone}`} className="p-1.5 rounded hover:bg-blue-50 text-blue-500"><Phone className="w-3.5 h-3.5" /></a>
                          <a href={`https://wa.me/${ev.lead_phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-green-50 text-green-500"><MessageCircle className="w-3.5 h-3.5" /></a>
                        </>
                      )}
                      {!ev.completed && (
                        <button onClick={() => completeEvent(ev.id)} className="p-1.5 rounded hover:bg-green-50 text-gray-400 hover:text-green-500">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => deleteEvent(ev.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })
          )}
        </div>
      )}

      {/* Selected day events panel */}
      {selectedDate && selectedEvents.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 text-sm">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
            <button onClick={() => setSelectedDate(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4 text-gray-400" /></button>
          </div>
          <div className="space-y-2">
            {selectedEvents.map(ev => {
              const cfg = getET(ev.event_type)
              return (
                <div key={ev.id} className={`flex items-center gap-3 p-2 rounded-lg ${cfg.bg}`}>
                  <ETIcon type={ev.event_type} className={`w-4 h-4 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${cfg.color} truncate`}>{ev.title}</p>
                    <p className="text-xs text-gray-400">{fmtTime(ev.start_at)}{ev.lead_name ? ` · ${ev.lead_name}` : ''}</p>
                  </div>
                  {ev.completed === 1 && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  {!ev.completed && (
                    <button onClick={() => completeEvent(ev.id)} className="text-gray-400 hover:text-green-500">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Nuevo evento</h3>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <input placeholder="Título del evento *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm w-full" />
              <select value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm w-full">
                {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Inicio *</label>
                  <input type="datetime-local" value={form.start_at} onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))}
                    className="border rounded-lg px-3 py-2 text-sm w-full" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Fin</label>
                  <input type="datetime-local" value={form.end_at} onChange={e => setForm(f => ({ ...f, end_at: e.target.value }))}
                    className="border rounded-lg px-3 py-2 text-sm w-full" />
                </div>
              </div>
              <textarea placeholder="Notas..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} className="border rounded-lg px-3 py-2 text-sm w-full" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowCreate(false)} className="flex-1 border rounded-lg py-2 text-sm">Cancelar</button>
              <button onClick={handleCreate} disabled={!form.title || !form.start_at || saving}
                className="flex-1 bg-[#ff007c] text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
                {saving ? 'Guardando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
