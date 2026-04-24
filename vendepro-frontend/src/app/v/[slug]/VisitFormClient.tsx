'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, Home, MapPin } from 'lucide-react'
import { getOrCreateVisitorId } from '@/lib/landings/tracker'
import { pushMarketingEvent } from '@/components/marketing/dataLayer'

interface Props {
  slug: string
  apiPublic: string
  data: {
    slug: string
    submitted: boolean
    property: {
      id: string
      address: string
      neighborhood: string | null
      city: string | null
      cover_photo: string | null
      asking_price: number | null
      currency: string | null
    }
    org: {
      id: string
      name: string
      logo_url: string | null
      brand_color: string | null
    }
    response: {
      visitor_name: string | null
      visitor_email: string | null
      visitor_phone: string | null
      liked: string | null
      disliked: string | null
      subjective_price_usd: number | null
      buy_intention: string | null
      observations: string | null
      submitted_at: string
    } | null
  }
}

const intentionLabel: Record<string, string> = {
  compraria: 'Sí, la compraría',
  tal_vez: 'Tal vez',
  no: 'No me interesa',
}

export default function VisitFormClient({ slug, apiPublic, data }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(data.submitted)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    visitor_name: '',
    visitor_email: '',
    visitor_phone: '',
    liked: '',
    disliked: '',
    subjective_price_usd: '',
    buy_intention: '' as '' | 'compraria' | 'tal_vez' | 'no',
    observations: '',
  })

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.visitor_name.trim()) {
      setError('Por favor ingresá tu nombre.')
      return
    }

    setSubmitting(true)
    try {
      const visitorId = getOrCreateVisitorId()
      const res = await fetch(`${apiPublic}/public/property-visit-form/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitor_name: form.visitor_name.trim(),
          visitor_email: form.visitor_email.trim() || null,
          visitor_phone: form.visitor_phone.trim() || null,
          liked: form.liked.trim() || null,
          disliked: form.disliked.trim() || null,
          subjective_price_usd:
            form.subjective_price_usd.trim() === '' ? null : Number(form.subjective_price_usd),
          buy_intention: form.buy_intention || null,
          observations: form.observations.trim() || null,
          ga4_client_id: visitorId,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as any
        throw new Error(body?.error || 'No se pudo enviar el formulario.')
      }
      const body = (await res.json().catch(() => ({}))) as any
      if (body?.marketing?.event_id) {
        pushMarketingEvent({
          event_id: body.marketing.event_id,
          event_name:
            body.marketing.meta?.event_name ||
            body.marketing.ga4?.event_name ||
            'visit_form_submitted',
          entity_type: 'visit_form',
          entity_id: slug,
        })
      }
      setDone(true)
    } catch (e: any) {
      setError(e?.message || 'Error enviando el formulario.')
    } finally {
      setSubmitting(false)
    }
  }

  const p = data.property
  const addressLine = [p.neighborhood, p.city].filter(Boolean).join(' · ')

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#fff0f6] to-white py-10 px-4">
        <div className="max-w-xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-[#ff007c] h-2" />
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-9 h-9 text-green-500" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">¡Gracias!</h1>
              <p className="text-gray-600">
                Tu ficha de visita fue enviada correctamente. El agente la revisará para hacerte llegar
                más información.
              </p>
              {p.address && (
                <div className="mt-6 p-4 rounded-xl bg-gray-50 border border-gray-100 text-left">
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                    <Home className="w-4 h-4" />
                    Propiedad visitada
                  </div>
                  <div className="font-medium text-gray-900">{p.address}</div>
                  {addressLine && <div className="text-sm text-gray-500 mt-0.5">{addressLine}</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fff0f6] to-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Cabecera con foto de la propiedad */}
          {p.cover_photo ? (
            <div className="relative h-40 w-full bg-gray-100">
              <img src={p.cover_photo} alt={p.address} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 text-white">
                <h1 className="text-lg font-semibold leading-tight">{p.address}</h1>
                {addressLine && (
                  <div className="flex items-center gap-1.5 text-xs opacity-90 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {addressLine}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#ff007c] h-2" />
          )}

          <div className="p-6 sm:p-8">
            {!p.cover_photo && (
              <div className="mb-5">
                <h1 className="text-xl font-semibold text-gray-900">{p.address}</h1>
                {addressLine && <p className="text-sm text-gray-500 mt-1">{addressLine}</p>}
              </div>
            )}

            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Ficha de visita</h2>
              <p className="text-sm text-gray-500 mt-1">
                Gracias por visitar esta propiedad. Tu opinión nos ayuda a ajustar la comercialización —
                te toma menos de 2 minutos.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nombre *">
                  <input
                    type="text"
                    required
                    value={form.visitor_name}
                    onChange={(e) => setField('visitor_name', e.target.value)}
                    className="input"
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={form.visitor_email}
                    onChange={(e) => setField('visitor_email', e.target.value)}
                    className="input"
                  />
                </Field>
              </div>

              <Field label="Teléfono">
                <input
                  type="tel"
                  value={form.visitor_phone}
                  onChange={(e) => setField('visitor_phone', e.target.value)}
                  className="input"
                />
              </Field>

              <Field label="¿Qué te gustó de la propiedad?">
                <textarea
                  rows={3}
                  value={form.liked}
                  onChange={(e) => setField('liked', e.target.value)}
                  className="input resize-none"
                  placeholder="Ubicación, luz, ambientes, etc."
                />
              </Field>

              <Field label="¿Qué no te gustó o te preocupa?">
                <textarea
                  rows={3}
                  value={form.disliked}
                  onChange={(e) => setField('disliked', e.target.value)}
                  className="input resize-none"
                  placeholder="Mantenimiento, distribución, ruido, etc."
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Precio subjetivo (USD)" hint="Cuánto pagarías por esta propiedad">
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={form.subjective_price_usd}
                    onChange={(e) => setField('subjective_price_usd', e.target.value)}
                    className="input"
                    placeholder="Ej: 150000"
                  />
                </Field>
                <Field label="Intención de compra">
                  <select
                    value={form.buy_intention}
                    onChange={(e) =>
                      setField('buy_intention', e.target.value as typeof form.buy_intention)
                    }
                    className="input"
                  >
                    <option value="">Seleccioná una opción</option>
                    <option value="compraria">Sí, la compraría</option>
                    <option value="tal_vez">Tal vez</option>
                    <option value="no">No me interesa</option>
                  </select>
                </Field>
              </div>

              <Field label="Observaciones">
                <textarea
                  rows={3}
                  value={form.observations}
                  onChange={(e) => setField('observations', e.target.value)}
                  className="input resize-none"
                  placeholder="Cualquier comentario adicional"
                />
              </Field>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#ff007c] hover:bg-[#e6006f] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar ficha'
                )}
              </button>

              <p className="text-xs text-gray-400 text-center">
                Al enviar este formulario, tus respuestas quedan registradas con {data.org.name}.
              </p>
            </form>
          </div>
        </div>

        <div className="text-center mt-4 text-xs text-gray-400">
          Potenciado por <span className="text-[#ff007c] font-semibold">VendéPro</span>
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          padding: 0.625rem 0.875rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.625rem;
          font-size: 0.9rem;
          background: white;
          transition: border-color 0.15s, box-shadow 0.15s;
          outline: none;
        }
        .input:focus {
          border-color: #ff007c;
          box-shadow: 0 0 0 3px rgba(255, 0, 124, 0.12);
        }
      `}</style>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  )
}
