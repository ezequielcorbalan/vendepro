'use client'

import { Check, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { Heading } from '@/components/ui/Typography'
import { Badge } from '@/components/ui/Badge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Avatar } from '@/components/ui/Avatar'
import { EtiquetasConversacion } from './EtiquetasConversacion'
import { nombreCanal } from './canales'
import { ESTADO, type Conversation } from './tipos'

/**
 * Arriba del hilo: con quién se habla, por qué canal, el salto al lead, de
 * quién es la conversación y sus etiquetas.
 */
interface EncabezadoConversacionProps {
  conversacion: Conversation
  /** Admin, owner o supervisor: delega a cualquiera. */
  reparte: boolean
  /** El usuario logueado, para ofrecerle devolver a la cola lo suyo. */
  usuarioId: string | null
  agentes: Array<{ id: string; full_name: string }>
  etiquetasOrg: string[]
  onAsignar: (agentId: string) => void
  onAlternarEstado: () => void
  onCambiarEtiquetas: (labels: string[]) => void
}

export function EncabezadoConversacion({
  conversacion: c, reparte, usuarioId, agentes, etiquetasOrg,
  onAsignar, onAlternarEstado, onCambiarEtiquetas,
}: EncabezadoConversacionProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar name={c.contact_name ?? '?'} size="sm" />
          <div className="min-w-0">
            <Heading level={4}>{c.contact_name ?? 'Número desconocido'}</Heading>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <StatusBadge
                label={ESTADO[c.status]?.label ?? c.status}
                color={ESTADO[c.status]?.color ?? 'bg-gray-100 text-gray-600'}
                size="sm"
              />
              <Badge tone="neutral">{nombreCanal(c.channel)}</Badge>
              {/* El salto al trabajo comercial: sin esto la bandeja es un
                  chat aparte del CRM. */}
              {c.lead && (
                <Button href={`/leads/${c.lead.id}`} variant="ghost" className="h-auto px-1.5 py-0.5 text-xs gap-1" icon={<ArrowUpRight className="w-3 h-3" />}>
                  Ver lead
                </Button>
              )}
              {c.contact_id && (
                <Button href={`/contactos/${c.contact_id}`} variant="ghost" className="h-auto px-1.5 py-0.5 text-xs gap-1" icon={<ArrowUpRight className="w-3 h-3" />}>
                  Ver contacto
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {reparte ? (
            <Select aria-label="Delegar a" value={c.assignee_id ?? ''} onChange={e => onAsignar(e.target.value)} className="w-auto">
              <option value="">Sin asignar</option>
              {agentes.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </Select>
          ) : c.assignee_id === usuarioId && (
            <Button variant="ghost" onClick={() => onAsignar('')}>Devolver a la cola</Button>
          )}
          <Button variant="outline" icon={<Check className="w-3.5 h-3.5" />} onClick={onAlternarEstado}>
            {c.status === 'resolved' ? 'Reabrir' : 'Resolver'}
          </Button>
        </div>
      </div>
      <div className="px-4 py-2 border-b border-gray-100">
        <EtiquetasConversacion etiquetas={c.labels ?? []} sugeridas={etiquetasOrg} onCambiar={onCambiarEtiquetas} />
      </div>
    </>
  )
}
