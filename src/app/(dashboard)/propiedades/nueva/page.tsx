'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const propertyTypes = [
  { value: 'departamento', label: 'Departamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'ph', label: 'PH' },
  { value: 'local', label: 'Local' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'oficina', label: 'Oficina' },
]

export default function NuevaPropiedad() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      Object.entries(form).forEach(([key, value]) => {
        if (value) formData.append(key, value)
      })

      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json() as any
        setError(data.error || 'Error al crear propiedad')
        setLoading(false)
        return
      }

      const result = await res.json() as any
      router.push(`/propiedades/${result.id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Error inesperado')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/propiedades"
        className="inline-flex items-center gap-2 text-sm text-brand-gray hover:text-gray-800 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a propiedades
      </Link>

      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Nueva propiedad</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-4 sm:p-6 space-y-5 sm:space-y-6">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección *</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
              required
              placeholder="Ej: Cervantes 3124"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Barrio *</label>
            <input
              type="text"
              value={form.neighborhood}
              onChange={(e) => update('neighborhood', e.target.value)}
              required
              placeholder="Ej: Villa Devoto"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => update('city', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={form.property_type}
              onChange={(e) => update('property_type', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink"
            >
              {propertyTypes.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ambientes</label>
            <input
              type="number"
              value={form.rooms}
              onChange={(e) => update('rooms', e.target.value)}
              placeholder="Ej: 3"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Superficie (m2)</label>
            <input
              type="number"
              value={form.size_m2}
              onChange={(e) => update('size_m2', e.target.value)}
              placeholder="Ej: 65"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
            <select
              value={form.currency}
              onChange={(e) => update('currency', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink"
            >
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio</label>
            <input
              type="number"
              value={form.asking_price}
              onChange={(e) => update('asking_price', e.target.value)}
              placeholder="Ej: 85000"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink"
            />
          </div>
        </div>

        <hr className="border-gray-200" />

        <h2 className="text-lg font-medium text-gray-800">Datos del propietario</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              type="text"
              value={form.owner_name}
              onChange={(e) => update('owner_name', e.target.value)}
              required
              placeholder="Nombre del propietario"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input
              type="tel"
              value={form.owner_phone}
              onChange={(e) => update('owner_phone', e.target.value)}
              placeholder="Ej: +54 11 5890-5594"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.owner_email}
              onChange={(e) => update('owner_email', e.target.value)}
              placeholder="propietario@email.com"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="bg-brand-pink text-white px-6 py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Guardando...' : 'Crear propiedad'}
          </button>
        </div>
      </form>
    </div>
  )
}
