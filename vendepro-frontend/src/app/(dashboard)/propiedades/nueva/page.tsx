'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { ContactSelector } from '@/components/ui/ContactSelector'

const PROPERTY_TYPES = [
  { value: 'departamento', label: 'Departamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'ph', label: 'PH' },
  { value: 'local', label: 'Local' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'oficina', label: 'Oficina' },
]

export default function NuevaPropiedadPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [ownerContact, setOwnerContact] = useState<{ id: string; full_name: string; phone?: string | null; email?: string | null } | null>(null)
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

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleContactSelect(ct: typeof ownerContact) {
    setOwnerContact(ct)
    if (ct) {
      update('owner_name', ct.full_name)
      update('owner_phone', ct.phone || '')
      update('owner_email', ct.email || '')
    }
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
      if (ownerContact) payload.contact_id = ownerContact.id

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

  return (
    <div className="max-w-2xl">
      <Link href="/propiedades" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver a propiedades
      </Link>

      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Nueva propiedad</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-4 sm:p-6 space-y-5 sm:space-y-6">

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección *</label>
            <input
              type="text"
              value={form.address}
              onChange={e => update('address', e.target.value)}
              required
              placeholder="Ej: Cervantes 3124"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Barrio *</label>
            <input
              type="text"
              value={form.neighborhood}
              onChange={e => update('neighborhood', e.target.value)}
              required
              placeholder="Ej: Villa Devoto"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
            <input
              type="text"
              value={form.city}
              onChange={e => update('city', e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select value={form.property_type} onChange={e => update('property_type', e.target.value)} className={inputClass}>
              {PROPERTY_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ambientes</label>
            <input
              type="number"
              value={form.rooms}
              onChange={e => update('rooms', e.target.value)}
              placeholder="Ej: 3"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Superficie (m²)</label>
            <input
              type="number"
              value={form.size_m2}
              onChange={e => update('size_m2', e.target.value)}
              placeholder="Ej: 65"
              className={inputClass}
            />
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
            <input
              type="number"
              value={form.asking_price}
              onChange={e => update('asking_price', e.target.value)}
              placeholder="Ej: 85000"
              className={inputClass}
            />
          </div>
        </div>

        <hr className="border-gray-200" />

        <h2 className="text-lg font-medium text-gray-800">Datos del propietario</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contacto existente (opcional)</label>
          <ContactSelector value={ownerContact} onChange={handleContactSelect} />
          <p className="text-xs text-gray-400 mt-1">Seleccioná un contacto para auto-completar los campos</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              type="text"
              value={form.owner_name}
              onChange={e => update('owner_name', e.target.value)}
              required
              placeholder="Nombre del propietario"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input
              type="tel"
              value={form.owner_phone}
              onChange={e => update('owner_phone', e.target.value)}
              placeholder="Ej: +54 11 5890-5594"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.owner_email}
              onChange={e => update('owner_email', e.target.value)}
              placeholder="propietario@email.com"
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-[#ff007c] text-white px-6 py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Guardando...' : 'Crear propiedad'}
          </button>
        </div>
      </form>
    </div>
  )
}
