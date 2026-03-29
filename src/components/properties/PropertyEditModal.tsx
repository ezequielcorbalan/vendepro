'use client'
import { useState } from 'react'
import { X, Save, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

const PROPERTY_TYPES = [
  { value: 'departamento', label: 'Departamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'ph', label: 'PH' },
  { value: 'local', label: 'Local' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'oficina', label: 'Oficina' },
]

export default function PropertyEditModal({
  property,
  onClose,
  onSaved,
}: {
  property: any
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    address: property.address || '',
    neighborhood: property.neighborhood || '',
    city: property.city || 'Buenos Aires',
    property_type: property.property_type || 'departamento',
    rooms: property.rooms || '',
    size_m2: property.size_m2 || '',
    asking_price: property.asking_price || '',
    currency: property.currency || 'USD',
    owner_name: property.owner_name || '',
    owner_phone: property.owner_phone || '',
    owner_email: property.owner_email || '',
  })

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const save = async () => {
    if (!form.address.trim()) { toast('La dirección es obligatoria', 'error'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/properties', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: property.id,
          ...form,
          rooms: form.rooms ? parseInt(String(form.rooms)) : null,
          size_m2: form.size_m2 ? parseFloat(String(form.size_m2)) : null,
          asking_price: form.asking_price ? parseFloat(String(form.asking_price)) : null,
        }),
      })
      if (res.ok) {
        toast('Propiedad actualizada')
        onSaved()
      } else {
        const d = (await res.json()) as any
        toast(d.error || 'Error', 'error')
      }
    } catch { toast('Error', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-800">Editar propiedad</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Address */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Dirección *</label>
            <input value={form.address} onChange={e => set('address', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#ff007c] focus:border-[#ff007c] outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Barrio</label>
              <input value={form.neighborhood} onChange={e => set('neighborhood', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#ff007c] focus:border-[#ff007c] outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ciudad</label>
              <input value={form.city} onChange={e => set('city', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#ff007c] focus:border-[#ff007c] outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
              <select value={form.property_type} onChange={e => set('property_type', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ambientes</label>
              <input type="number" value={form.rooms} onChange={e => set('rooms', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#ff007c] focus:border-[#ff007c] outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">m²</label>
              <input type="number" value={form.size_m2} onChange={e => set('size_m2', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#ff007c] focus:border-[#ff007c] outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Precio</label>
              <input type="number" value={form.asking_price} onChange={e => set('asking_price', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#ff007c] focus:border-[#ff007c] outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Moneda</label>
              <select value={form.currency} onChange={e => set('currency', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-500 mb-3">Propietario</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
                <input value={form.owner_name} onChange={e => set('owner_name', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#ff007c] focus:border-[#ff007c] outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                  <input value={form.owner_phone} onChange={e => set('owner_phone', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#ff007c] focus:border-[#ff007c] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input type="email" value={form.owner_email} onChange={e => set('owner_email', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#ff007c] focus:border-[#ff007c] outline-none" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2 sticky bottom-0 bg-white">
          <button onClick={save} disabled={saving}
            className="flex-1 bg-[#ff007c] text-white py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar cambios
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
