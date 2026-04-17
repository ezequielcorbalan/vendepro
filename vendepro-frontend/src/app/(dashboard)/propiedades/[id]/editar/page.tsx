'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { ContactSelector } from '@/components/ui/ContactSelector'
import { PhotoGallery } from '@/components/ui/PhotoGallery'

const PROPERTY_TYPES = [
  { value: 'departamento', label: 'Departamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'ph', label: 'PH' },
  { value: 'local', label: 'Local' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'oficina', label: 'Oficina' },
]

const COMMERCIAL_STAGES = [
  { value: 'captada', label: 'Captada' },
  { value: 'documentacion', label: 'En documentación' },
  { value: 'publicada', label: 'Publicada' },
  { value: 'reservada', label: 'Reservada' },
  { value: 'vendida', label: 'Vendida' },
  { value: 'suspendida', label: 'Suspendida' },
  { value: 'archivada', label: 'Archivada' },
]

const PROPERTY_STATUSES = [
  { value: 'active', label: 'Activa' },
  { value: 'suspended', label: 'Suspendida' },
  { value: 'inactive', label: 'Inactiva' },
  { value: 'sold', label: 'Vendida' },
  { value: 'archived', label: 'Archivada' },
]

export default function EditarPropiedadPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [photos, setPhotos] = useState<{ id: string; url: string; sort_order: number }[]>([])
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
    status: 'active',
    commercial_stage: '',
  })

  useEffect(() => {
    if (!id) return
    apiFetch('properties', `/properties/${id}`)
      .then(r => r.json() as any)
      .then((p: any) => {
        if (p.error) { router.push('/propiedades'); return }
        setForm({
          address: p.address || '',
          neighborhood: p.neighborhood || '',
          city: p.city || 'Buenos Aires',
          property_type: p.property_type || 'departamento',
          rooms: p.rooms != null ? String(p.rooms) : '',
          size_m2: p.size_m2 != null ? String(p.size_m2) : '',
          asking_price: p.asking_price != null ? String(p.asking_price) : '',
          currency: p.currency || 'USD',
          owner_name: p.owner_name || '',
          owner_phone: p.owner_phone || '',
          owner_email: p.owner_email || '',
          status: p.status || 'active',
          commercial_stage: p.commercial_stage || '',
        })
        if (p.contact_id) {
          setOwnerContact({ id: p.contact_id, full_name: p.owner_name || '', phone: p.owner_phone, email: p.owner_email })
        }
        setPhotos(p.photos || [])
        setLoading(false)
      })
      .catch(() => router.push('/propiedades'))
  }, [id, router])

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

  async function handleSave() {
    if (!form.address) { toast('La dirección es requerida', 'error'); return }
    setSaving(true)
    try {
      const payload: any = {
        ...form,
        rooms: form.rooms ? Number(form.rooms) : null,
        size_m2: form.size_m2 ? Number(form.size_m2) : null,
        asking_price: form.asking_price ? Number(form.asking_price) : null,
        contact_id: ownerContact?.id ?? null,
      }
      const res = await apiFetch('properties', `/properties/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as any
      if (data.success) {
        toast('Propiedad actualizada')
        router.push(`/propiedades/${id}`)
      } else {
        toast(data.error || 'Error al guardar', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
    setSaving(false)
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff007c]" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/propiedades/${id}`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Editar propiedad</h1>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar
        </button>
      </div>

      {/* Datos del inmueble */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Datos del inmueble</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección *</label>
            <input type="text" value={form.address} onChange={e => update('address', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Barrio</label>
            <input type="text" value={form.neighborhood} onChange={e => update('neighborhood', e.target.value)} className={inputClass} />
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
            <input type="number" value={form.rooms} onChange={e => update('rooms', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Superficie (m²)</label>
            <input type="number" value={form.size_m2} onChange={e => update('size_m2', e.target.value)} className={inputClass} />
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
            <input type="number" value={form.asking_price} onChange={e => update('asking_price', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select value={form.status} onChange={e => update('status', e.target.value)} className={inputClass}>
              {PROPERTY_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Etapa comercial</label>
            <select value={form.commercial_stage} onChange={e => update('commercial_stage', e.target.value)} className={inputClass}>
              <option value="">Sin etapa</option>
              {COMMERCIAL_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Propietario */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Propietario</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Vincular contacto (opcional)</label>
          <ContactSelector value={ownerContact} onChange={handleContactSelect} />
          <p className="text-xs text-gray-400 mt-1">Seleccioná un contacto para auto-completar</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input type="text" value={form.owner_name} onChange={e => update('owner_name', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input type="tel" value={form.owner_phone} onChange={e => update('owner_phone', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.owner_email} onChange={e => update('owner_email', e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Fotos */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Fotos</h2>
        <PhotoGallery photos={photos} propertyId={id} editable />
      </div>

      <div className="flex justify-end pb-8">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-[#ff007c] text-white px-6 py-3 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar cambios
        </button>
      </div>
    </div>
  )
}
