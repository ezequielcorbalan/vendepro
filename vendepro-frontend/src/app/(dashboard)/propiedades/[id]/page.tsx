'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, Loader2, Phone, Mail, User, MapPin, DollarSign, Calendar, Plus, Pencil, Send, Trash2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { PhotoGallery } from '@/components/ui/PhotoGallery'
import { VisitFormsSection } from '@/components/properties/VisitFormsSection'
import AuthorizationWidget from '@/components/properties/AuthorizationWidget'
import PriceHistoryWidget from '@/components/properties/PriceHistoryWidget'
import DocChecklistWidget from '@/components/properties/DocChecklistWidget'
import ReportsListWidget from '@/components/properties/ReportsListWidget'

const stageLabel: Record<string, string> = {
  captacion: 'Captación',
  publicada: 'Publicada',
  con_ofertas: 'Con ofertas',
  reservada: 'Reservada',
  vendida: 'Vendida',
  suspendida: 'Suspendida',
  perdida: 'Perdida',
  // Legacy
  captada: 'Captada',
  archivada: 'Archivada',
  documentacion: 'En documentación',
}
const stageColor: Record<string, string> = {
  captacion: 'bg-green-100 text-green-700',
  publicada: 'bg-blue-100 text-blue-700',
  con_ofertas: 'bg-violet-100 text-violet-700',
  reservada: 'bg-purple-100 text-purple-700',
  vendida: 'bg-emerald-100 text-emerald-700',
  suspendida: 'bg-orange-100 text-orange-700',
  perdida: 'bg-red-100 text-red-700',
  // Legacy
  captada: 'bg-green-100 text-green-700',
  archivada: 'bg-gray-100 text-gray-500',
  documentacion: 'bg-amber-100 text-amber-700',
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

  const stage = property.commercial_stage || 'captacion'

  return (
    <div>
      <Link href="/propiedades" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver a Propiedades
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 relative overflow-hidden border border-gray-200">
        <img
          src="/brand/GV-27.png"
          alt=""
          aria-hidden="true"
          className="absolute -top-6 -right-6 w-40 h-40 opacity-10 pointer-events-none"
        />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ff007c] to-[#ff8017] flex items-center justify-center flex-shrink-0 shadow-sm">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-800">{property.address}</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {[property.neighborhood, property.city].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${stageColor[stage] || 'bg-gray-100 text-gray-600'}`}>
              {stageLabel[stage] || stage}
            </span>
            <Link href={`/tasaciones/nueva?property_id=${id}`}
              className="inline-flex items-center gap-1.5 bg-[#ff007c] text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90">
              <Plus className="w-4 h-4" /> Nueva tasación
            </Link>
            <button
              onClick={() => setShowGenerate(true)}
              className="inline-flex items-center gap-1.5 bg-[#ff8017] text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90"
            >
              <Send className="w-4 h-4" /> Enviar ficha de visita
            </button>
            <Link href={`/propiedades/${id}/editar`}
              className="inline-flex items-center gap-1.5 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50">
              <Pencil className="w-4 h-4" /> Editar
            </Link>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" /> Eliminar
            </button>
          </div>
        </div>
      </div>

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
          {property.owner_name && property.owner_name !== 'Sin propietario' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                {property.contact_id ? (
                  <Link href={`/contactos/${property.contact_id}`} className="text-[#ff007c] hover:underline font-medium">
                    {property.owner_name}
                  </Link>
                ) : (
                  <span className="text-gray-800 font-medium">{property.owner_name}</span>
                )}
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

      {/* Galería de fotos */}
      {photos.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Fotos</h2>
          <PhotoGallery photos={photos} propertyId={id} editable={false} />
        </div>
      )}

      {/* Fichas de visita */}
      <div className="mt-6">
        <VisitFormsSection propertyId={id} refreshKey={visitRefreshKey} />
      </div>

      {showGenerate && (
        <GenerateVisitFormModal
          propertyId={id}
          onClose={() => setShowGenerate(false)}
          onGenerated={() => setVisitRefreshKey((k) => k + 1)}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Eliminar propiedad</h3>
                <p className="text-sm text-gray-500">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              ¿Estás segura de que querés eliminar <span className="font-medium">{property?.address}</span>? Se eliminarán también sus fotos y datos asociados.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
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

  const whatsappText = encodeURIComponent(
    `Hola, te mando la ficha de visita de la propiedad. Si podés completarla nos ayuda un montón:\n${publicUrl}`,
  )

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
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#ff8017] h-1.5" />
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900">Ficha de visita</h3>
          <p className="text-sm text-gray-500 mt-1">
            Compartí este link con la persona que visitó la propiedad. Se guardará la respuesta
            automáticamente.
          </p>

          {loading && (
            <div className="py-10 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#ff007c]" />
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {!loading && !error && slug && (
            <>
              <div className="mt-5">
                <label className="block text-xs text-gray-500 mb-1">Link público</label>
                <div className="flex items-stretch gap-2">
                  <input
                    readOnly
                    value={publicUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700"
                  />
                  <button
                    onClick={copyLink}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-3 rounded-lg whitespace-nowrap"
                  >
                    {copied ? '¡Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>

              <a
                href={`https://wa.me/?text=${whatsappText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5b] text-white font-medium py-2.5 rounded-lg"
              >
                Abrir WhatsApp
              </a>
            </>
          )}

          <button
            onClick={onClose}
            className="mt-5 w-full border border-gray-200 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
