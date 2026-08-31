'use client'

import { useEffect, useState } from 'react'
import {
  Loader2,
  MessageSquare,
  ClipboardList,
  Star,
  Archive,
  ArchiveRestore,
  Trash2,
  Copy,
  Check,
  User,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { EmptyState } from '@/components/ui/EmptyState'
import { Card } from '@/components/ui/Card'
import { WidgetHeader } from '@/components/ui/WidgetHeader'
import { Badge } from '@/components/ui/Badge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Text } from '@/components/ui/Typography'
import { VISIT_BUY_INTENTIONS, VISIT_SITUATIONS, VISIT_SOURCES, type VisitBuyIntention } from '@/lib/crm-config'

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
    <Card>
      <WidgetHeader
        size="lg"
        icon={<ClipboardList className="w-5 h-5" />}
        title="Fichas de visita"
        badge={<Badge tone="neutral">{submitted.length}</Badge>}
        subtitle="Compartí el link con los visitantes para que completen su ficha después de la visita."
        className="mb-4"
        action={publicLink ? (
          <>
            <Button variant="outline" size="sm" onClick={handleWhatsApp} icon={<MessageSquare className="w-4 h-4" />}>
              WhatsApp
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              icon={copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            >
              {copied ? 'Copiado' : 'Copiar link'}
            </Button>
          </>
        ) : undefined}
      />

      {/* Toggle archived */}
      <div className="flex justify-end mb-3">
        <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)} className="text-xs text-gray-500">
          {showArchived ? 'Ocultar archivadas' : 'Ver archivadas'}
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-10 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
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
            <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <h3 className="font-semibold text-ink truncate">
              {item.visitor_name || 'Visitante'}
            </h3>
            {archived && <StatusBadge size="sm" label="Archivada" />}
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
            aria-label={archived ? 'Desarchivar' : 'Archivar'}
            title={archived ? 'Desarchivar' : 'Archivar'}
            className="p-1.5 text-gray-400"
          >
            {archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            onClick={onDelete}
            aria-label="Borrar"
            title="Borrar"
            className="p-1.5 text-gray-400 hover:text-danger"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Liked / Disliked */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        {item.liked && (
          <Alert tone="success" title="Le gustó">
            <span className="whitespace-pre-wrap">{item.liked}</span>
          </Alert>
        )}
        {item.disliked && (
          <Alert tone="danger" title="No le gustó">
            <span className="whitespace-pre-wrap">{item.disliked}</span>
          </Alert>
        )}
      </div>

      {/* Badges row */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {item.buy_intention && VISIT_BUY_INTENTIONS[item.buy_intention as VisitBuyIntention] && (
          <Badge tone={VISIT_BUY_INTENTIONS[item.buy_intention as VisitBuyIntention].tone}>
            {VISIT_BUY_INTENTIONS[item.buy_intention as VisitBuyIntention].label}
          </Badge>
        )}
        {item.situation && (
          <Badge tone="neutral">{VISIT_SITUATIONS[item.situation] ?? item.situation}</Badge>
        )}
        {item.source && (
          <Badge tone="info">Vía: {VISIT_SOURCES[item.source] ?? item.source}</Badge>
        )}
      </div>

      {/* Observations */}
      {item.observations && (
        <Text size="sm" tone="muted" className="mt-2 italic">&ldquo;{item.observations}&rdquo;</Text>
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
            n <= value ? 'text-warning fill-warning' : 'text-gray-200 fill-gray-100'
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
