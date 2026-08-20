'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, Loader2, Phone, Mail, User, Plus, Pencil, Send, Trash2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Heading, Text } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'
import { WhatsAppButton } from '@/components/ui/ContactButtons'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Alert } from '@/components/ui/Alert'
import { Modal } from '@/components/ui/Modal'
import { Field, Input } from '@/components/ui/Input'
import { PhotoGallery } from '@/components/ui/PhotoGallery'
import { VisitFormsSection } from '@/components/properties/VisitFormsSection'
import { InterestedLeadsSection } from '@/components/properties/InterestedLeadsSection'
import AuthorizationWidget from '@/components/properties/AuthorizationWidget'
import PriceHistoryWidget from '@/components/properties/PriceHistoryWidget'
import DocChecklistWidget from '@/components/properties/DocChecklistWidget'
import ReportsListWidget from '@/components/properties/ReportsListWidget'
import { PROPERTY_STAGES, type PropertyStage } from '@/lib/crm-config'

// Sólo "captacion" y "con_ofertas" son slugs legacy que ya no existen como
// clave en PROPERTY_STAGES (se renombraron a "captada"/"reservada"); el resto
// de las claves de esta pantalla ya son canónicas. Label y color salen de
// PROPERTY_STAGES (crm-config), no se duplican acá.
const LEGACY_STAGE_ALIASES: Record<string, PropertyStage> = {
  captacion: 'captada',
  con_ofertas: 'reservada',
}
function resolveStage(slug: string): PropertyStage {
  return (LEGACY_STAGE_ALIASES[slug] ?? slug) as PropertyStage
}

