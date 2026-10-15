'use client'

import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import { Badge } from '@/components/ui/Badge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { StageBadge } from '@/components/ui/StageBadge'
import { cn } from '@/lib/utils'
import { nombreCanal, ETIQUETA_BOT_PAUSADO } from './canales'
import { hora, type Conversation } from './tipos'

/**
 * Una fila de la bandeja: quién, qué dijo último, de quién es y en qué anda.
 *
 * ds-todo: candidato a variante "list row seleccionable" — un Button ghost
 * estirado hace de fila; se repite en cualquier bandeja (conversaciones, y el
 * calendario tiene algo igual).
 */
export function FilaConversacion({ conversacion: c, activa, onAbrir }: {
  conversacion: Conversation
  activa: boolean
  onAbrir: () => void
}) {
  return (
    <Button
      variant="ghost"
      onClick={onAbrir}
      className={cn(
        'w-full h-auto flex-col items-stretch gap-0 text-left px-4 py-3 rounded-none',
        activa && 'bg-primary/5',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm text-ink truncate">
          {c.contact_name ?? 'Número desconocido'}
        </span>
        <Text size="xs" tone="muted">{hora(c.last_activity_at)}</Text>
      </div>
      <Text size="xs" tone="muted" className="truncate block mt-0.5">
        {c.last_message ?? 'Sin mensajes'}
      </Text>
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {c.assignee_name
          ? <Text size="xs" tone="muted">{c.assignee_name}</Text>
          : <StatusBadge label="Sin asignar" color="bg-warning/10 text-warning" size="sm" />}
        {c.channel !== 'whatsapp' && <Badge tone="info">{nombreCanal(c.channel)}</Badge>}
        {c.labels?.includes(ETIQUETA_BOT_PAUSADO) && (
          <StatusBadge label="Bot pausado" color="bg-gray-100 text-gray-600" size="sm" />
        )}
        {c.labels?.filter(l => l !== ETIQUETA_BOT_PAUSADO).map(l => (
          <Badge key={l} tone="primary">{l}</Badge>
        ))}
        {c.lead?.stage && (
          <StageBadge stage={c.lead.stage} pipeline={c.lead.pipeline as any} size="sm" />
        )}
      </div>
    </Button>
  )
}
