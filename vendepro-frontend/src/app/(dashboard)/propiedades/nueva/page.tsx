'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2, Search, X, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { fetchPropertyConfig, stagesForType, statusesForType } from '@/lib/property-config'
import type { PropertyConfig } from '@/lib/property-config'
import type { Contact } from '@/lib/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Heading, Text } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Field, Input, Select } from '@/components/ui/Input'

const PROPERTY_TYPES = [
  { value: 'departamento', label: 'Departamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'ph', label: 'PH' },
  { value: 'local', label: 'Local' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'oficina', label: 'Oficina' },
]

const CONTACT_TYPES = [
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'comprador', label: 'Comprador' },
  { value: 'inversor', label: 'Inversor' },
  { value: 'inquilino', label: 'Inquilino' },
  { value: 'otro', label: 'Otro' },
]

// La ficha guarda la tipología como texto libre; la propiedad usa un enum con
// CHECK constraint. Mapeamos por palabra clave y caemos a 'departamento' por defecto.
function normalizePropertyType(raw: string | null | undefined): string {
  if (!raw) return 'departamento'
  const s = raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (/\bph\b/.test(s)) return 'ph'
  if (s.includes('depto') || s.includes('dpto') || s.includes('departamento')) return 'departamento'
  if (s.includes('casa')) return 'casa'
  if (s.includes('local')) return 'local'
  if (s.includes('terreno') || s.includes('lote')) return 'terreno'
  if (s.includes('oficina')) return 'oficina'
  return 'departamento'
}

