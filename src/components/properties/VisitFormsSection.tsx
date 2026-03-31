'use client'
import { useState, useEffect } from 'react'
import { ClipboardList, Share2, Star, ThumbsUp, ThumbsDown, User, Phone, Mail, Trash2, Copy, CheckCircle2, MessageCircle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

const PRICE_LABELS: Record<string, string> = {
  muy_caro: 'Muy caro', algo_caro: 'Algo caro', justo: 'Precio justo',
  buen_precio: 'Buen precio', oportunidad: 'Una oportunidad',
}
const SITUATION_LABELS: Record<string, string> = {
  primera_vivienda: 'Primera vivienda', mudanza: 'Mudanza', inversion: 'Inversi\u00f3n',
  familiar: 'Para familiar', explorando: 'Explorando',
}
const FINANCING_LABELS: Record<string, string> = {
  contado: 'Contado', credito_hipotecario: 'Cr\u00e9dito hipotecario',
  parte_contado_credito: 'Parte contado + cr\u00e9dito', permuta: 'Permuta', otros: 'Otros',
}

export default function VisitFormsSection({ propertyId, propertySlug }: { propertyId: string; propertySlug: string }) {
  const { toast } = useToast()
  const [forms, setForms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const visitUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/v/${propertySlug}`
    : `/v/${propertySlug}`

  useEffect(() => {
    fetch(`/api/visit-forms?property_id=${propertyId}`)
      .then(r => r.json() as Promise<any>)
      .then(d => { if (Array.isArray(d)) setForms(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [propertyId])

  const copyLink = () => {
    navigator.clipboard.writeText(visitUrl)
    setCopied(true)
    toast('Link copiado')
    setTimeout(() => setCopied(false), 2000)
  }

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`Hola! Complet\u00e1 la ficha de visita de la propiedad: ${visitUrl}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const deleteForm = async (id: string) => {
    if (!confirm('\u00bfEliminar esta ficha?')) return
    await fetch(`/api/visit-forms?id=${id}`, { method: 'DELETE' })
    setForms(prev => prev.filter(f => f.id !== id))
    toast('Ficha eliminada', 'warning')
  }

  return (
    <div className="bg-white rounded-xl shadow-sm mb-6">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#ff007c]" />
            <h2 className="text-lg font-semibold text-gray-800">Fichas de visita</h2>
            {forms.length > 0 && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{forms.length}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={shareWhatsApp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors">
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </button>
            <button onClick={copyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado' : 'Copiar link'}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Compart&iacute; el link con los visitantes para que completen su ficha despu&eacute;s de la visita.
        </p>
      </div>

      {loading ? (
        <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-[#ff007c] border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : forms.length === 0 ? (
        <div className="p-8 text-center">
          <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400 mb-3">Sin fichas de visita a&uacute;n</p>
          <button onClick={shareWhatsApp}
            className="text-sm text-[#ff007c] font-medium hover:underline">
            Enviar formulario por WhatsApp
          </button>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {forms.map(f => (
            <div key={f.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-800 flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    {f.visitor_name}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    {f.visitor_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{f.visitor_phone}</span>}
                    {f.visitor_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{f.visitor_email}</span>}
                    {f.created_at && <span>{new Date(f.created_at).toLocaleDateString('es-AR')}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {f.rating && (
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map(n => (
                        <Star key={n} className={`w-3.5 h-3.5 ${n <= f.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-200'}`} />
                      ))}
                    </div>
                  )}
                  <button onClick={() => deleteForm(f.id)} className="p-1 text-gray-300 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {f.likes && (
                  <div className="bg-green-50 rounded-lg p-2.5">
                    <span className="font-medium text-green-700 flex items-center gap-1 mb-1"><ThumbsUp className="w-3 h-3" /> Le gust&oacute;</span>
                    <p className="text-green-600">{f.likes}</p>
                  </div>
                )}
                {f.dislikes && (
                  <div className="bg-red-50 rounded-lg p-2.5">
                    <span className="font-medium text-red-700 flex items-center gap-1 mb-1"><ThumbsDown className="w-3 h-3" /> No le gust&oacute;</span>
                    <p className="text-red-600">{f.dislikes}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mt-2">
                {f.would_buy !== null && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${f.would_buy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {f.would_buy ? 'Comprar\u00eda' : 'No comprar\u00eda'}
                  </span>
                )}
                {f.price_opinion && <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{PRICE_LABELS[f.price_opinion] || f.price_opinion}</span>}
                {f.financing && <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{FINANCING_LABELS[f.financing] || f.financing}</span>}
                {f.current_situation && <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{SITUATION_LABELS[f.current_situation] || f.current_situation}</span>}
                {f.how_found && <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">V\u00eda: {f.how_found}</span>}
              </div>

              {f.comments && <p className="text-xs text-gray-500 mt-2 italic">&quot;{f.comments}&quot;</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
