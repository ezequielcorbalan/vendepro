'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Search, Trash2, Loader2, BookUser, Phone, Mail, MapPin, X, ChevronRight, ChevronLeft, SlidersHorizontal } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { applyScopeToParams, isAdminOrSupervisor } from '@/lib/agent-scope'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tabs } from '@/components/ui/Tabs'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'

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
  kiteprop: 'Integración',
}

const SHORT_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function formatShortDate(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '—'
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`
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
  return <Badge tone="neutral">{label}</Badge>
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
      <PageHeader
        title="Contactos"
        subtitle="Base de datos de clientes"
        className="mb-5"
        actions={
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowForm(true)}>
            Nuevo contacto
          </Button>
        }
      />

      {/* Barra de filtros */}
      <Card className="p-3 sm:p-4 mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <Input
              className="pl-9"
              placeholder="Buscar por nombre, teléfono o email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {/* Toggle de filtros en mobile */}
          <Button
            variant="outline"
            onClick={() => setShowFilters(s => !s)}
            icon={<SlidersHorizontal className="w-4 h-4" />}
            className={`sm:hidden flex-shrink-0 ${activeFilterCount > 0 ? 'border-primary text-primary bg-primary/5 hover:bg-primary/10' : ''}`}
          >
            Filtros
            {activeFilterCount > 0 && (
              <span className="bg-primary text-white text-[10px] font-semibold rounded-full w-4 h-4 flex items-center justify-center">{activeFilterCount}</span>
            )}
          </Button>
        </div>
        <div className={`${showFilters ? 'flex' : 'hidden'} sm:flex flex-col sm:flex-row gap-2 sm:gap-3 mt-2 sm:mt-3`}>
          {isAdmin && agents.length > 0 && (
            <Select
              className="sm:flex-1"
              value={filterAgent}
              onChange={e => setFilterAgent(e.target.value)}
            >
              <option value="">Usuario asignado</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </Select>
          )}
          <Select
            className="sm:flex-1"
            value={filterSource}
            onChange={e => setFilterSource(e.target.value)}
          >
            <option value="">Origen</option>
            {sourceOptions.map(s => (
              <option key={s} value={s}>{sourceLabels[s] || s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </Select>
          {tags.length > 0 && (
            <Select
              className="sm:flex-1"
              value={filterTag}
              onChange={e => setFilterTag(e.target.value)}
            >
              <option value="">Tag</option>
              {tags.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          )}
          <Select
            className="sm:flex-1"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="recent">Alta: más recientes</option>
            <option value="oldest">Alta: más antiguos</option>
            <option value="name">Nombre: A → Z</option>
          </Select>
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              icon={<X className="w-3.5 h-3.5" />}
              onClick={clearFilters}
              className="flex-shrink-0 self-start sm:self-auto text-gray-500"
            >
              Limpiar
            </Button>
          )}
        </div>
      </Card>

      {/* Tabs por tipo */}
      <Tabs
        className="overflow-x-auto no-scrollbar mb-4"
        items={TABS.map(tab => ({ value: tab.key, label: tab.label, count: counts[tab.key] || 0 }))}
        value={filterType}
        onChange={setFilterType}
      />

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Nuevo contacto"
        className="max-w-lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving} disabled={saving || !form.full_name}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Nombre completo" required>
            <Input placeholder="Nombre completo" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Teléfono">
              <Input placeholder="Teléfono" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </Field>
            <Field label="Email">
              <Input placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <Select value={form.contact_type} onChange={e => setForm(f => ({ ...f, contact_type: e.target.value }))}>
                <option value="vendedor">Vendedor</option>
                <option value="comprador">Comprador</option>
                <option value="inversor">Inversor</option>
                <option value="inquilino">Inquilino</option>
                <option value="otro">Otro</option>
              </Select>
            </Field>
            <Field label="Barrio">
              <Input placeholder="Barrio" value={form.neighborhood} onChange={e => setForm(f => ({ ...f, neighborhood: e.target.value }))} />
            </Field>
          </div>
          <Field label="Notas">
            <Textarea placeholder="Notas..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </Field>
        </div>
      </Modal>

      {loading ? (
        <Card className="flex items-center gap-2 text-gray-500 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Cargando...
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookUser className="w-7 h-7" />}
            title={search || filterType || activeFilterCount > 0 ? 'Sin resultados' : 'No hay contactos todavía'}
            action={
              <button onClick={() => setShowForm(true)} className="text-primary text-sm hover:underline">Agregar el primer contacto</button>
            }
          />
        </Card>
      ) : (
        <Card padded={false} className="overflow-hidden">
          {/* Tabla desktop — scroll horizontal para que ninguna columna quede recortada */}
          {/* ds-todo: candidato a Table del DS cuando soporte hover-reveal por fila y render responsive */}
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
                        <Avatar name={c.full_name || '?'} />
                        <div className="min-w-0">
                          <Link href={`/contactos/${c.id}`} className="font-semibold text-ink hover:text-primary block truncate">
                            {c.full_name}
                          </Link>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 truncate">
                            {c.email && <a href={`mailto:${c.email}`} className="hover:text-primary truncate">{c.email}</a>}
                            {c.email && c.phone && <span className="text-gray-300">·</span>}
                            {c.phone && <a href={`tel:${c.phone}`} className="hover:text-primary whitespace-nowrap">{c.phone}</a>}
                            {!c.email && !c.phone && <span className="text-gray-300">Sin datos de contacto</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge label={t.label} color={t.color} />
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
                        ? <span className="text-primary font-medium">{agentNames[c.agent_id]}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => handleDelete(c.id)} className="text-gray-300 hover:text-danger p-1.5 opacity-0 group-hover:opacity-100 transition-opacity" title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <Link href={`/contactos/${c.id}`} className="inline-block text-gray-400 hover:text-primary p-1.5 align-middle" title="Ver detalle">
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
                  <Avatar name={c.full_name || '?'} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/contactos/${c.id}`} className="font-semibold text-ink hover:text-primary truncate">
                        {c.full_name}
                      </Link>
                      <StatusBadge label={t.label} color={t.color} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="text-xs text-gray-500 flex items-center gap-1 hover:text-primary">
                          <Phone className="w-3 h-3" />{c.phone}
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="text-xs text-gray-500 flex items-center gap-1 hover:text-primary">
                          <Mail className="w-3 h-3" />{c.email}
                        </a>
                      )}
                      {c.property_address && <span className="text-xs text-gray-500 flex items-center gap-1 min-w-0"><MapPin className="w-3 h-3 flex-shrink-0" /><span className="truncate">{c.property_address}</span></span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <SourceBadge source={c.source} />
                      {agentNames[c.agent_id] && <span className="text-xs text-primary font-medium">{agentNames[c.agent_id]}</span>}
                      <TagChips tags={c.tags} max={2} />
                      {c.created_at && <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">{formatShortDate(c.created_at)}</span>}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(c.id)} className="text-gray-300 hover:text-danger p-1 flex-shrink-0">
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                icon={<ChevronLeft className="w-4 h-4" />}
              >
                <span className="hidden sm:inline">Anterior</span>
              </Button>
              <span className="px-2 text-gray-500 whitespace-nowrap">{currentPage} / {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                <span className="hidden sm:inline">Siguiente</span> <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
