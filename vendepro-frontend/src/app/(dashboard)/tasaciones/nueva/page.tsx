'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

const PROPERTY_TYPES = ['departamento', 'casa', 'ph', 'local', 'terreno', 'oficina']

export default function NuevaTasacionPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    property_address: '',
    neighborhood: '',
    city: 'Buenos Aires',
    property_type: 'departamento',
    covered_area: '',
    total_area: '',
    semi_area: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    suggested_price: '',
    test_price: '',
    expected_close_price: '',
    strengths: '',
    weaknesses: '',
    opportunities: '',
    threats: '',
    publication_analysis: '',
  })

  const handleSave = async () => {
    if (!form.property_address) { toast('La dirección es requerida', 'error'); return }
    setSaving(true)
    try {
      const payload: any = { ...form }
      if (form.covered_area) payload.covered_area = Number(form.covered_area)
      if (form.total_area) payload.total_area = Number(form.total_area)
      if (form.semi_area) payload.semi_area = Number(form.semi_area)
      if (form.suggested_price) payload.suggested_price = Number(form.suggested_price)
      if (form.test_price) payload.test_price = Number(form.test_price)
      if (form.expected_close_price) payload.expected_close_price = Number(form.expected_close_price)

      const res = await apiFetch('properties', '/appraisals', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as any
      if (data.id) {
        toast('Tasación creada')
        router.push(`/tasaciones/${data.id}`)
      } else {
        toast(data.error || 'Error al crear', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
    setSaving(false)
  }

  const inputClass = 'border rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]'

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/tasaciones" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm">
          <ArrowLeft className="w-4 h-4" /> Tasaciones
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Nueva tasación</h1>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Crear tasación
        </button>
      </div>

      {/* Propiedad */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Datos de la propiedad</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección *</label>
            <input value={form.property_address} onChange={e => setForm(f => ({ ...f, property_address: e.target.value }))}
              placeholder="Ej: Av. Corrientes 1234" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Barrio</label>
            <input value={form.neighborhood} onChange={e => setForm(f => ({ ...f, neighborhood: e.target.value }))}
              placeholder="Palermo" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
            <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select value={form.property_type} onChange={e => setForm(f => ({ ...f, property_type: e.target.value }))} className={inputClass}>
              {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sup. cubierta (m²)</label>
            <input type="number" value={form.covered_area} onChange={e => setForm(f => ({ ...f, covered_area: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sup. total (m²)</label>
            <input type="number" value={form.total_area} onChange={e => setForm(f => ({ ...f, total_area: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sup. semicubierta (m²)</label>
            <input type="number" value={form.semi_area} onChange={e => setForm(f => ({ ...f, semi_area: e.target.value }))} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Propietario */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Datos del propietario</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Precio */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Valuación</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio sugerido (USD)</label>
            <input type="number" value={form.suggested_price} onChange={e => setForm(f => ({ ...f, suggested_price: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio de prueba (USD)</label>
            <input type="number" value={form.test_price} onChange={e => setForm(f => ({ ...f, test_price: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio de cierre (USD)</label>
            <input type="number" value={form.expected_close_price} onChange={e => setForm(f => ({ ...f, expected_close_price: e.target.value }))} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Análisis */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Análisis FODA</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: 'strengths', label: 'Fortalezas' },
            { key: 'weaknesses', label: 'Debilidades' },
            { key: 'opportunities', label: 'Oportunidades' },
            { key: 'threats', label: 'Amenazas' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <textarea rows={3} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className={inputClass} />
            </div>
          ))}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Análisis de publicación</label>
          <textarea rows={4} value={form.publication_analysis} onChange={e => setForm(f => ({ ...f, publication_analysis: e.target.value }))}
            className={inputClass} />
        </div>
      </div>

      <div className="flex justify-end pb-8">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-[#ff007c] text-white px-6 py-3 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Crear tasación
        </button>
      </div>
    </div>
  )
}
