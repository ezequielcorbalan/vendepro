'use client'

import { useState, useEffect, useCallback } from 'react'
import { MessageSquare, Send, Check, Clock, AlertTriangle, Bot, ArrowUpRight, User as UserIcon } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Button } from '@/components/ui/Button'
import { Textarea, Select } from '@/components/ui/Input'
import { Heading, Text } from '@/components/ui/Typography'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { StageBadge } from '@/components/ui/StageBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Alert } from '@/components/ui/Alert'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'

interface Conversation {
  id: string
  channel: string
  lead: { id: string; full_name: string | null; stage: string | null; pipeline: string } | null
  status: 'open' | 'pending' | 'resolved'
  contact_id: string | null
  contact_name: string | null
  assignee_id: string | null
  assignee_name: string | null
  labels: string[]
  last_message: string | null
  last_activity_at: string | null
  window_open: boolean
}

interface Message {
  id: string
  direction: 'in' | 'out'
  sender_type: 'contact' | 'agent' | 'bot'
  sender_name: string | null
  content: string | null
  attachments: Array<{ type: string }>
  created_at: string
}

const ESTADO: Record<string, { label: string; color: string }> = {
  open: { label: 'Abierta', color: 'bg-success/10 text-success' },
  pending: { label: 'Pendiente', color: 'bg-warning/10 text-warning' },
  resolved: { label: 'Resuelta', color: 'bg-gray-100 text-gray-600' },
}

