'use client'
import { useState } from 'react'
import { CheckCircle2, Loader2, Star, Home } from 'lucide-react'

type Props = {
  property: any
  orgName: string
  brandColor: string
}

export default function VisitFormClient({ property, orgName, brandColor }: Props) {
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    visitor_name: '',
    visitor_phone: '',
    visitor_email: '',
    rating: 0,
    likes: '',
    dislikes: '',
    would_buy: null as boolean | null,
    price_opinion: '',
    comments: '',
    how_found: '',
    current_situation: '',
    financing: '',
  })

  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.visitor_name.trim()) { setError('Por favor ingresá tu nombre'); return }
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/visit-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          property_id: property.id,
          org_id: property.org_id || 'org_mg',
        }),
      })
      const data = await res.json() as any
      if (data.success) {
        setSubmitted(true)
      } else {
        setError(data.error || 'Error al enviar')
      }
    } catch { setError('Error de conexión') }
    finally { setSubmitting(false) }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm max-w-md">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4" style={{ color: brandColor }} />
          <h1 className="text-xl font-bold text-gray-800 mb-2">&iexcl;Gracias por tu feedback!</h1>
          <p className="text-gray-500 text-sm mb-4">Tu opini&oacute;n sobre {property.address} fue registrada.</p>
          <p className="text-xs text-gray-400">{orgName}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="text-white py-6 px-4" style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}dd)` }}>
        <div className="max-w-lg mx-auto">
          <p className="text-xs opacity-80 mb-1">{orgName}</p>
          <h1 className="text-lg font-bold">Ficha de visita</h1>
          <div className="mt-3 bg-white/20 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <Home className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm">{property.address}</p>
                <p className="text-xs opacity-80">{property.neighborhood}, {property.city} &middot; {property.property_type} &middot; {property.rooms} amb</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-lg mx-auto p-4 -mt-2 space-y-4">
        {/* Contact */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-gray-800">Tus datos</h2>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo *</label>
            <input value={form.visitor_name} onChange={e => set('visitor_name', e.target.value)} required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': brandColor + '40' } as any}
              placeholder="Ej: Juan P&eacute;rez" />
          </div>
        </div>

        {/* Rating */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-gray-800">&iquest;Qu&eacute; te pareci&oacute; la propiedad?</h2>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Puntuaci&oacute;n general</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => set('rating', n)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    form.rating >= n ? 'text-yellow-500 bg-yellow-50 scale-110' : 'text-gray-300 bg-gray-50'
                  }`}>
                  <Star className="w-5 h-5" fill={form.rating >= n ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">&iquest;Qu&eacute; te gust&oacute;?</label>
            <textarea value={form.likes} onChange={e => set('likes', e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none"
              placeholder="Luminosidad, distribuci&oacute;n, ubicaci&oacute;n..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">&iquest;Qu&eacute; no te gust&oacute;?</label>
            <textarea value={form.dislikes} onChange={e => set('dislikes', e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none"
              placeholder="Ruido, estado, tama&ntilde;o..." />
          </div>
        </div>

        {/* Interest */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-gray-800">Inter&eacute;s</h2>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">&iquest;Comprar&iacute;as esta propiedad?</label>
            <div className="flex gap-2">
              {[
                { val: true, label: 'S&iacute;, me interesa', color: 'green' },
                { val: false, label: 'No, no es para m&iacute;', color: 'red' },
              ].map(opt => (
                <button key={String(opt.val)} type="button" onClick={() => set('would_buy', opt.val)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                    form.would_buy === opt.val
                      ? opt.color === 'green' ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-400 bg-red-50 text-red-600'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                  dangerouslySetInnerHTML={{ __html: opt.label }} />
              ))}
            </div>
          </div>
        </div>

        {/* Extra */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-gray-800">Informaci&oacute;n adicional</h2>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">&iquest;C&oacute;mo encontraste la propiedad?</label>
            <select value={form.how_found} onChange={e => set('how_found', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white">
              <option value="">Seleccionar...</option>
              <option value="zonaprop">ZonaProp</option>
              <option value="argenprop">ArgenProp</option>
              <option value="mercadolibre">MercadoLibre</option>
              <option value="instagram">Instagram</option>
              <option value="referido">Referido</option>
              <option value="cartel">Cartel en la propiedad</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">&iquest;Cu&aacute;l es tu situaci&oacute;n actual?</label>
            <select value={form.current_situation} onChange={e => set('current_situation', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white">
              <option value="">Seleccionar...</option>
              <option value="primera_vivienda">Primera vivienda</option>
              <option value="mudanza">Me quiero mudar</option>
              <option value="inversion">Inversi&oacute;n</option>
              <option value="familiar">Para un familiar</option>
              <option value="explorando">Solo explorando</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Comentarios adicionales <span className="text-gray-400">(¿Qu&eacute; valor pens&aacute;s que vale la propiedad?)</span></label>
            <textarea value={form.comments} onChange={e => set('comments', e.target.value)} rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none"
              placeholder="Ej: Me pareci&oacute; que vale alrededor de USD 150.000..." />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button type="submit" disabled={submitting}
          className="w-full text-white py-3.5 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
          style={{ backgroundColor: brandColor }}>
          {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : 'Enviar ficha de visita'}
        </button>

        <p className="text-center text-[10px] text-gray-400 pb-6">
          {orgName} &middot; Ficha de visita confidencial
        </p>
      </form>
    </div>
  )
}
