'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Search, Trash2, Loader2, BookUser, Phone, Mail, MapPin, X, ChevronRight, ChevronLeft, SlidersHorizontal } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { applyScopeToParams, isAdminOrSupervisor } from '@/lib/agent-scope'
import { useToast } from '@/components/ui/Toast'

const inputClass = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/50 w-full'

const typeLabels: Record<string, { label: string; color: string }> = {
  vendedor: { label: 'Vendedor', color: 'bg-blue-100 text-blue-700' },
  comprador: { label: 'Comprador', color: 'bg-green-100 text-green-700' },
  inversor: { label: 'Inversor', color: 'bg-purple-100 text-purple-700' },
  inquilino: { label: 'Inquilino', color: 'bg-orange-100 text-orange-700' },
  otro: { label: 'Otro', color: 'bg-gray-100 text-gray-700' },
}

const TABS = [
  { key: '', label: 'Todos' },
  { key: 'vendedor', label: 'Vendedores' },
  { key: 'comprador', label: 'Compradores' },
  { key: 'inversor', label: 'Inversores' },
  { key: 'inquilino', label: 'Inquilinos' },
  { key: 'otro', label: 'Otros' },
]

const sourceLabels: Record<string, string> = {
  manual: 'Manual',
  zonaprop: 'Zonaprop',
  argenprop: 'Argenprop',
  mercadolibre: 'Mercadolibre',
  web: 'Web',
  whatsapp: 'WhatsApp',
  referido: 'Referido',
  api: 'API',
}

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-pink-500', 'bg-amber-500', 'bg-emerald-500',
  'bg-sky-500', 'bg-violet-500', 'bg-rose-500', 'bg-teal-500',
]

const SHORT_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function formatShortDate(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '—'
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function Avatar({ name }: { name: string }) {
  const initials = (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
  const color = AVATAR_COLORS[(name || '').split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVATAR_COLORS.length]
  return (
    <div className={`w-10 h-10 rounded-full ${color} text-white flex items-center justify-center text-sm font-semibold flex-shrink-0 shadow-sm ring-2 ring-white`}>
      {initials}
    </div>
  )
}

function TagChips({ tags, max = 3 }: { tags?: Array<{ id: string; name: string; color: string | null }>; max?: number }) {
  if (!tags || tags.length === 0) return null
  const shown = tags.slice(0, max)
  const extra = tags.length - shown.length
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map(t => (
        <span
          key={t.id}
          className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border"
          style={{
            color: t.color || '#6b7280',
            borderColor: `${t.color || '#9ca3af'}55`,
            backgroundColor: `${t.color || '#9ca3af'}14`,
          }}
        >
          {t.name}
        </span>
      ))}
      {extra > 0 && <span className="text-[10px] text-gray-400">+{extra}</span>}
    </div>
  )
}

function SourceBadge({ source }: { source?: string | null }) {
  if (!source) return <span className="text-xs text-gray-300">—</span>
  const label = sourceLabels[source.toLowerCase()] || source.charAt(0).toUpperCase() + source.slice(1)
  return (
    <span className="inline-block text-xs text-gray-600 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-md">
      {label}
    </span>
  )
}

