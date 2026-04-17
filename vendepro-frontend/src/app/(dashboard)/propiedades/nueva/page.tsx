'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2, Search, X, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import type { Contact } from '@/lib/types'

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

export default function NuevaPropiedadPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)

  const [form, setForm] = useState({
    address: '',
    neighborhood: '',
    city: 'Buenos Aires',
    property_type: 'departamento',
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
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Pre-load from URL params
  useEffect(() => {
    const leadId = searchParams.get('lead_id')
    const contactId = searchParams.get('contact_id')

    async function preload() {
      try {
        if (leadId) {
          setLinkedLeadId(leadId)
          const res = await apiFetch('crm', `/leads`)
          const leads = (await res.json()) as any[]
          const lead = leads.find((l: any) => l.id === leadId)
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

    preload()
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

  const inputClass = 'w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]'

  if (initializing) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div>
      <Link href="/propiedades" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver a propiedades
      </Link>

      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Nueva propiedad</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-4 sm:p-6 space-y-5 sm:space-y-6">

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección *</label>
            <input type="text" value={form.address} onChange={e => update('address', e.target.value)} required placeholder="Ej: Cervantes 3124" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Barrio *</label>
            <input type="text" value={form.neighborhood} onChange={e => update('neighborhood', e.target.value)} required placeholder="Ej: Villa Devoto" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
            <input type="text" value={form.city} onChange={e => update('city', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select value={form.property_type} onChange={e => update('property_type', e.target.value)} className={inputClass}>
              {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ambientes</label>
            <input type="number" value={form.rooms} onChange={e => update('rooms', e.target.value)} placeholder="Ej: 3" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Superficie (m²)</label>
            <input type="number" value={form.size_m2} onChange={e => update('size_m2', e.target.value)} placeholder="Ej: 65" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
            <select value={form.currency} onChange={e => update('currency', e.target.value)} className={inputClass}>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio</label>
            <input type="number" value={form.asking_price} onChange={e => update('asking_price', e.target.value)} placeholder="Ej: 85000" className={inputClass} />
          </div>
        </div>

        <hr className="border-gray-200" />

        <div>
          <h2 className="text-lg font-medium text-gray-800 mb-3">Datos del propietario</h2>

          {/* Contact selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Vincular a contacto del CRM</label>
            {selectedContact ? (
              <div className="flex items-center justify-between bg-pink-50 border border-pink-200 rounded-lg px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-800">{selectedContact.full_name}</p>
                  <p className="text-xs text-gray-500">{selectedContact.contact_type}{selectedContact.phone ? ` · ${selectedContact.phone}` : ''}</p>
                </div>
                <button type="button" onClick={clearContact} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={e => { setContactSearch(e.target.value); setShowNewContactForm(false) }}
                    placeholder="Buscar por nombre o teléfono..."
                    className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]"
                  />
                </div>
                {contactResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
                    {contactResults.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectContact(c)}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-800">{c.full_name}</p>
                          <p className="text-xs text-gray-500">{c.contact_type}{c.phone ? ` · ${c.phone}` : ''}</p>
                        </div>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => { setShowNewContactForm(true); setContactResults([]) }}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-2 text-[#ff007c] border-t border-gray-100"
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
                    className="mt-1 flex items-center gap-2 text-sm text-[#ff007c] hover:underline"
                  >
                    <UserPlus className="w-4 h-4" />
                    No encontrado — crear nuevo contacto
                  </button>
                )}
              </div>
            )}

            {showNewContactForm && !selectedContact && (
              <div className="mt-3 p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
                <p className="text-sm font-medium text-gray-700">Nuevo contacto</p>
                <input type="text" placeholder="Nombre *" value={newContact.full_name} onChange={e => setNewContact(p => ({ ...p, full_name: e.target.value }))} className={inputClass} />
                <input type="tel" placeholder="Teléfono" value={newContact.phone} onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))} className={inputClass} />
                <input type="email" placeholder="Email" value={newContact.email} onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))} className={inputClass} />
                <select value={newContact.contact_type} onChange={e => setNewContact(p => ({ ...p, contact_type: e.target.value }))} className={inputClass}>
                  {CONTACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <div className="flex gap-2">
                  <button type="button" onClick={handleCreateContact} disabled={creatingContact} className="flex items-center gap-2 bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                    {creatingContact ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Crear y vincular
                  </button>
                  <button type="button" onClick={() => { setShowNewContactForm(false); setContactSearch('') }} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input type="text" value={form.owner_name} onChange={e => update('owner_name', e.target.value)} required placeholder="Nombre del propietario" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input type="tel" value={form.owner_phone} onChange={e => update('owner_phone', e.target.value)} placeholder="Ej: +54 11 5890-5594" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.owner_email} onChange={e => update('owner_email', e.target.value)} placeholder="propietario@email.com" className={inputClass} />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={loading} className="flex items-center gap-2 bg-[#ff007c] text-white px-6 py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Guardando...' : 'Crear propiedad'}
          </button>
        </div>
      </form>
    </div>
  )
}
