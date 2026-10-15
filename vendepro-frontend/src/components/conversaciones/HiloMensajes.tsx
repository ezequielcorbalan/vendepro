'use client'

import { Bot, User as UserIcon } from 'lucide-react'
import { Text } from '@/components/ui/Typography'
import { cn } from '@/lib/utils'
import { hora, type Message } from './tipos'

/** Los mensajes de una conversación: el cliente a la izquierda, nosotros a la derecha. */
export function HiloMensajes({ mensajes }: { mensajes: Message[] }) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {mensajes.length === 0 ? (
        <Text tone="muted">Sin mensajes todavía.</Text>
      ) : mensajes.map(m => (
        <div key={m.id} className={cn('flex', m.direction === 'out' ? 'justify-end' : 'justify-start')}>
          <div className={cn('max-w-[75%] rounded-card px-3 py-2', m.direction === 'out' ? 'bg-primary/10' : 'bg-gray-100')}>
            <div className="flex items-center gap-1.5 mb-0.5">
              {m.sender_type === 'bot'
                ? <Bot className="w-3 h-3 text-gray-400" />
                : <UserIcon className="w-3 h-3 text-gray-400" />}
              <Text size="xs" tone="muted">
                {m.sender_type === 'bot' ? 'Bot' : m.sender_name ?? (m.direction === 'in' ? 'Cliente' : 'Agente')}
                {' · '}{hora(m.created_at)}
              </Text>
            </div>
            <Text size="sm">{m.content ?? `[${m.attachments?.[0]?.type ?? 'adjunto'}]`}</Text>
          </div>
        </div>
      ))}
    </div>
  )
}
