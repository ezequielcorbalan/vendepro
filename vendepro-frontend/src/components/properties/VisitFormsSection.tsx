'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Loader2, MessageSquare, Clock, DollarSign, ThumbsUp, ThumbsDown } from 'lucide-react'
import { apiFetch } from '@/lib/api'

type BuyIntention = 'compraria' | 'tal_vez' | 'no' | null

interface VisitForm {
  id: string
  slug: string
  visitor_name: string | null
  visitor_email: string | null
  visitor_phone: string | null
  liked: string | null
  disliked: string | null
  subjective_price_usd: number | null
  buy_intention: BuyIntention
  observations: string | null
  submitted_at: string | null
  sent_at: string
  created_at: string
}

const intentionMeta: Record<string, { label: string; cls: string }> = {
  compraria: { label: 'Compraría', cls: 'bg-green-100 text-green-700' },
  tal_vez: { label: 'Tal vez', cls: 'bg-amber-100 text-amber-700' },
  no: { label: 'No le interesa', cls: 'bg-gray-100 text-gray-600' },
}

export function VisitFormsSection({
  propertyId,
  refreshKey = 0,
}: {
  propertyId: string
  refreshKey?: number
}) {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<VisitForm[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    apiFetch('properties', `/visit-forms?property_id=${propertyId}`)
      .then(async (r) => {
        const body = (await r.json()) as any
        if (!r.ok) throw new Error(body?.error || 'Error')
        setItems(Array.isArray(body) ? body : [])
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [propertyId, refreshKey])

  const submitted = items.filter((i) => i.submitted_at !== null)
  const pending = items.filter((i) => i.submitted_at === null)

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
          Fichas de visita
        </h2>
        <div className="text-xs text-gray-400">
          {submitted.length} {submitted.length === 1 ? 'respuesta' : 'respuestas'}
          {pending.length > 0 && ` · ${pending.length} pendiente${pending.length > 1 ? 's' : ''}`}
        </div>
      </div>

      {loading ? (
        <div className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#ff007c]" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center">
          <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Todavía no hay fichas de visita.</p>
          <p className="text-xs text-gray-400 mt-1">
            Generá un link y compartilo con el comprador después de la visita.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {submitted.map((item) => (
            <SubmittedCard
              key={item.id}
              item={item}
              open={expanded === item.id}
              onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
            />
          ))}

          {pending.length > 0 && (
            <details className="pt-2">
              <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 select-none">
                Ver {pending.length} link{pending.length > 1 ? 's' : ''} pendiente
                {pending.length > 1 ? 's' : ''}
              </summary>
              <div className="mt-2 space-y-2">
                {pending.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between border border-dashed border-gray-200 rounded-lg px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 text-gray-500">
                      <Clock className="w-3.5 h-3.5" />
                      Enviado {formatDate(p.sent_at)}
                    </div>
                    <code className="text-gray-400">/v/{p.slug}</code>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

function SubmittedCard({
  item,
  open,
  onToggle,
}: {
  item: VisitForm
  open: boolean
  onToggle: () => void
}) {
  const intention = item.buy_intention ? intentionMeta[item.buy_intention] : null

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 truncate">
              {item.visitor_name || 'Visitante'}
            </span>
            {intention && (
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${intention.cls}`}>
                {intention.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {item.submitted_at ? formatDate(item.submitted_at) : '—'}
            </span>
            {item.subjective_price_usd !== null && (
              <span className="inline-flex items-center gap-1 text-[#ff007c] font-medium">
                <DollarSign className="w-3 h-3" />
                USD {Number(item.subjective_price_usd).toLocaleString('es-AR')}
              </span>
            )}
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50 space-y-3 text-sm">
          {(item.visitor_email || item.visitor_phone) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              {item.visitor_email && <span>{item.visitor_email}</span>}
              {item.visitor_phone && <span>{item.visitor_phone}</span>}
            </div>
          )}

          {item.liked && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-green-700 mb-1">
                <ThumbsUp className="w-3.5 h-3.5" /> Le gustó
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{item.liked}</p>
            </div>
          )}

          {item.disliked && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-red-700 mb-1">
                <ThumbsDown className="w-3.5 h-3.5" /> No le gustó
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{item.disliked}</p>
            </div>
          )}

          {item.observations && (
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Observaciones</div>
              <p className="text-gray-700 whitespace-pre-wrap">{item.observations}</p>
            </div>
          )}

          {!item.liked && !item.disliked && !item.observations && (
            <p className="text-xs text-gray-400 italic">Sin comentarios adicionales.</p>
          )}
        </div>
      )}
    </div>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}
