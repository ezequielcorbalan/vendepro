'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, Loader2, Phone, Mail, User, MapPin, DollarSign, Calendar } from 'lucide-react'
import { apiFetch } from '@/lib/api'

const stageLabel: Record<string, string> = {
  captada: 'Captada',
  publicada: 'Publicada',
  reservada: 'Reservada',
  vendida: 'Vendida',
  suspendida: 'Suspendida',
  archivada: 'Archivada',
  documentacion: 'En documentación',
}
const stageColor: Record<string, string> = {
  captada: 'bg-green-100 text-green-700',
  publicada: 'bg-blue-100 text-blue-700',
  reservada: 'bg-purple-100 text-purple-700',
  vendida: 'bg-emerald-100 text-emerald-700',
  suspendida: 'bg-orange-100 text-orange-700',
  archivada: 'bg-gray-100 text-gray-500',
  documentacion: 'bg-amber-100 text-amber-700',
}

export default function PropiedadDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const [property, setProperty] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return
    apiFetch('properties', `/properties/${id}`)
      .then(r => (r.json()) as any)
      .then((d: any) => {
        if (d?.error) { setError(true); setLoading(false); return }
        setProperty(d)
        setLoading(false)
      })
      .catch(() => { setError(true); setLoading(false) })
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff007c]" />
      </div>
    )
  }

  if (error || !property) {
    return (
      <div>
        <Link href="/propiedades" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
        <div className="bg-red-50 text-red-600 rounded-xl p-6">
          Error cargando la propiedad
        </div>
      </div>
    )
  }

  const stage = property.commercial_stage || 'captada'

  return (
    <div>
      <Link href="/propiedades" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver a Propiedades
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#ff007c]/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6 text-[#ff007c]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-800">{property.address}</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {[property.neighborhood, property.city].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${stageColor[stage] || 'bg-gray-100 text-gray-600'}`}>
            {stageLabel[stage] || stage}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Datos del inmueble */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Inmueble</h2>
          <dl className="space-y-3">
            {property.property_type && (
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Tipo</dt>
                <dd className="font-medium text-gray-800 capitalize">{property.property_type}</dd>
              </div>
            )}
            {property.rooms && (
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Ambientes</dt>
                <dd className="font-medium text-gray-800">{property.rooms}</dd>
              </div>
            )}
            {property.size_m2 && (
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Superficie</dt>
                <dd className="font-medium text-gray-800">{property.size_m2} m²</dd>
              </div>
            )}
            {property.asking_price && (
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Precio</dt>
                <dd className="font-medium text-[#ff007c]">
                  {property.currency} {Number(property.asking_price).toLocaleString('es-AR')}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Propietario */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Propietario</h2>
          {property.owner_name ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-800 font-medium">{property.owner_name}</span>
              </div>
              {property.owner_phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <a href={`tel:${property.owner_phone}`} className="text-[#ff007c] hover:underline">{property.owner_phone}</a>
                </div>
              )}
              {property.owner_email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <a href={`mailto:${property.owner_email}`} className="text-[#ff007c] hover:underline">{property.owner_email}</a>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sin datos del propietario</p>
          )}
        </div>

        {/* Agente */}
        {property.agent_name && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Agente</h2>
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-800 font-medium">{property.agent_name}</span>
            </div>
          </div>
        )}

        {/* Fechas */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Historial</h2>
          <dl className="space-y-3">
            {property.created_at && (
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Captada</dt>
                <dd className="font-medium text-gray-800">
                  {new Date(property.created_at).toLocaleDateString('es-AR')}
                </dd>
              </div>
            )}
            {property.updated_at && (
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Última actualización</dt>
                <dd className="font-medium text-gray-800">
                  {new Date(property.updated_at).toLocaleDateString('es-AR')}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  )
}
