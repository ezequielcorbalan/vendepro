'use client'

import { useEffect, useState } from 'react'
import {
  Loader2,
  MessageSquare,
  ClipboardList,
  Star,
  ThumbsUp,
  ThumbsDown,
  Archive,
  ArchiveRestore,
  Trash2,
  Copy,
  Check,
  User,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { EmptyState } from '@/components/ui/EmptyState'

type BuyIntention = 'compraria' | 'tal_vez' | 'no' | null

interface VisitForm {
  id: string
  slug: string
  visitor_name: string | null
  visitor_email: string | null
  visitor_phone: string | null
  rating: number | null
  liked: string | null
  disliked: string | null
  subjective_price_usd: number | null
  buy_intention: BuyIntention
  source: string | null
  situation: string | null
  observations: string | null
  submitted_at: string | null
  archived_at: string | null
  deleted_at: string | null
  sent_at: string
  created_at: string
}

const SOURCE_LABEL: Record<string, string> = {
  argenprop: 'Argenprop',
  mercadolibre: 'Mercado Libre',
  zonaprop: 'Zonaprop',
  instagram: 'Instagram',
  recomendacion: 'Recomendación',
  otro: 'Otros',
}

const SITUATION_LABEL: Record<string, string> = {
  mudanza: 'Mudanza',
  primera_vivienda: 'Primera vivienda',
  inversion: 'Inversión',
  downsizing: 'Downsizing',
  otro: 'Otros',
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
  const [showArchived, setShowArchived] = useState(false)
  const [copied, setCopied] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [internalRefresh, setInternalRefresh] = useState(0)

  useEffect(() => {
    setLoading(true)
    const qs = `property_id=${propertyId}${showArchived ? '&include_archived=1' : ''}`
    apiFetch('properties', `/visit-forms?${qs}`)
      .then(async (r) => {
        const body = (await r.json()) as any
        if (!r.ok) throw new Error(body?.error || 'Error')
        setItems(Array.isArray(body) ? body : [])
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [propertyId, refreshKey, showArchived, internalRefresh])

  const submitted = items.filter((i) => i.submitted_at !== null)
  const pending = items.filter((i) => i.submitted_at === null && i.archived_at === null)
  const lastPending = pending[0]
  const publicLink = lastPending
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/v/${lastPending.slug}`
    : null

  async function handleCopy() {
    if (!publicLink) return
    await navigator.clipboard.writeText(publicLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleWhatsApp() {
    if (!publicLink) return
    const msg = encodeURIComponent(
      `Hola, te dejo el link para que completes la ficha de visita: ${publicLink}`,
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  async function archive(id: string, archived: boolean) {
    setBusyId(id)
    try {
      const r = await apiFetch('properties', `/visit-forms/${id}/archive`, {
        method: 'PATCH',
        body: JSON.stringify({ archived }),
      })
      if (!r.ok) throw new Error('Error')
      setInternalRefresh((n) => n + 1)
    } finally {
      setBusyId(null)
    }
  }

  async function softDelete(id: string) {
    if (!confirm('¿Borrar esta ficha de visita? Esta acción no se puede deshacer.')) return
    setBusyId(id)
    try {
      const r = await apiFetch('properties', `/visit-forms/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Error')
      setInternalRefresh((n) => n + 1)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="bg-white rounded-card shadow-card border border-gray-100 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-control bg-gradient-to-br from-brand-pink to-[#ff5e3a] flex items-center justify-center text-white">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-ink">Fichas de visita</h2>
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {submitted.length}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Compartí el link con los visitantes para que completen su ficha después de la visita.
            </p>
          </div>
        </div>

        {publicLink && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleWhatsApp}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              WhatsApp
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado' : 'Copiar link'}
            </button>
          </div>
        )}
      </div>

      {/* Toggle archived */}
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          {showArchived ? 'Ocultar archivadas' : 'Ver archivadas'}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-10 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-brand-pink" />
        </div>
      ) : submitted.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-card">
          <EmptyState
            icon={<MessageSquare className="w-6 h-6" />}
            title="Todavía no hay fichas completadas."
            description={publicLink ? 'Mandá el link por WhatsApp después de cada visita.' : undefined}
          />
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {submitted.map((item) => (
            <SubmittedCard
              key={item.id}
              item={item}
              busy={busyId === item.id}
              onArchive={() => archive(item.id, !item.archived_at)}
              onDelete={() => softDelete(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SubmittedCard({
  item,
  busy,
  onArchive,
  onDelete,
}: {
  item: VisitForm
  busy: boolean
  onArchive: () => void
  onDelete: () => void
}) {
  const archived = item.archived_at !== null
  return (
    <div className={`py-4 ${archived ? 'opacity-60' : ''}`}>
      {/* Top row: name · date / rating · actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <h3 className="font-semibold text-ink truncate">
              {item.visitor_name || 'Visitante'}
            </h3>
            {archived && (
              <span className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                Archivada
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 ml-6">
            {item.submitted_at ? formatDate(item.submitted_at) : '—'}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {item.rating !== null && <Stars value={item.rating} />}
          <button
            type="button"
            disabled={busy}
            onClick={onArchive}
            title={archived ? 'Desarchivar' : 'Archivar'}
            className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            title="Borrar"
            className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Liked / Disliked */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        {item.liked && (
          <div className="rounded-lg bg-green-50/60 border border-green-100 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-green-700 mb-1">
              <ThumbsUp className="w-3.5 h-3.5" /> Le gustó
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.liked}</p>
          </div>
        )}
        {item.disliked && (
          <div className="rounded-lg bg-red-50/60 border border-red-100 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-red-700 mb-1">
              <ThumbsDown className="w-3.5 h-3.5" /> No le gustó
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.disliked}</p>
          </div>
        )}
      </div>

      {/* Badges row */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {item.buy_intention === 'compraria' && (
          <Badge color="green">Compraría</Badge>
        )}
        {item.buy_intention === 'no' && <Badge color="red">No compraría</Badge>}
        {item.buy_intention === 'tal_vez' && <Badge color="amber">Tal vez</Badge>}
        {item.situation && (
          <Badge color="gray">{SITUATION_LABEL[item.situation] ?? item.situation}</Badge>
        )}
        {item.source && (
          <Badge color="orange">Vía: {SOURCE_LABEL[item.source] ?? item.source}</Badge>
        )}
      </div>

      {/* Observations */}
      {item.observations && (
        <p className="mt-2 text-sm text-gray-600 italic">&ldquo;{item.observations}&rdquo;</p>
      )}
    </div>
  )
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-4 h-4 ${
            n <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-100'
          }`}
        />
      ))}
    </div>
  )
}

function Badge({
  color,
  children,
}: {
  color: 'green' | 'red' | 'amber' | 'gray' | 'orange'
  children: React.ReactNode
}) {
  const cls = {
    green: 'bg-green-100 text-green-800 border-green-200',
    red: 'bg-red-100 text-red-800 border-red-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    gray: 'bg-gray-100 text-gray-700 border-gray-200',
    orange: 'bg-orange-100 text-orange-800 border-orange-200',
  }[color]
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${cls}`}>
      {children}
    </span>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}
