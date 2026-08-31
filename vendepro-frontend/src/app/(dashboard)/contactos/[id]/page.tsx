'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  ArrowLeft, Phone, Mail, MapPin, User, Home, Loader2,
  ExternalLink, Building2, UserPlus, Edit3, X
} from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Card } from '@/components/ui/Card'
import { Heading, Text } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Input'
import { CallButton, WhatsAppButton } from '@/components/ui/ContactButtons'
import type { Contact } from '@/lib/types'

import { DetailHeader, DetailMeta } from '@/components/ui/DetailHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
const CONTACT_TYPES = ['propietario', 'comprador', 'inversor', 'inquilino', 'vendedor', 'otro']

const SOURCE_LABELS: Record<string, string> = {
  argenprop: 'Argenprop', zonaprop: 'Zonaprop', mercadolibre: 'MercadoLibre',
  buscainmueble: 'Buscainmueble', instagram: 'Instagram', whatsapp_bot_instagram: 'Instagram',
  whatsapp: 'WhatsApp', web: 'Web', referido: 'Referido', manual: 'Manual', api: 'API',
  kiteprop: 'Integración',
}
const sourceLabel = (s: string) => SOURCE_LABELS[s.toLowerCase()] ?? (s.charAt(0).toUpperCase() + s.slice(1))

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
  const { toast } = useToast()
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState<any>({})

  function loadContact() {
    apiFetch('crm', `/contacts/${id}`)
      .then(res => res.json())
      .then((data: any) => {
        if (data?.id) setContact(data)
        else setError(true)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadContact() }, [id])

  const openEdit = () => {
    if (!contact) return
    setEditForm({
      full_name: contact.full_name ?? '',
      phone: contact.phone ?? '',
      email: contact.email ?? '',
      contact_type: contact.contact_type ?? 'propietario',
      neighborhood: contact.neighborhood ?? '',
      notes: contact.notes ?? '',
    })
    setShowEdit(true)
  }

  const handleSaveEdit = async () => {
    if (!editForm.full_name?.trim() || editForm.full_name.trim().length < 2) {
      toast('El nombre es requerido (mín. 2 caracteres)', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await apiFetch('crm', `/contacts?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      })
      const data = (await res.json().catch(() => ({}))) as any
      if (!res.ok || data.error) {
        toast(data.error || 'Error al guardar', 'error')
      } else {
        toast('Contacto actualizado')
        setShowEdit(false)
        loadContact()
      }
    } catch {
      toast('Error de conexión', 'error')
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  )

  if (error || !contact) return (
    <div>
      <Link href="/contactos" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-ink mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver a contactos
      </Link>
      <Card padded={false} className="p-8 text-center">
        <Text tone="muted">Contacto no encontrado.</Text>
      </Card>
    </div>
  )

  const contactTypeLabel: Record<string, string> = {
    vendedor: 'Vendedor', comprador: 'Comprador', inversor: 'Inversor',
    inquilino: 'Inquilino', otro: 'Otro',
  }

  return (
    <div className="space-y-6">
      <Link href="/contactos" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-ink">
        <ArrowLeft className="w-4 h-4" /> Volver a contactos
      </Link>

      {/* Header — molde compartido con /leads/[id] (`DetailHeader`). */}
      <DetailHeader
        avatar={<Avatar size="lg" name={contact.full_name || '?'} />}
        title={contact.full_name}
        badges={
          <Badge tone="neutral">
            {contactTypeLabel[contact.contact_type] ?? contact.contact_type}
          </Badge>
        }
        actions={
          <>
            <Button variant="outline" onClick={openEdit} icon={<Edit3 className="w-3.5 h-3.5" />}>
              Editar
            </Button>
            <Button href={`/leads?new=1&contact_id=${contact.id}`} variant="outline" icon={<UserPlus className="w-4 h-4" />}>
              Nuevo lead
            </Button>
            <Button href={`/propiedades/nueva?contact_id=${contact.id}`} icon={<Home className="w-4 h-4" />}>
              Crear propiedad
            </Button>
            {contact.phone && <CallButton phone={contact.phone} />}
            {contact.phone && <WhatsAppButton phone={contact.phone} />}
          </>
        }
        visibleActions={3}
        meta={
          <>
            {contact.phone && <DetailMeta icon={<Phone className="w-4 h-4" />}>{contact.phone}</DetailMeta>}
            {contact.email && <DetailMeta icon={<Mail className="w-4 h-4" />}>{contact.email}</DetailMeta>}
            {contact.neighborhood && <DetailMeta icon={<MapPin className="w-4 h-4" />}>{contact.neighborhood}</DetailMeta>}
            {contact.agent_name && (
              <DetailMeta icon={<User className="w-4 h-4" />}>
                Asignado a <span className="font-medium text-ink">{contact.agent_name}</span>
              </DetailMeta>
            )}
            {contact.source && (
              <DetailMeta icon={<ExternalLink className="w-4 h-4" />}>{sourceLabel(contact.source)}</DetailMeta>
            )}
          </>
        }
        footer={
          contact.notes ? (
            <Text size="sm" className="block text-gray-600 bg-gray-50 rounded-card p-3 whitespace-pre-wrap">
              {contact.notes}
            </Text>
          ) : undefined
        }
      />

      {/* Leads vinculados */}
      <Card padded={false} className="p-5 sm:p-6">
        <Heading level={4} className="mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-gray-400" />
          Leads vinculados
          {contact.leads && contact.leads.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{contact.leads.length}</span>
          )}
        </Heading>
        {!contact.leads || contact.leads.length === 0 ? (
          <Text tone="muted">Sin leads vinculados.</Text>
        ) : (
          <div className="space-y-2">
            {contact.leads.map(lead => (
              <Link key={lead.id} href={`/leads/${lead.id}`} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors group">
                <div>
                  <p className="text-sm font-medium text-ink">{lead.full_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{STAGE_LABELS[lead.stage] ?? lead.stage}</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500" />
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Propiedades vinculadas */}
      <Card padded={false} className="p-5 sm:p-6">
        <Heading level={4} className="mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-400" />
          Propiedades vinculadas
          {contact.properties && contact.properties.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{contact.properties.length}</span>
          )}
        </Heading>
        {!contact.properties || contact.properties.length === 0 ? (
          <Text tone="muted">Sin propiedades vinculadas.</Text>
        ) : (
          <div className="space-y-2">
            {contact.properties.map(prop => (
              <Link key={prop.id} href={`/propiedades/${prop.id}`} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors group">
                <div>
                  <p className="text-sm font-medium text-ink">{prop.address}</p>
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
      </Card>

      {/* Modal editar contacto */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowEdit(false)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between rounded-t-2xl">
              <Heading level={4}>Editar contacto</Heading>
              <Button variant="ghost" onClick={() => setShowEdit(false)} aria-label="Cerrar" icon={<X className="w-5 h-5" />} className="!px-2" />
            </div>
            <div className="p-4 space-y-3">
              <Field label="Nombre completo" htmlFor="edit-full_name" required>
                <Input id="edit-full_name" value={editForm.full_name} onChange={e => setEditForm((f: any) => ({ ...f, full_name: e.target.value }))} autoFocus />
              </Field>
              <Field label="Tipo" htmlFor="edit-contact_type">
                <Select id="edit-contact_type" value={editForm.contact_type} onChange={e => setEditForm((f: any) => ({ ...f, contact_type: e.target.value }))} className="capitalize">
                  {CONTACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Teléfono" htmlFor="edit-phone">
                  <Input id="edit-phone" value={editForm.phone} onChange={e => setEditForm((f: any) => ({ ...f, phone: e.target.value }))} />
                </Field>
                <Field label="Email" htmlFor="edit-email">
                  <Input id="edit-email" type="email" value={editForm.email} onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))} />
                </Field>
              </div>
              <Field label="Barrio/Zona" htmlFor="edit-neighborhood">
                <Input id="edit-neighborhood" value={editForm.neighborhood} onChange={e => setEditForm((f: any) => ({ ...f, neighborhood: e.target.value }))} />
              </Field>
              <Field label="Notas" htmlFor="edit-notes">
                <Textarea id="edit-notes" rows={3} value={editForm.notes} onChange={e => setEditForm((f: any) => ({ ...f, notes: e.target.value }))} />
              </Field>
            </div>
            <div className="sticky bottom-0 bg-white border-t px-4 py-3 flex gap-2">
              <Button variant="outline" onClick={() => setShowEdit(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleSaveEdit} loading={saving} disabled={saving} className="flex-1">
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
