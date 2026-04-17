'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  ArrowLeft, Phone, Mail, MapPin, User, Home, Loader2,
  ExternalLink, MessageCircle, Building2, UserPlus
} from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import type { Contact } from '@/lib/types'

const STAGE_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  calificado: 'Calificado',
  visita: 'Visita',
  propuesta: 'Propuesta',
  negociacion: 'Negociación',
  cerrado: 'Cerrado',
  perdido: 'Perdido',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Activa',
  inactive: 'Inactiva',
  sold: 'Vendida',
  rented: 'Alquilada',
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    apiFetch('crm', `/contacts/${id}`)
      .then(res => res.json())
      .then((data: any) => {
        if (data?.id) setContact(data)
        else setError(true)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  )

  if (error || !contact) return (
    <div>
      <Link href="/contactos" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver a contactos
      </Link>
      <div className="bg-white rounded-xl shadow-sm p-8 text-center">
        <p className="text-gray-500">Contacto no encontrado.</p>
      </div>
    </div>
  )

  const contactTypeLabel: Record<string, string> = {
    vendedor: 'Vendedor', comprador: 'Comprador', inversor: 'Inversor',
    inquilino: 'Inquilino', otro: 'Otro',
  }

  return (
    <div className="space-y-6">
      <Link href="/contactos" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="w-4 h-4" /> Volver a contactos
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6 text-[#ff007c]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-800">{contact.full_name}</h1>
              <span className="inline-block mt-0.5 text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {contactTypeLabel[contact.contact_type] ?? contact.contact_type}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors">
                <Phone className="w-3.5 h-3.5" /> Llamar
              </a>
            )}
            {contact.phone && (
              <a href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm bg-green-50 hover:bg-green-100 text-green-700 px-3 py-2 rounded-lg transition-colors">
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </a>
            )}
            <Link href={`/leads?new=1&contact_id=${contact.id}`} className="flex items-center gap-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg transition-colors">
              <UserPlus className="w-3.5 h-3.5" /> Nuevo lead
            </Link>
            <Link href={`/propiedades/nueva?contact_id=${contact.id}`} className="flex items-center gap-1.5 text-sm bg-[#ff007c] hover:opacity-90 text-white px-3 py-2 rounded-lg transition-opacity">
              <Home className="w-3.5 h-3.5" /> Crear propiedad
            </Link>
          </div>
        </div>

        {/* Contact data */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {contact.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span>{contact.phone}</span>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="truncate">{contact.email}</span>
            </div>
          )}
          {contact.neighborhood && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span>{contact.neighborhood}</span>
            </div>
          )}
          {contact.notes && (
            <div className="col-span-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
              {contact.notes}
            </div>
          )}
        </div>
      </div>

      {/* Leads vinculados */}
      <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-gray-400" />
          Leads vinculados
          {contact.leads && contact.leads.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{contact.leads.length}</span>
          )}
        </h2>
        {!contact.leads || contact.leads.length === 0 ? (
          <p className="text-sm text-gray-400">Sin leads vinculados.</p>
        ) : (
          <div className="space-y-2">
            {contact.leads.map(lead => (
              <Link key={lead.id} href={`/leads/${lead.id}`} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors group">
                <div>
                  <p className="text-sm font-medium text-gray-800">{lead.full_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{STAGE_LABELS[lead.stage] ?? lead.stage}</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Propiedades vinculadas */}
      <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-400" />
          Propiedades vinculadas
          {contact.properties && contact.properties.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{contact.properties.length}</span>
          )}
        </h2>
        {!contact.properties || contact.properties.length === 0 ? (
          <p className="text-sm text-gray-400">Sin propiedades vinculadas.</p>
        ) : (
          <div className="space-y-2">
            {contact.properties.map(prop => (
              <Link key={prop.id} href={`/propiedades/${prop.id}`} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors group">
                <div>
                  <p className="text-sm font-medium text-gray-800">{prop.address}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {STATUS_LABELS[prop.status] ?? prop.status}
                    {prop.asking_price ? ` · ${prop.currency} ${prop.asking_price.toLocaleString('es-AR')}` : ''}
                  </p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
