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
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Heading, Text } from '@/components/ui/Typography'

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
    <Card className="p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-5 h-5 text-gray-600 mt-0.5" aria-hidden="true" />
          <div>
            <div className="flex items-center gap-2">
              <Heading level={4}>Fichas de visita</Heading>
              <Badge tone="neutral">{submitted.length}</Badge>
            </div>
            <Text size="xs" tone="muted" className="mt-0.5">
              Compartí el link con los visitantes para que completen su ficha después de la visita.
            </Text>
          </div>
        </div>

        {publicLink && (
          <div className="flex items-center gap-2">
            {/* ds-todo: WhatsAppButton requiere número; acá es wa.me sólo con texto (compartir) */}
            <button
              type="button"
              onClick={handleWhatsApp}
              className="inline-flex items-center gap-2 text-sm font-medium text-white bg-whatsapp hover:opacity-90 px-4 py-2 rounded-control transition-opacity"
            >
              <MessageSquare className="w-4 h-4" aria-hidden="true" />
              WhatsApp
            </button>
            <Button variant="outline" onClick={handleCopy}>
              {copied ? <Check className="w-4 h-4 text-success" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
              {copied ? 'Copiado' : 'Copiar link'}
            </Button>
          </div>
        )}
      </div>

      {/* Toggle archived */}
      <div className="flex justify-end mb-3">
        <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? 'Ocultar archivadas' : 'Ver archivadas'}
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-10 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" aria-hidden="true" />
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
    </Card>
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
            <User className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
            <Text size="sm" weight="semibold" className="truncate">
              {item.visitor_name || 'Visitante'}
            </Text>
            {archived && <Badge tone="neutral">Archivada</Badge>}
          </div>
          <Text size="xs" tone="muted" className="ml-6">
            {item.submitted_at ? formatDate(item.submitted_at) : '—'}
          </Text>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {item.rating !== null && <Stars value={item.rating} />}
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            onClick={onArchive}
            title={archived ? 'Desarchivar' : 'Archivar'}
            aria-label={archived ? 'Desarchivar ficha' : 'Archivar ficha'}
            className="text-gray-400 hover:text-gray-700"
          >
            {archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            onClick={onDelete}
            title="Borrar"
            aria-label="Borrar ficha"
            className="text-gray-400 hover:text-danger hover:bg-danger/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Liked / Disliked */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        {item.liked && (
          <div className="rounded-control bg-success/10 border border-success/20 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-success mb-1">
              <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" /> Le gustó
            </div>
            <Text size="sm" className="text-gray-700 whitespace-pre-wrap">{item.liked}</Text>
          </div>
        )}
        {item.disliked && (
          <div className="rounded-control bg-danger/10 border border-danger/20 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-danger mb-1">
              <ThumbsDown className="w-3.5 h-3.5" aria-hidden="true" /> No le gustó
            </div>
            <Text size="sm" className="text-gray-700 whitespace-pre-wrap">{item.disliked}</Text>
          </div>
        )}
      </div>

      {/* Badges row */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {item.buy_intention === 'compraria' && <Badge tone="success">Compraría</Badge>}
        {item.buy_intention === 'no' && <Badge tone="danger">No compraría</Badge>}
        {item.buy_intention === 'tal_vez' && <Badge tone="warning">Tal vez</Badge>}
        {item.situation && (
          <Badge tone="neutral">{SITUATION_LABEL[item.situation] ?? item.situation}</Badge>
        )}
        {item.source && (
          <Badge tone="info">Vía: {SOURCE_LABEL[item.source] ?? item.source}</Badge>
        )}
      </div>

      {/* Observations */}
      {item.observations && (
        <Text size="sm" className="mt-2 text-gray-600 italic">"{item.observations}"</Text>
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
            n <= value ? 'text-yellow fill-yellow' : 'text-gray-200 fill-gray-100'
          }`}
        />
      ))}
    </div>
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