export default function NuevaPropiedadPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [config, setConfig] = useState<PropertyConfig | null>(null)

  const [form, setForm] = useState({
    address: '',
    neighborhood: '',
    city: 'Buenos Aires',
    property_type: 'departamento',
    operation_type_id: 1,
    commercial_stage_id: null as number | null,
    status_id: 1,
    rooms: '',
    size_m2: '',
    asking_price: '',
    currency: 'USD',
    owner_name: '',
    owner_phone: '',
    owner_email: '',
  })

  // Contact linking state
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [contactSearch, setContactSearch] = useState('')
  const [contactResults, setContactResults] = useState<Contact[]>([])
  const [showNewContactForm, setShowNewContactForm] = useState(false)
  const [newContact, setNewContact] = useState({ full_name: '', phone: '', email: '', contact_type: 'vendedor' })
  const [creatingContact, setCreatingContact] = useState(false)
  const [linkedLeadId, setLinkedLeadId] = useState<string | null>(null)
  const [linkedLeadName, setLinkedLeadName] = useState<string | null>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Pre-load from URL params
  useEffect(() => {
    const leadId = searchParams.get('lead_id')
    const contactId = searchParams.get('contact_id')
    const fichaId = searchParams.get('ficha_id')

    async function preload() {
      try {
        if (fichaId) {
          const fichaRes = await apiFetch('properties', `/fichas/${fichaId}`)
          if (fichaRes.ok) {
            const ficha = (await fichaRes.json()) as any
            setForm(prev => ({
              ...prev,
              address: ficha.address || prev.address,
              neighborhood: ficha.neighborhood || prev.neighborhood,
              property_type: ficha.property_type ? normalizePropertyType(ficha.property_type) : prev.property_type,
              rooms: ficha.bedrooms != null ? String(ficha.bedrooms) : prev.rooms,
              size_m2: ficha.covered_area != null ? String(ficha.covered_area) : prev.size_m2,
            }))
            if (ficha.lead_id) setLinkedLeadId(ficha.lead_id)
          }
        }
        if (leadId) {
          setLinkedLeadId(leadId)
          const res = await apiFetch('crm', `/leads?id=${leadId}`)
          const data = (await res.json()) as any
          const lead = Array.isArray(data) ? data[0] : data
          if (lead?.full_name) setLinkedLeadName(lead.full_name)
          if (lead?.contact_id) {
            const cRes = await apiFetch('crm', `/contacts/${lead.contact_id}`)
            const contact = (await cRes.json()) as any
            if (contact?.id) {
              setSelectedContact(contact)
              setForm(prev => ({
                ...prev,
                owner_name: contact.full_name || '',
                owner_phone: contact.phone || '',
                owner_email: contact.email || '',
                neighborhood: prev.neighborhood || lead.neighborhood || '',
              }))
            }
          }
        } else if (contactId) {
          const cRes = await apiFetch('crm', `/contacts/${contactId}`)
          const contact = (await cRes.json()) as any
          if (contact?.id) {
            setSelectedContact(contact)
            setForm(prev => ({
              ...prev,
              owner_name: contact.full_name || '',
              owner_phone: contact.phone || '',
              owner_email: contact.email || '',
            }))
          }
        }
      } catch {
        // preload failure is non-critical
      } finally {
        setInitializing(false)
      }
    }

    Promise.all([preload(), fetchPropertyConfig().then(setConfig)])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Contact search with debounce
  useEffect(() => {
    if (!contactSearch.trim() || selectedContact) {
      setContactResults([])
      return
    }
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch('crm', `/contacts?search=${encodeURIComponent(contactSearch)}`)
        const data = (await res.json()) as any
        setContactResults(Array.isArray(data) ? data.slice(0, 5) : [])
      } catch {
        setContactResults([])
      }
    }, 300)
  }, [contactSearch, selectedContact])

  function selectContact(contact: Contact) {
    setSelectedContact(contact)
    setContactSearch('')
    setContactResults([])
    setShowNewContactForm(false)
    setForm(prev => ({
      ...prev,
      owner_name: contact.full_name || prev.owner_name,
      owner_phone: contact.phone || prev.owner_phone,
      owner_email: contact.email || prev.owner_email,
    }))
  }

  function clearContact() {
    setSelectedContact(null)
    setContactSearch('')
    setContactResults([])
  }

  async function handleCreateContact() {
    if (!newContact.full_name.trim()) { toast('El nombre es requerido', 'error'); return }
    setCreatingContact(true)
    try {
      const res = await apiFetch('crm', '/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact),
      })
      const data = (await res.json()) as any
      if (data.id) {
        selectContact({ ...data, full_name: newContact.full_name, phone: newContact.phone || null, email: newContact.email || null } as Contact)
        setShowNewContactForm(false)
        setNewContact({ full_name: '', phone: '', email: '', contact_type: 'vendedor' })
        toast('Contacto creado y vinculado')
      } else {
        toast(data.error || 'Error al crear contacto', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
    setCreatingContact(false)
  }

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }



  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.address) { toast('La dirección es requerida', 'error'); return }
    if (!form.owner_name) { toast('El nombre del propietario es requerido', 'error'); return }
    setLoading(true)
    try {
      const payload: any = { ...form }
      if (form.rooms) payload.rooms = Number(form.rooms)
      if (form.size_m2) payload.size_m2 = Number(form.size_m2)
      if (form.asking_price) payload.asking_price = Number(form.asking_price)
      if (selectedContact) payload.contact_id = selectedContact.id
      if (linkedLeadId) payload.lead_id = linkedLeadId
      // Sync legacy text fields from IDs
      const opType = config?.operation_types.find(t => t.id === form.operation_type_id)
      if (opType) payload.operation_type = opType.slug

      const res = await apiFetch('properties', '/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as any
      if (data.id) {
        toast('Propiedad creada')
        router.push(`/propiedades/${data.id}`)
      } else {
        toast(data.error || 'Error al crear', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
    setLoading(false)
  }

  if (initializing) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div>
      <Link href="/propiedades" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-ink mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver a propiedades
      </Link>

      <PageHeader title="Nueva propiedad" className="mb-4" />

      {linkedLeadName && (
        <Alert tone="brand" className="mb-6 p-2.5 max-w-md">
          <Text as="span" tone="muted">Propiedad vinculada al lead:</Text>{' '}
          <Text as="span" weight="semibold" className="truncate">{linkedLeadName}</Text>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Card className="p-4 sm:p-6 space-y-5 sm:space-y-6">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Dirección" required className="col-span-2">
              <Input type="text" value={form.address} onChange={e => update('address', e.target.value)} required placeholder="Ej: Cervantes 3124" />
            </Field>
            <Field label="Barrio" required>
              <Input type="text" value={form.neighborhood} onChange={e => update('neighborhood', e.target.value)} required placeholder="Ej: Villa Devoto" />
            </Field>
            <Field label="Ciudad">
              <Input type="text" value={form.city} onChange={e => update('city', e.target.value)} />
            </Field>
            <Field label="Tipo">
              <Select value={form.property_type} onChange={e => update('property_type', e.target.value)}>
                {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </Field>
            <Field label="Operación">
              <Select value={form.operation_type_id}
                onChange={e => setForm(f => ({ ...f, operation_type_id: Number(e.target.value), commercial_stage_id: null }))}>
                {(config?.operation_types ?? []).map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </Select>
            </Field>
            <Field label="Etapa comercial">
              <Select value={form.commercial_stage_id ?? ''}
                onChange={e => setForm(f => ({ ...f, commercial_stage_id: e.target.value ? Number(e.target.value) : null }))}>
                <option value="">Sin etapa</option>
                {stagesForType(config ?? { operation_types: [], commercial_stages: [], property_statuses: [] }, form.operation_type_id)
                  .map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </Field>
            <Field label="Estado">
              <Select value={form.status_id}
                onChange={e => setForm(f => ({ ...f, status_id: Number(e.target.value) }))}>
                {statusesForType(config ?? { operation_types: [], commercial_stages: [], property_statuses: [] }, form.operation_type_id)
                  .map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </Field>
            <Field label="Ambientes">
              <Input type="number" value={form.rooms} onChange={e => update('rooms', e.target.value)} placeholder="Ej: 3" />
            </Field>
            <Field label="Superficie (m²)">
              <Input type="number" value={form.size_m2} onChange={e => update('size_m2', e.target.value)} placeholder="Ej: 65" />
            </Field>
            <Field label="Moneda">
              <Select value={form.currency} onChange={e => update('currency', e.target.value)}>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </Select>
            </Field>
            <Field label="Precio">
              <Input type="number" value={form.asking_price} onChange={e => update('asking_price', e.target.value)} placeholder="Ej: 85000" />
            </Field>
          </div>

          <hr className="border-gray-200" />

          <div>
            <Heading level={4} className="mb-3">Datos del propietario</Heading>

            {/* Contact selector */}
            {/* ds-todo: candidato a converger con ui/ContactSelector (difiere: acá hay creación inline de contacto y sincroniza los campos del propietario) */}
            <div className="mb-4">
              <Field label="Vincular a contacto del CRM">
                {selectedContact ? (
                  <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-control px-4 py-2.5">
                    <div>
                      <Text weight="medium">{selectedContact.full_name}</Text>
                      <Text size="xs" tone="muted">{selectedContact.contact_type}{selectedContact.phone ? ` · ${selectedContact.phone}` : ''}</Text>
                    </div>
                    <button type="button" onClick={clearContact} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <Input
                        type="text"
                        value={contactSearch}
                        onChange={e => { setContactSearch(e.target.value); setShowNewContactForm(false) }}
                        placeholder="Buscar por nombre o teléfono..."
                        className="pl-9"
                      />
                    </div>
                    {contactResults.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-control shadow-pop">
                        {contactResults.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => selectContact(c)}
                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between"
                          >
                            <div>
                              <Text weight="medium">{c.full_name}</Text>
                              <Text size="xs" tone="muted">{c.contact_type}{c.phone ? ` · ${c.phone}` : ''}</Text>
                            </div>
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => { setShowNewContactForm(true); setContactResults([]) }}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-2 text-primary border-t border-gray-100"
                        >
                          <UserPlus className="w-4 h-4" />
                          <span className="text-sm">Crear nuevo contacto</span>
                        </button>
                      </div>
                    )}
                    {contactSearch.trim() && contactResults.length === 0 && !showNewContactForm && (
                      <button
                        type="button"
                        onClick={() => setShowNewContactForm(true)}
                        className="mt-1 flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <UserPlus className="w-4 h-4" />
                        No encontrado — crear nuevo contacto
                      </button>
                    )}
                  </div>
                )}
              </Field>

              {showNewContactForm && !selectedContact && (
                <div className="mt-3 p-4 border border-gray-200 rounded-control bg-gray-50 space-y-3">
                  <Text weight="medium" className="text-gray-700">Nuevo contacto</Text>
                  <Input type="text" placeholder="Nombre *" value={newContact.full_name} onChange={e => setNewContact(p => ({ ...p, full_name: e.target.value }))} />
                  <Input type="tel" placeholder="Teléfono" value={newContact.phone} onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))} />
                  <Input type="email" placeholder="Email" value={newContact.email} onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))} />
                  <Select value={newContact.contact_type} onChange={e => setNewContact(p => ({ ...p, contact_type: e.target.value }))}>
                    {CONTACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </Select>
                  <div className="flex gap-2">
                    <Button onClick={handleCreateContact} loading={creatingContact}>
                      Crear y vincular
                    </Button>
                    <Button variant="ghost" onClick={() => { setShowNewContactForm(false); setContactSearch('') }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nombre" required className="col-span-2">
                <Input type="text" value={form.owner_name} onChange={e => update('owner_name', e.target.value)} required placeholder="Nombre del propietario" />
              </Field>
              <Field label="Teléfono">
                <Input type="tel" value={form.owner_phone} onChange={e => update('owner_phone', e.target.value)} placeholder="Ej: +54 11 5890-5594" />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.owner_email} onChange={e => update('owner_email', e.target.value)} placeholder="propietario@email.com" />
              </Field>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" size="lg" loading={loading}>
              {loading ? 'Guardando...' : 'Crear propiedad'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  )
}
