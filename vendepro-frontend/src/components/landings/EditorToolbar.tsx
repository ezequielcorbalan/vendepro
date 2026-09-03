'use client'
import { useState } from 'react'
import { ArrowLeft, BarChart3, History, Settings, Eye, Send, CheckCircle2, XCircle } from 'lucide-react'
import type { Landing } from '@/lib/landings/types'
import { publicLandingHostPath } from '@/lib/landings/slug'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { LANDING_STATUSES } from '@/lib/crm-config'
import { Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Heading, Text } from '@/components/ui/Typography'

interface Props {
  landing: Landing
  isAdmin: boolean
  dirty: boolean
  saving: boolean
  onOpenVersions: () => void
  onOpenConfig: () => void
  onOpenAnalytics: () => void
  onOpenPreview: () => void
  onRequestPublish: () => Promise<void>
  onPublish: () => Promise<void>
  onRejectPublish: (note: string) => Promise<void>
}

export default function EditorToolbar({ landing, isAdmin, dirty, saving, onOpenVersions, onOpenConfig, onOpenAnalytics, onOpenPreview, onRequestPublish, onPublish, onRejectPublish }: Props) {
  const [busy, setBusy] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [note, setNote] = useState('')

  async function handle(fn: () => Promise<void>) {
    setBusy(true); try { await fn() } finally { setBusy(false) }
  }

  return (
    <header className="h-14 px-4 flex items-center gap-4 bg-white border-b border-gray-200 sticky top-0 z-30">
      <Button href="/landings" variant="ghost" size="icon" aria-label="Volver a Landings"><ArrowLeft className="w-4 h-4" /></Button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Heading level={4} as="h1" className="truncate">{landing.seo_title || landing.full_slug}</Heading>
          <StatusBadge label={LANDING_STATUSES[landing.status]?.label ?? landing.status} color={LANDING_STATUSES[landing.status]?.color} />
          {saving && <Text size="xs" tone="muted">Guardando…</Text>}
          {!saving && dirty && <Text size="xs" className="text-warning">Sin guardar</Text>}
        </div>
        <Text size="xs" tone="muted" className="truncate">{publicLandingHostPath(landing.full_slug)}</Text>
      </div>

      <Button onClick={onOpenVersions} variant="ghost" size="icon" aria-label="Versiones" title="Versiones"><History className="w-4 h-4 text-gray-600" /></Button>
      <Button onClick={onOpenConfig} variant="ghost" size="icon" aria-label="Configuración" title="Configuración"><Settings className="w-4 h-4 text-gray-600" /></Button>
      <Button onClick={onOpenAnalytics} variant="ghost" size="icon" aria-label="Analytics" title="Analytics"><BarChart3 className="w-4 h-4 text-gray-600" /></Button>
      <Button onClick={onOpenPreview} variant="ghost" size="icon" aria-label="Vista previa" title="Vista previa"><Eye className="w-4 h-4 text-gray-600" /></Button>

      {landing.status === 'draft' && !isAdmin && (
        <Button onClick={() => handle(onRequestPublish)} loading={busy} icon={<Send className="w-4 h-4" />} className="rounded-full">
          Solicitar publicación
        </Button>
      )}
      {landing.status === 'draft' && isAdmin && (
        <Button variant="success" onClick={() => handle(onPublish)} loading={busy} icon={<CheckCircle2 className="w-4 h-4" />} className="rounded-full">
          Publicar
        </Button>
      )}
      {landing.status === 'pending_review' && isAdmin && (
        <div className="flex items-center gap-2">
          <Button variant="success" onClick={() => handle(onPublish)} loading={busy} icon={<CheckCircle2 className="w-4 h-4" />} className="rounded-full">
            Aprobar y publicar
          </Button>
          <Button variant="outline" onClick={() => setShowReject(true)} icon={<XCircle className="w-4 h-4" />} className="rounded-full">
            Rechazar
          </Button>
        </div>
      )}

      <Modal
        open={showReject}
        onClose={() => setShowReject(false)}
        title="Rechazar solicitud"
        danger
        icon={<XCircle className="w-4 h-4" />}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowReject(false)}>Cancelar</Button>
            <Button variant="danger" onClick={() => { handle(() => onRejectPublish(note)); setShowReject(false) }}>Rechazar</Button>
          </div>
        }
      >
        <Textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Nota para el agente (opcional)…"
          className="resize-none h-28"
        />
      </Modal>
    </header>
  )
}
