'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, X, ChevronLeft, ChevronRight, Calendar, Phone, Users, Home, Eye, ClipboardList, FileSignature, Loader2 } from 'lucide-react'

const EVENT_TYPES = [
  { key: 'llamada', label: 'Llamada', color: 'bg-blue-500', icon: Phone },
  { key: 'reunion', label: 'Reunion', color: 'bg-purple-500', icon: Users },
  { key: 'visita_captacion', label: 'Visita captacion', color: 'bg-orange-500', icon: Home },
  { key: 'visita_comprador', label: 'Visita comprador', color: 'bg-pink-500', icon: Eye },
  { key: 'tasacion', label: 'Tasacion', color: 'bg-yellow-500', icon: ClipboardList },
  { key: 'seguimiento', label: 'Seguimiento', color: 'bg-green-500', icon: Calendar },
  { key: 'firma', label: 'Firma', color: 'bg-red-500', icon: FileSignature },
  { key: 'otro', label: 'Otro', color: 'bg-gray-500', icon: Calendar },
] as const

function getEventType(key: string) {
  return EVENT_TYPES.find(e => e.key === key) || EVENT_TYPES[EVENT_TYPES.length - 1]
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  // 0=Sunday, we want Monday=0
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const DAY_NAMES = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']

export default function CalendarioPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [form, setForm] = useState({
    title: '', event_type: 'llamada', start_time: '', end_time: '', description: '',
  })

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    setLoading(true)
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endDate = new Date(year, month + 1, 0)
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}T23:59:59`
    fetch(`/api/calendar?start=${start}&end=${end}`)
      .then(r => r.json())
      .then(data => {
        const d = data as any
        setEvents(Array.isArray(d) ? d : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [year, month])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelectedDay(null)
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  function goToday() {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
    setSelectedDay(today.getDate())
  }

  const eventsForDay = useMemo(() => {
    const map: Record<number, any[]> = {}
    events.forEach((e: any) => {
      const d = new Date(e.start_time)
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate()
        if (!map[day]) map[day] = []
        map[day].push(e)
      }
    })
    return map
  }, [events, year, month])

  // Mobile: list of week's events
  const weekEvents = useMemo(() => {
    if (!isMobile) return []
    const start = new Date()
    const end = new Date()
    end.setDate(end.getDate() + 7)
    return events.filter((e: any) => {
      const d = new Date(e.start_time)
      return d >= start && d <= end
    }).sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  }, [events, isMobile])

  async function handleSave() {
    if (!form.title || !form.start_time) return
    setSaving(true)
    const res = await fetch('/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = (await res.json()) as any
    if (data.id) {
      setEvents(prev => [...prev, { ...form, id: data.id, created_at: new Date().toISOString() }])
      setForm({ title: '', event_type: 'llamada', start_time: '', end_time: '', description: '' })
      setShowForm(false)
    }
    setSaving(false)
  }

  async function handleDeleteEvent(id: string) {
    if (!confirm('¿Eliminar este evento?')) return
    await fetch(`/api/calendar?id=${id}`, { method: 'DELETE' })
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const selectedEvents = selectedDay ? (eventsForDay[selectedDay] || []) : []

  function EventItem({ e }: { e: any }) {
    const type = getEventType(e.event_type)
    const startTime = e.start_time ? new Date(e.start_time).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''
    return (
      <div className="flex items-start gap-3 p-3 bg-white rounded-lg shadow-sm">
        <div className={`w-2 h-2 mt-1.5 rounded-full ${type.color} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{e.title}</p>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
            <span>{type.label}</span>
            {startTime && <span>{startTime}</span>}
            {e.agent_name && <span className="hidden sm:inline">- {e.agent_name}</span>}
          </div>
          {e.description && <p className="text-xs text-gray-400 mt-1 truncate">{e.description}</p>}
        </div>
        <button onClick={() => handleDeleteEvent(e.id)} className="text-gray-300 hover:text-red-500 p-1 flex-shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-[#ff007c]" /> Calendario
          </h1>
          <p className="text-sm text-brand-gray mt-1">Eventos y actividades programadas</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 bg-[#ff007c] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Nuevo evento
        </button>
      </div>

      {/* Event form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Nuevo evento</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Titulo *</label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50" placeholder="Ej: Llamar al propietario" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Tipo</label>
                <select value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {EVENT_TYPES.map(t => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Inicio *</label>
                  <input type="datetime-local" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Fin</label>
                  <input type="datetime-local" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Descripcion</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50" />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.title || !form.start_time} className="bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-brand-gray"><Loader2 className="w-5 h-5 animate-spin" /> Cargando...</div>
      ) : isMobile ? (
        /* Mobile: week list view */
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Proximos 7 dias</h2>
            <button onClick={goToday} className="text-xs text-[#ff007c] font-medium">Hoy</button>
          </div>
          {weekEvents.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-brand-gray">Sin eventos esta semana</p>
            </div>
          ) : (
            <div className="space-y-2">
              {weekEvents.map((e: any) => {
                const d = new Date(e.start_time)
                return (
                  <div key={e.id}>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">
                      {d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' })}
                    </p>
                    <EventItem e={e} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        /* Desktop: month grid */
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h2 className="text-lg font-semibold text-gray-800 min-w-[180px] text-center">
                {MONTH_NAMES[month]} {year}
              </h2>
              <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <button onClick={goToday} className="text-sm text-[#ff007c] font-medium hover:underline">Hoy</button>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-gray-50" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
                const dayEvents = eventsForDay[day] || []
                const isSelected = selectedDay === day
                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                    className={`min-h-[80px] border-b border-r border-gray-50 p-1.5 cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? 'bg-[#ff007c]/5 ring-1 ring-[#ff007c]/30' : ''}`}
                  >
                    <span className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? 'bg-[#ff007c] text-white' : 'text-gray-700'}`}>
                      {day}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.slice(0, 3).map((e: any) => {
                        const type = getEventType(e.event_type)
                        return (
                          <div key={e.id} className={`${type.color} text-white text-[9px] px-1 py-0.5 rounded truncate`}>
                            {e.title}
                          </div>
                        )
                      })}
                      {dayEvents.length > 3 && (
                        <p className="text-[9px] text-gray-400 pl-1">+{dayEvents.length - 3} mas</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Selected day events panel */}
          {selectedDay && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                {selectedDay} de {MONTH_NAMES[month]} - {selectedEvents.length} evento{selectedEvents.length !== 1 ? 's' : ''}
              </h3>
              {selectedEvents.length === 0 ? (
                <p className="text-sm text-brand-gray">Sin eventos este dia</p>
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map((e: any) => (
                    <EventItem key={e.id} e={e} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