export default function ContactosPage() {
  const { toast } = useToast()
  const [contacts, setContacts] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterAgent, setFilterAgent] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [tags, setTags] = useState<any[]>([])
  const [sortBy, setSortBy] = useState('recent')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const isAdmin = isAdminOrSupervisor()
  const [form, setForm] = useState({
    full_name: '', phone: '', email: '', contact_type: 'vendedor', neighborhood: '', notes: '', source: 'manual',
  })

  function loadContacts() {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterAgent) params.set('agent_id', filterAgent)
    if (filterTag) params.set('tag_id', filterTag)
    applyScopeToParams(params)
    apiFetch('crm', `/contacts?${params}`).then(r => r.json() as Promise<any>).then(data => {
      setContacts(Array.isArray(data) ? data : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { loadContacts() }, [search, filterAgent, filterTag])

  useEffect(() => {
    apiFetch('crm', '/tags').then(r => r.json() as Promise<any>).then(d => {
      if (Array.isArray(d)) setTags(d)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    apiFetch('admin', '/agents').then(r => r.json() as Promise<any>).then(d => {
      if (Array.isArray(d)) setAgents(d)
    }).catch(() => {})
  }, [isAdmin])

  const agentNames = useMemo(() => {
    const map: Record<string, string> = {}
    agents.forEach(a => { map[a.id] = a.full_name })
    return map
  }, [agents])

  // Opciones dinámicas según los datos cargados
  const sourceOptions = useMemo(() => {
    const set = new Set<string>()
    contacts.forEach(c => { if (c.source) set.add(c.source.toLowerCase()) })
    return [...set].sort()
  }, [contacts])

  // Contactos tras aplicar el filtro de origen (las tabs cuentan sobre esto)
  const filtered = useMemo(() => {
    return contacts.filter(c => {
      if (filterSource && (c.source || '').toLowerCase() !== filterSource) return false
      return true
    })
  }, [contacts, filterSource])

  const counts = useMemo(() => {
    const c: Record<string, number> = { '': filtered.length }
    filtered.forEach(ct => {
      const t = typeLabels[ct.contact_type] ? ct.contact_type : 'otro'
      c[t] = (c[t] || 0) + 1
    })
    return c
  }, [filtered])

  const visible = useMemo(() => {
    const list = filterType
      ? filtered.filter(c => (typeLabels[c.contact_type] ? c.contact_type : 'otro') === filterType)
      : [...filtered]
    if (sortBy === 'recent') {
      list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    } else if (sortBy === 'oldest') {
      list.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
    } else {
      list.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
    }
    return list
  }, [filtered, filterType, sortBy])

  // Paginación (client-side sobre la lista ya filtrada y ordenada)
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = useMemo(
    () => visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [visible, currentPage],
  )

  // Volver a la primera página cuando cambian filtros, orden o resultados
  useEffect(() => { setPage(1) }, [search, filterType, filterAgent, filterSource, filterTag, sortBy])

  const activeFilterCount = [filterAgent, filterSource, filterTag].filter(Boolean).length

  function clearFilters() {
    setFilterAgent('')
    setFilterSource('')
    setFilterTag('')
  }

  async function handleSave() {
    if (!form.full_name) return
    setSaving(true)
    const res = await apiFetch('crm', '/contacts', {
      method: 'POST',
      body: JSON.stringify(form),
    })
    const data = (await res.json()) as any
    if (data.id) {
      setContacts(prev => [{ ...form, id: data.id, created_at: new Date().toISOString() }, ...prev])
      setForm({ full_name: '', phone: '', email: '', contact_type: 'vendedor', neighborhood: '', notes: '', source: 'manual' })
      setShowForm(false)
      toast('Contacto guardado')
    } else {
      toast(data.error || 'Error al guardar', 'error')
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este contacto?')) return
    await apiFetch('crm', `/contacts?id=${id}`, { method: 'DELETE' })
    setContacts(prev => prev.filter(c => c.id !== id))
    toast('Contacto eliminado', 'warning')
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Contactos</h1>
          <p className="text-sm text-gray-500 mt-1">Base de datos de clientes</p>
        </div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 bg-brand-pink text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm shadow-brand-pink/30 hover:opacity-90 hover:shadow-md hover:shadow-brand-pink/30 transition-shadow self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Nuevo contacto
        </button>
      </div>

      {/* Barra de filtros */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.04),0_10px_24px_-14px_rgba(16,24,40,0.15)] p-3 sm:p-4 mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full border border-gray-200 bg-gray-50 focus:bg-white rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/40"
              placeholder="Buscar por nombre, teléfono o email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {/* Toggle de filtros en mobile */}
          <button
            onClick={() => setShowFilters(s => !s)}
            className={`sm:hidden inline-flex items-center gap-1.5 border rounded-lg px-3 py-2 text-sm flex-shrink-0 ${
              activeFilterCount > 0 ? 'border-brand-pink text-brand-pink bg-brand-pink/5' : 'border-gray-200 text-gray-600 bg-gray-50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="bg-brand-pink text-white text-[10px] font-semibold rounded-full w-4 h-4 flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
        </div>
        <div className={`${showFilters ? 'flex' : 'hidden'} sm:flex flex-col sm:flex-row gap-2 sm:gap-3 mt-2 sm:mt-3`}>
          {isAdmin && agents.length > 0 && (
            <select
              className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600 sm:flex-1"
              value={filterAgent}
              onChange={e => setFilterAgent(e.target.value)}
            >
              <option value="">Usuario asignado</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          )}
          <select
            className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600 sm:flex-1"
            value={filterSource}
            onChange={e => setFilterSource(e.target.value)}
          >
            <option value="">Origen</option>
            {sourceOptions.map(s => (
              <option key={s} value={s}>{sourceLabels[s] || s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          {tags.length > 0 && (
            <select
              className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600 sm:flex-1"
              value={filterTag}
              onChange={e => setFilterTag(e.target.value)}
            >
              <option value="">Tag</option>
              {tags.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <select
            className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600 sm:flex-1"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="recent">Alta: más recientes</option>
            <option value="oldest">Alta: más antiguos</option>
            <option value="name">Nombre: A → Z</option>
          </select>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-pink px-2 py-2 flex-shrink-0 self-start sm:self-auto">
              <X className="w-3.5 h-3.5" /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Tabs por tipo */}
      <div className="flex overflow-x-auto no-scrollbar gap-1 border-b border-gray-200 mb-4">
        {TABS.map(tab => {
          const active = filterType === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setFilterType(tab.key)}
              className={`flex items-center gap-2 whitespace-nowrap px-3.5 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-brand-pink text-gray-900 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label}
              <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${active ? 'bg-brand-pink/10 text-brand-pink' : 'bg-gray-100 text-gray-500'}`}>
                {counts[tab.key] || 0}
              </span>
            </button>
          )
        })}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Nuevo contacto</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input className={inputClass} placeholder="Nombre completo *" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <input className={inputClass} placeholder="Teléfono" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                <input className={inputClass} placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select className={inputClass} value={form.contact_type} onChange={e => setForm(f => ({ ...f, contact_type: e.target.value }))}>
                  <option value="vendedor">Vendedor</option>
                  <option value="comprador">Comprador</option>
                  <option value="inversor">Inversor</option>
                  <option value="inquilino">Inquilino</option>
                  <option value="otro">Otro</option>
                </select>
                <input className={inputClass} placeholder="Barrio" value={form.neighborhood} onChange={e => setForm(f => ({ ...f, neighborhood: e.target.value }))} />
              </div>
              <textarea className={`${inputClass} h-20`} placeholder="Notas..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleSave} disabled={saving || !form.full_name} className="flex-1 bg-brand-pink text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setShowForm(false)} className="border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-12 justify-center bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.04),0_10px_24px_-14px_rgba(16,24,40,0.15)]">
          <Loader2 className="w-5 h-5 animate-spin" /> Cargando...
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.04),0_10px_24px_-14px_rgba(16,24,40,0.15)] p-8 sm:p-12 text-center">
          <BookUser className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">{search || filterType || activeFilterCount > 0 ? 'Sin resultados' : 'No hay contactos todavía'}</p>
          <button onClick={() => setShowForm(true)} className="text-brand-pink text-sm hover:underline">Agregar el primer contacto</button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.04),0_10px_24px_-14px_rgba(16,24,40,0.15)] overflow-hidden">
          {/* Tabla desktop — scroll horizontal para que ninguna columna quede recortada */}
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100 bg-gray-50/60">
                <th className="font-medium px-4 py-3">Nombre</th>
                <th className="font-medium px-4 py-3">Tipo</th>
                <th className="font-medium px-4 py-3 whitespace-nowrap">Alta</th>
                <th className="font-medium px-4 py-3">Propiedad</th>
                <th className="font-medium px-4 py-3">Origen</th>
                <th className="font-medium px-4 py-3">Tags</th>
                <th className="font-medium px-4 py-3">Asignado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(c => {
                const t = typeLabels[c.contact_type] || typeLabels.otro
                return (
                  <tr key={c.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/70 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={c.full_name} />
                        <div className="min-w-0">
                          <Link href={`/contactos/${c.id}`} className="font-semibold text-gray-800 hover:text-brand-pink block truncate">
                            {c.full_name}
                          </Link>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 truncate">
                            {c.email && <a href={`mailto:${c.email}`} className="hover:text-brand-pink truncate">{c.email}</a>}
                            {c.email && c.phone && <span className="text-gray-300">·</span>}
                            {c.phone && <a href={`tel:${c.phone}`} className="hover:text-brand-pink whitespace-nowrap">{c.phone}</a>}
                            {!c.email && !c.phone && <span className="text-gray-300">Sin datos de contacto</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${t.color}`}>{t.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {c.created_at ? formatShortDate(c.created_at) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[220px]">
                      {c.property_address
                        ? <span className="flex items-center gap-1.5 truncate" title={c.property_address}><MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /><span className="truncate">{c.property_address}</span></span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <SourceBadge source={c.source} />
                    </td>
                    <td className="px-4 py-3">
                      {c.tags && c.tags.length > 0 ? <TagChips tags={c.tags} /> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {agentNames[c.agent_id]
                        ? <span className="text-brand-pink font-medium">{agentNames[c.agent_id]}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => handleDelete(c.id)} className="text-gray-300 hover:text-red-500 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity" title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <Link href={`/contactos/${c.id}`} className="inline-block text-gray-400 hover:text-brand-pink p-1.5 align-middle" title="Ver detalle">
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>

          {/* Cards mobile */}
          <div className="md:hidden divide-y divide-gray-100">
            {paginated.map(c => {
              const t = typeLabels[c.contact_type] || typeLabels.otro
              return (
                <div key={c.id} className="p-4 flex items-start gap-3">
                  <Avatar name={c.full_name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/contactos/${c.id}`} className="font-semibold text-gray-800 hover:text-brand-pink truncate">
                        {c.full_name}
                      </Link>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${t.color}`}>{t.label}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="text-xs text-gray-500 flex items-center gap-1 hover:text-brand-pink">
                          <Phone className="w-3 h-3" />{c.phone}
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="text-xs text-gray-500 flex items-center gap-1 hover:text-brand-pink">
                          <Mail className="w-3 h-3" />{c.email}
                        </a>
                      )}
                      {c.property_address && <span className="text-xs text-gray-500 flex items-center gap-1 min-w-0"><MapPin className="w-3 h-3 flex-shrink-0" /><span className="truncate">{c.property_address}</span></span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <SourceBadge source={c.source} />
                      {agentNames[c.agent_id] && <span className="text-xs text-brand-pink font-medium">{agentNames[c.agent_id]}</span>}
                      <TagChips tags={c.tags} max={2} />
                      {c.created_at && <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">{formatShortDate(c.created_at)}</span>}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(c.id)} className="text-gray-300 hover:text-red-500 p-1 flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/40 px-4 py-3 text-sm">
            <span className="text-gray-500">
              {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, visible.length)} de {visible.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="w-4 h-4" /> <span className="hidden sm:inline">Anterior</span>
              </button>
              <span className="px-2 text-gray-500 whitespace-nowrap">{currentPage} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <span className="hidden sm:inline">Siguiente</span> <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