function hora(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const hoy = new Date().toDateString() === d.toDateString()
  return hoy
    ? d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export default function ConversacionesPage() {
  const { toast } = useToast()
  const [filtro, setFiltro] = useState<'open' | 'resolved'>('open')
  const [conversaciones, setConversaciones] = useState<Conversation[]>([])
  const [activa, setActiva] = useState<Conversation | null>(null)
  const [mensajes, setMensajes] = useState<Message[]>([])
  const [agentes, setAgentes] = useState<any[]>([])
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)

  const cargarBandeja = useCallback(() => {
    apiFetch('crm', `/conversations?status=${filtro}`)
      .then(r => r.json() as Promise<any>)
      .then(d => {
        const lista = Array.isArray(d) ? d : []
        setConversaciones(lista)
        setCargando(false)
      })
      .catch(() => setCargando(false))
  }, [filtro])

  useEffect(() => { setCargando(true); cargarBandeja() }, [cargarBandeja])

  useEffect(() => {
    apiFetch('admin', '/agents').then(r => r.json() as Promise<any>)
      .then(d => { if (Array.isArray(d)) setAgentes(d) }).catch(() => {})
  }, [])

  const abrir = async (c: Conversation) => {
    setActiva(c)
    setMensajes([])
    try {
      const res = await apiFetch('crm', `/conversations/${c.id}/messages`)
      const d = (await res.json()) as any
      setMensajes(Array.isArray(d) ? d : [])
    } catch { setMensajes([]) }
  }

  const enviar = async () => {
    if (!activa || !texto.trim()) return
    setEnviando(true)
    try {
      const res = await apiFetch('crm', `/conversations/${activa.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: texto.trim() }),
      })
      const d = (await res.json()) as any
      if (!res.ok) {
        // 409 = la org no tiene WhatsApp conectado; el resto, error del proveedor.
        toast(d?.error ?? 'No se pudo enviar', 'error')
      } else {
        setTexto('')
        abrir(activa)
        cargarBandeja()
      }
    } catch { toast('Error de conexión', 'error') }
    setEnviando(false)
  }

  const asignar = async (agentId: string) => {
    if (!activa) return
    try {
      await apiFetch('crm', `/conversations/${activa.id}/assignments`, {
        method: 'POST',
        body: JSON.stringify({ assignee_id: agentId || null }),
      })
      toast(agentId ? 'Conversación delegada' : 'Devuelta a la cola')
      cargarBandeja()
      setActiva({ ...activa, assignee_id: agentId || null })
    } catch { toast('No se pudo asignar', 'error') }
  }

  const alternarEstado = async () => {
    if (!activa) return
    try {
      const res = await apiFetch('crm', `/conversations/${activa.id}/toggle_status`, { method: 'POST' })
      const d = (await res.json()) as any
      setActiva({ ...activa, status: d.status })
      cargarBandeja()
    } catch { toast('No se pudo cambiar el estado', 'error') }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Conversaciones"
        subtitle="WhatsApp de la inmobiliaria, atado a los contactos del CRM"
        actions={
          <SegmentedControl
            value={filtro}
            onChange={v => { setFiltro(v as 'open' | 'resolved'); setActiva(null) }}
            options={[{ value: 'open', label: 'Abiertas' }, { value: 'resolved', label: 'Resueltas' }]}
          />
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Bandeja */}
        <Card padded={false} className="overflow-hidden max-h-[70vh] overflow-y-auto">
          {cargando ? (
            <div className="p-4"><Text tone="muted">Cargando…</Text></div>
          ) : conversaciones.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="w-6 h-6" />}
              title="Sin conversaciones"
              description="Cuando entre un mensaje al número conectado, aparece acá."
            />
          ) : (
            /* ds-todo: candidato a variante "list row seleccionable" — un
               Button ghost estirado hace de fila; se repite en cualquier
               bandeja (conversaciones, y el calendario tiene algo igual). */
            <div className="divide-y divide-gray-100">
              {conversaciones.map(c => (
                <Button
                  key={c.id}
                  variant="ghost"
                  onClick={() => abrir(c)}
                  className={cn(
                    'w-full h-auto flex-col items-stretch gap-0 text-left px-4 py-3 rounded-none',
                    activa?.id === c.id && 'bg-primary/5',
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
                    {c.labels?.includes('bot_pausado') && (
                      <StatusBadge label="Bot pausado" color="bg-gray-100 text-gray-600" size="sm" />
                    )}
                    {c.lead?.stage && (
                      <StageBadge stage={c.lead.stage} pipeline={c.lead.pipeline as any} size="sm" />
                    )}
                  </div>
                </Button>
              ))}
            </div>
          )}
        </Card>

        {/* Hilo */}
        {!activa ? (
          <Card className="grid place-items-center min-h-[320px]">
            <Text tone="muted">Elegí una conversación para verla.</Text>
          </Card>
        ) : (
          <Card padded={false} className="flex flex-col max-h-[70vh]">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar name={activa.contact_name ?? '?'} size="sm" />
                <div className="min-w-0">
                  <Heading level={4}>{activa.contact_name ?? 'Número desconocido'}</Heading>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <StatusBadge
                      label={ESTADO[activa.status]?.label ?? activa.status}
                      color={ESTADO[activa.status]?.color ?? 'bg-gray-100 text-gray-600'}
                      size="sm"
                    />
                    {/* El salto al trabajo comercial: sin esto la bandeja es un
                        chat aparte del CRM. */}
                    {activa.lead && (
                      <Button
                        href={`/leads/${activa.lead.id}`}
                        variant="ghost"
                        className="h-auto px-1.5 py-0.5 text-xs gap-1"
                        icon={<ArrowUpRight className="w-3 h-3" />}
                      >
                        Ver lead
                      </Button>
                    )}
                    {activa.contact_id && (
                      <Button
                        href={`/contactos/${activa.contact_id}`}
                        variant="ghost"
                        className="h-auto px-1.5 py-0.5 text-xs gap-1"
                        icon={<ArrowUpRight className="w-3 h-3" />}
                      >
                        Ver contacto
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  aria-label="Delegar a"
                  value={activa.assignee_id ?? ''}
                  onChange={e => asignar(e.target.value)}
                  className="w-auto"
                >
                  <option value="">Sin asignar</option>
                  {agentes.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                </Select>
                <Button variant="outline" icon={<Check className="w-3.5 h-3.5" />} onClick={alternarEstado}>
                  {activa.status === 'resolved' ? 'Reabrir' : 'Resolver'}
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {mensajes.length === 0 ? (
                <Text tone="muted">Sin mensajes todavía.</Text>
              ) : mensajes.map(m => (
                <div key={m.id} className={cn('flex', m.direction === 'out' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[75%] rounded-card px-3 py-2',
                    m.direction === 'out' ? 'bg-primary/10' : 'bg-gray-100',
                  )}>
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

            <div className="border-t border-gray-100 p-3 space-y-2">
              {!activa.window_open && (
                <Alert tone="warning" hideIcon>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-warning shrink-0" />
                    <Text size="xs">
                      Pasaron más de 24 h desde el último mensaje del cliente. Con la API oficial de
                      WhatsApp sólo se podría responder con una plantilla aprobada.
                    </Text>
                  </div>
                </Alert>
              )}
              <div className="flex items-end gap-2">
                <Textarea
                  rows={2}
                  placeholder="Escribí tu respuesta…"
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={enviar} loading={enviando} disabled={!texto.trim()} icon={<Send className="w-3.5 h-3.5" />}>
                  Enviar
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* ds-todo: candidato a variante "split view" (lista + detalle) — se repite
          en conversaciones y podría servir al calendario. */}
      <Text size="xs" tone="muted" className="flex items-center gap-1.5">
        <AlertTriangle className="w-3 h-3" />
        El canal usa un proveedor no oficial de WhatsApp mientras se tramita el alta en Meta.
      </Text>
    </div>
  )
}
