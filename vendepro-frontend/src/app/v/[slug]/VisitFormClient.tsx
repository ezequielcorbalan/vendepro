'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, Home, MapPin, Star } from 'lucide-react'
import { getOrCreateVisitorId } from '@/lib/landings/tracker'
import { pushMarketingEvent } from '@/components/marketing/dataLayer'

type BuyIntention = 'compraria' | 'no'

type VisitSource =
  | ''
  | 'argenprop'
  | 'mercadolibre'
  | 'zonaprop'
  | 'instagram'
  | 'recomendacion'
  | 'otro'

type VisitSituation =
  | ''
  | 'mudanza'
  | 'primera_vivienda'
  | 'inversion'
  | 'downsizing'
  | 'otro'

const SOURCE_OPTIONS: { value: Exclude<VisitSource, ''>; label: string }[] = [
  { value: 'argenprop', label: 'Argenprop' },
  { value: 'mercadolibre', label: 'Mercado Libre' },
  { value: 'zonaprop', label: 'Zonaprop' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'recomendacion', label: 'Recomendación' },
  { value: 'otro', label: 'Otros' },
]

const SITUATION_OPTIONS: { value: Exclude<VisitSituation, ''>; label: string }[] = [
  { value: 'mudanza', label: 'Mudanza' },
  { value: 'primera_vivienda', label: 'Primera vivienda' },
  { value: 'inversion', label: 'Inversión' },
  { value: 'downsizing', label: 'Downsizing' },
  { value: 'otro', label: 'Otros' },
]

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
      submitted_at: string
    } | null
  }
}

export default function VisitFormClient({ slug, apiPublic, data }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(data.submitted)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    visitor_name: '',
    rating: 0,
    liked: '',
    disliked: '',
    buy_intention: '' as '' | BuyIntention,
    source: '' as VisitSource,
    situation: '' as VisitSituation,
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
          rating: form.rating > 0 ? form.rating : null,
          liked: form.liked.trim() || null,
          disliked: form.disliked.trim() || null,
          buy_intention: form.buy_intention || null,
          source: form.source || null,
          situation: form.situation || null,
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
            <div className="bg-brand-pink h-2" />
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-9 h-9 text-green-500" />
              </div>
              <h1 className="text-2xl font-semibold text-ink mb-2">¡Gracias!</h1>
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
                  <div className="font-medium text-ink">{p.address}</div>
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
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Cabecera con foto de la propiedad */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
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
            <div className="p-6">
              <div className="bg-brand-pink h-1 w-12 rounded-full mb-3" />
              <h1 className="text-xl font-semibold text-ink">{p.address}</h1>
              {addressLine && <p className="text-sm text-gray-500 mt-1">{addressLine}</p>}
            </div>
          )}
          <div className="p-5 sm:p-6 border-t border-gray-100">
            <h2 className="text-base font-semibold text-ink">Ficha de visita</h2>
            <p className="text-sm text-gray-500 mt-1">
              Gracias por visitar esta propiedad. Tu opinión nos ayuda a ajustar la
              comercialización — te toma menos de 2 minutos.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Card: Tus datos */}
          <Card title="Tus datos">
            <Field label="Nombre completo *">
              <input
                type="text"
                required
                value={form.visitor_name}
                onChange={(e) => setField('visitor_name', e.target.value)}
                placeholder="Ej: Juan Pérez"
                className="vp-input"
              />
            </Field>
          </Card>

          {/* Card: Opinión + rating */}
          <Card title="¿Qué te pareció la propiedad?">
            <div>
              <label className="block text-sm text-gray-600 mb-2">Puntuación general</label>
              <StarRating value={form.rating} onChange={(v) => setField('rating', v)} />
            </div>

            <Field label="¿Qué te gustó?">
              <textarea
                rows={3}
                value={form.liked}
                onChange={(e) => setField('liked', e.target.value)}
                placeholder="Luminosidad, distribución, ubicación…"
                className="vp-input resize-none"
              />
            </Field>

            <Field label="¿Qué no te gustó?">
              <textarea
                rows={3}
                value={form.disliked}
                onChange={(e) => setField('disliked', e.target.value)}
                placeholder="Ruido, estado, tamaño…"
                className="vp-input resize-none"
              />
            </Field>
          </Card>

          {/* Card: Interés */}
          <Card title="Interés">
            <div>
              <label className="block text-sm text-gray-600 mb-2">¿Comprarías esta propiedad?</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ChoiceButton
                  active={form.buy_intention === 'compraria'}
                  onClick={() => setField('buy_intention', 'compraria')}
                >
                  Sí, me interesa
                </ChoiceButton>
                <ChoiceButton
                  active={form.buy_intention === 'no'}
                  onClick={() => setField('buy_intention', 'no')}
                >
                  No, no es para mí
                </ChoiceButton>
              </div>
            </div>
          </Card>

          {/* Card: Información adicional */}
          <Card title="Información adicional">
            <Field label="¿Cómo encontraste la propiedad?">
              <select
                value={form.source}
                onChange={(e) => setField('source', e.target.value as VisitSource)}
                className="vp-input"
              >
                <option value="">Seleccionar…</option>
                {SOURCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="¿Cuál es tu situación actual?">
              <select
                value={form.situation}
                onChange={(e) => setField('situation', e.target.value as VisitSituation)}
                className="vp-input"
              >
                <option value="">Seleccionar…</option>
                {SITUATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Comentarios adicionales"
              hint="¿Qué valor pensás que vale la propiedad?"
            >
              <textarea
                rows={3}
                value={form.observations}
                onChange={(e) => setField('observations', e.target.value)}
                placeholder="Ej: Me pareció que vale alrededor de USD 150.000…"
                className="vp-input resize-none"
              />
            </Field>
          </Card>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-br from-brand-pink to-brand-orange hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando…
              </>
            ) : (
              'Enviar ficha de visita'
            )}
          </button>

          <p className="text-xs text-gray-400 text-center">
            {data.org.name} · Ficha de visita confidencial
          </p>
        </form>

        <div className="text-center text-xs text-gray-400">
          Potenciado por <span className="text-brand-pink font-semibold">VendéPro</span>
        </div>
      </div>

      <style>{`
        .vp-input {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.75rem;
          font-size: 0.95rem;
          background: white;
          color: #111827;
          transition: border-color 0.15s, box-shadow 0.15s;
          outline: none;
        }
        .vp-input::placeholder { color: #9ca3af; }
        .vp-input:focus {
          border-color: #ff007c;
          box-shadow: 0 0 0 3px rgba(255, 0, 124, 0.12);
        }
      `}</style>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6 space-y-4">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {children}
    </section>
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
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {hint && <span className="ml-1 text-gray-400 font-normal">({hint})</span>}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= value
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? 0 : n)}
            className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-colors ${
              active
                ? 'bg-yellow-50 border-yellow-300'
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}
            aria-label={`${n} estrellas`}
          >
            <Star
              className={`w-5 h-5 ${active ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
            />
          </button>
        )
      })}
    </div>
  )
}

function ChoiceButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-3 px-4 rounded-xl border text-sm font-medium transition-colors ${
        active
          ? 'bg-brand-pink border-brand-pink text-white'
          : 'bg-white border-gray-200 text-gray-700 hover:border-brand-pink/50 hover:bg-[#fff0f6]/40'
      }`}
    >
      {children}
    </button>
  )
}
