'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { getCurrentUser } from '@/lib/auth'
import { ContactSelector } from '@/components/ui/ContactSelector'
import { PhotoGallery } from '@/components/ui/PhotoGallery'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Heading } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'
import { fetchPropertyConfig, stagesForType, statusesForType } from '@/lib/property-config'
import type { PropertyConfig } from '@/lib/property-config'

const PROPERTY_TYPES = [
  { value: 'departamento', label: 'Departamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'ph', label: 'PH' },
  { value: 'local', label: 'Local' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'oficina', label: 'Oficina' },
]

export default function EditarPropiedadPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const { toast } = useToast()
  const currentUser = getCurrentUser()
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'supervisor'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [photos, setPhotos] = useState<{ id: string; url: string; sort_order: number }[]>([])
  const [ownerContact, setOwnerContact] = useState<{ id: string; full_name: string; phone?: string | null; email?: string | null } | null>(null)
  const [config, setConfig] = useState<PropertyConfig | null>(null)
  const [agents, setAgents] = useState<{ id: string; full_name: string }[]>([])
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
    operation_type_id: 1,
    commercial_stage_id: null as number | null,
    status_id: 1,
    agent_id: '',
  })

  useEffect(() => {
    if (isAdmin) {
      apiFetch('admin', '/agents')
        .then(r => r.json() as any)
        .then(d => setAgents(Array.isArray(d) ? d : (d.agents || [])))
        .catch(() => {})
    }
  }, [isAdmin])

  useEffect(() => {
    if (!id) return
    Promise.all([
      apiFetch('properties', `/properties/${id}`).then(r => r.json() as any),
      fetchPropertyConfig(),
    ]).then(([p, cfg]) => {
      if (p.error) { router.push('/propiedades'); return }
      setConfig(cfg)
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
        operation_type_id: p.operation_type_id ?? 1,
        commercial_stage_id: p.commercial_stage_id ?? null,
        status_id: p.status_id ?? 1,
        agent_id: p.agent_id || '',
      })
      if (p.contact_id) {
        setOwnerContact({ id: p.contact_id, full_name: p.owner_name || '', phone: p.owner_phone, email: p.owner_email })
      }
      setPhotos(p.photos || [])
      setLoading(false)
    }).catch(() => router.push('/propiedades'))
  }, [id, router])

  function update(field: string, value: string | number | null) {
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
      // Sync legacy text slug from selected ID
      const opType = config?.operation_types.find(t => t.id === form.operation_type_id)
      const stage = config?.commercial_stages.find(s => s.id === form.commercial_stage_id)
      const status = config?.property_statuses.find(s => s.id === form.status_id)
      const payload: any = {
        ...form,
        rooms: form.rooms ? Number(form.rooms) : null,
        size_m2: form.size_m2 ? Number(form.size_m2) : null,
        asking_price: form.asking_price ? Number(form.asking_price) : null,
        contact_id: ownerContact?.id ?? null,
        operation_type: opType?.slug ?? null,
        status: status?.slug ?? null,
        ...(isAdmin && form.agent_id ? { agent_id: form.agent_id } : {}),
      }
      // Only include stage fields when a stage is selected — avoid sending null which would clear them
      if (stage) {
        payload.commercial_stage = stage.slug
        payload.commercial_stage_id = stage.id
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

  const emptyConfig = { operation_types: [], commercial_stages: [], property_statuses: [] }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/propiedades/${id}`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-ink">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
      </div>

      <PageHeader
        title="Editar propiedad"
        actions={
          <Button onClick={handleSave} loading={saving} icon={<Save className="w-4 h-4" />}>
            Guardar
          </Button>
        }
      />

      <Card className="p-6 space-y-4">
        <Heading level={4}>Datos del inmueble</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Dirección" required className="col-span-2">
            <Input type="text" value={form.address} onChange={e => update('address', e.target.value)} />
          </Field>
          <Field label="Barrio">
            <Input type="text" value={form.neighborhood} onChange={e => update('neighborhood', e.target.value)} />
          </Field>
          <Field label="Ciudad">
            <Input type="text" value={form.city} onChange={e => update('city', e.target.value)} />
          </Field>
          <Field label="Tipo de inmueble">
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
              onChange={e => update('commercial_stage_id', e.target.value ? Number(e.target.value) : null)}>
              <option value="">Sin etapa</option>
              {stagesForType(config ?? emptyConfig, form.operation_type_id).map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Estado">
            <Select value={form.status_id}
              onChange={e => update('status_id', Number(e.target.value))}>
              {statusesForType(config ?? emptyConfig, form.operation_type_id).map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </Select>
          </Field>
          {isAdmin && agents.length > 0 && (
            <Field label="Agente responsable" className="col-span-2">
              <Select value={form.agent_id} onChange={e => update('agent_id', e.target.value)}>
                <option value="">Sin asignar</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.full_name}</option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Ambientes">
            <Input type="number" value={form.rooms} onChange={e => update('rooms', e.target.value)} />
          </Field>
          <Field label="Superficie (m²)">
            <Input type="number" value={form.size_m2} onChange={e => update('size_m2', e.target.value)} />
          </Field>
          <Field label="Moneda">
            <Select value={form.currency} onChange={e => update('currency', e.target.value)}>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </Select>
          </Field>
          <Field label="Precio">
            <Input type="number" value={form.asking_price} onChange={e => update('asking_price', e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <Heading level={4}>Propietario</Heading>
        <Field label="Vincular contacto (opcional)" hint="Seleccioná un contacto para auto-completar">
          <ContactSelector value={ownerContact} onChange={handleContactSelect} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nombre" className="col-span-2">
            <Input type="text" value={form.owner_name} onChange={e => update('owner_name', e.target.value)} />
          </Field>
          <Field label="Teléfono">
            <Input type="tel" value={form.owner_phone} onChange={e => update('owner_phone', e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.owner_email} onChange={e => update('owner_email', e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <Heading level={4}>Fotos</Heading>
        <PhotoGallery photos={photos} propertyId={id} editable />
      </Card>

      <div className="flex justify-end pb-8">
        <Button size="lg" onClick={handleSave} loading={saving} icon={<Save className="w-4 h-4" />}>
          Guardar cambios
        </Button>
      </div>
    </div>
  )
}