export default function PropiedadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const [property, setProperty] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [photos, setPhotos] = useState<{ id: string; url: string; sort_order: number }[]>([])
  const [showGenerate, setShowGenerate] = useState(false)
  const [visitRefreshKey, setVisitRefreshKey] = useState(0)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await apiFetch('properties', `/properties/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/propiedades')
      }
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  useEffect(() => {
    if (!id) return
    apiFetch('properties', `/properties/${id}`)
      .then(r => (r.json()) as any)
      .then((d: any) => {
        if (d?.error) { setError(true); setLoading(false); return }
        setProperty(d)
        setPhotos(d.photos || [])
        setLoading(false)
      })
      .catch(() => { setError(true); setLoading(false) })
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !property) {
    return (
      <div>
        <Link href="/propiedades" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-ink mb-6">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
        <Alert tone="danger">Error cargando la propiedad</Alert>
      </div>
    )
  }

  const stage = property.commercial_stage || 'captacion'

  return (
    <div>
      <Link href="/propiedades" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-ink mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver a Propiedades
      </Link>

      {/* Header (hero propio de pantalla de detalle) */}
      <Card className="p-6 mb-6 relative overflow-hidden">
        <img
          src="/brand/GV-27.png"
          alt=""
          aria-hidden="true"
          className="absolute -top-6 -right-6 w-40 h-40 opacity-10 pointer-events-none"
        />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-card bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center flex-shrink-0 shadow-card">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <Heading level={3} as="h1">{property.address}</Heading>
              <Text tone="muted" className="mt-0.5">
                {[property.neighborhood, property.city].filter(Boolean).join(' · ')}
              </Text>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge
              label={PROPERTY_STAGES[resolveStage(stage)]?.label ?? stage}
              color={PROPERTY_STAGES[resolveStage(stage)]?.color}
              className="whitespace-nowrap"
            />
            {(property as any).source === 'kiteprop' && (
              // ds-todo: candidato a badge de origen/integración (color fuera de tokens)
              <StatusBadge
                label="Importada de KiteProp"
                color="bg-indigo-50 text-indigo-600 border border-indigo-100"
                className="whitespace-nowrap"
              />
            )}
            <Link href={`/tasaciones/nueva?property_id=${id}`}
              className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-control text-sm font-medium hover:bg-primary-hover">
              <Plus className="w-4 h-4" /> Nueva tasación
            </Link>
            <Button onClick={() => setShowGenerate(true)} icon={<Send className="w-4 h-4" />}>
              Enviar ficha de visita
            </Button>
            <Link href={`/propiedades/${id}/editar`}
              className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-control text-sm font-medium hover:bg-gray-50">
              <Pencil className="w-4 h-4" /> Editar
            </Link>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              icon={<Trash2 className="w-4 h-4" />}
              className="text-danger border-danger/30 hover:bg-danger/10"
            >
              Eliminar
            </Button>
          </div>
        </div>
      </Card>

      {/* Widgets operativos: autorización + precio + docs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <AuthorizationWidget
          propertyId={id}
          authStartDate={property.auth_start_date || null}
          authDurationDays={property.auth_duration_days || null}
          onUpdate={v => setProperty({ ...property, ...v })}
        />
        <PriceHistoryWidget
          propertyId={id}
          currentPrice={property.asking_price}
          currency={property.currency || 'USD'}
          onPriceChanged={newPrice => setProperty({ ...property, asking_price: newPrice })}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <DocChecklistWidget
          propertyId={id}
          docStatusJson={property.doc_status_json || null}
          capturedAt={property.created_at || null}
        />
        <ReportsListWidget propertyId={id} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Datos del inmueble */}
        <Card className="p-6">
          <Heading level={4} className="mb-4">Inmueble</Heading>
          <dl className="space-y-3">
            {property.property_type && (
              <div className="flex justify-between gap-2">
                <Text as="dt" tone="muted">Tipo</Text>
                <Text as="dd" weight="medium" className="capitalize">{property.property_type}</Text>
              </div>
            )}
            {property.rooms && (
              <div className="flex justify-between gap-2">
                <Text as="dt" tone="muted">Ambientes</Text>
                <Text as="dd" weight="medium">{property.rooms}</Text>
              </div>
            )}
            {property.size_m2 && (
              <div className="flex justify-between gap-2">
                <Text as="dt" tone="muted">Superficie</Text>
                <Text as="dd" weight="medium">{property.size_m2} m²</Text>
              </div>
            )}
            {property.asking_price && (
              <div className="flex justify-between gap-2">
                <Text as="dt" tone="muted">Precio</Text>
                <Text as="dd" weight="medium" tone="primary">
                  {property.currency} {Number(property.asking_price).toLocaleString('es-AR')}
                </Text>
              </div>
            )}
          </dl>
        </Card>

        {/* Propietario */}
        <Card className="p-6">
          <Heading level={4} className="mb-4">Propietario</Heading>
          {property.owner_name && property.owner_name !== 'Sin propietario' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                {property.contact_id ? (
                  <Link href={`/contactos/${property.contact_id}`} className="text-primary hover:underline font-medium">
                    {property.owner_name}
                  </Link>
                ) : (
                  <Text as="span" weight="medium">{property.owner_name}</Text>
                )}
              </div>
              {property.owner_phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <a href={`tel:${property.owner_phone}`} className="text-primary hover:underline">{property.owner_phone}</a>
                </div>
              )}
              {property.owner_email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <a href={`mailto:${property.owner_email}`} className="text-primary hover:underline">{property.owner_email}</a>
                </div>
              )}
            </div>
          ) : (
            <Text tone="muted">Sin datos del propietario</Text>
          )}
        </Card>

        {/* Agente */}
        {property.agent_name && (
          <Card className="p-6">
            <Heading level={4} className="mb-4">Agente</Heading>
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <Text as="span" weight="medium">{property.agent_name}</Text>
            </div>
          </Card>
        )}

        {/* Fechas */}
        <Card className="p-6">
          <Heading level={4} className="mb-4">Historial</Heading>
          <dl className="space-y-3">
            {property.created_at && (
              <div className="flex justify-between gap-2">
                <Text as="dt" tone="muted">Captada</Text>
                <Text as="dd" weight="medium">
                  {new Date(property.created_at).toLocaleDateString('es-AR')}
                </Text>
              </div>
            )}
            {property.updated_at && (
              <div className="flex justify-between gap-2">
                <Text as="dt" tone="muted">Última actualización</Text>
                <Text as="dd" weight="medium">
                  {new Date(property.updated_at).toLocaleDateString('es-AR')}
                </Text>
              </div>
            )}
          </dl>
        </Card>
      </div>

      {/* Galería de fotos */}
      {photos.length > 0 && (
        <Card className="p-6 mt-6">
          <Heading level={4} className="mb-4">Fotos</Heading>
          <PhotoGallery photos={photos} propertyId={id} editable={false} />
        </Card>
      )}

      {/* Fichas de visita */}
      <div className="mt-6">
        <VisitFormsSection propertyId={id} refreshKey={visitRefreshKey} />

        <InterestedLeadsSection propertyId={id} />
      </div>

      {showGenerate && (
        <GenerateVisitFormModal
          propertyId={id}
          onClose={() => setShowGenerate(false)}
          onGenerated={() => setVisitRefreshKey((k) => k + 1)}
        />
      )}

      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Eliminar propiedad"
        icon={<Trash2 className="w-5 h-5" />}
        danger
        footer={
          <>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancelar
            </Button>
            <Button variant="danger" loading={deleting} icon={<Trash2 className="w-4 h-4" />} onClick={handleDelete}>
              Eliminar
            </Button>
          </>
        }
      >
        <p className="font-medium">Esta acción no se puede deshacer.</p>
        <p className="mt-2">
          ¿Estás segura de que querés eliminar <span className="font-medium text-ink">{property?.address}</span>? Se eliminarán también sus fotos y datos asociados.
        </p>
      </Modal>
    </div>
  )
}

// ── Modal para generar link de ficha de visita ─────────────────────
function GenerateVisitFormModal({
  propertyId,
  onClose,
  onGenerated,
}: {
  propertyId: string
  onClose: () => void
  onGenerated: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [slug, setSlug] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const fired = useRef(false)

  useEffect(() => {
    // Guard against React StrictMode double-fire that creates duplicate links
    // and may cause race conditions / weird response shapes.
    if (fired.current) return
    fired.current = true

    ;(async () => {
      try {
        const res = await apiFetch('properties', '/visit-forms/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ property_id: propertyId }),
        })
        const text = await res.text()
        if (!res.ok) {
          let msg = text
          try { msg = (JSON.parse(text) as any)?.error || text } catch { /* keep raw */ }
          throw new Error(msg || `HTTP ${res.status}`)
        }
        let parsed: any
        try {
          parsed = JSON.parse(text)
        } catch {
          throw new Error(`Respuesta inválida del servidor: ${text.slice(0, 80)}`)
        }
        if (!parsed?.slug) throw new Error('La respuesta no incluyó el slug')
        setSlug(parsed.slug)
        onGenerated()
      } catch (e: any) {
        setError(e?.message || 'Error generando el link')
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId])

  const publicUrl = slug
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://app.vendepro.com.ar'}/v/${slug}`
    : ''

  const shareMessage = `Hola, te mando la ficha de visita de la propiedad. Si podés completarla nos ayuda un montón:\n${publicUrl}`

  async function copyLink() {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback no-op
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Ficha de visita"
      icon={<Send className="w-5 h-5" />}
      footer={
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <p>
        Compartí este link con la persona que visitó la propiedad. Se guardará la respuesta
        automáticamente.
      </p>

      {loading && (
        <div className="py-10 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      )}

      {!loading && !error && slug && (
        <>
          <Field label="Link público" className="mt-5">
            <div className="flex items-stretch gap-2">
              <Input
                readOnly
                value={publicUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 bg-gray-50"
              />
              <Button variant="outline" onClick={copyLink} className="whitespace-nowrap">
                {copied ? '¡Copiado!' : 'Copiar'}
              </Button>
            </div>
          </Field>

          <WhatsAppButton
            share
            label="Abrir WhatsApp"
            message={shareMessage}
            className="mt-3 w-full justify-center py-2.5"
          />
        </>
      )}
    </Modal>
  )
}
