'use client'

import { useState, useEffect } from 'react'
import {
  Webhook as WebhookIcon, Plus, Trash2, Loader2, Copy, Check, AlertCircle,
  Eye, EyeOff, Send, ChevronDown, ChevronUp, CheckCircle2, XCircle,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { WEBHOOK_EVENTS, type WebhookEventKey } from '@/lib/crm-config'
import type { Webhook, WebhookDelivery } from '@/lib/types'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Text } from '@/components/ui/Typography'
import { Checkbox } from '@/components/ui/Choice'

const EVENT_KEYS = Object.keys(WEBHOOK_EVENTS) as WebhookEventKey[]

const fmtDate = (s: string | null) =>
  s ? new Date(s.replace(' ', 'T')).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

export default function WebhooksSection({ onCountChange }: { onCountChange?: (n: number) => void }) {
  const { toast } = useToast()

  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<WebhookEventKey[]>(['lead.created'])

  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  // Entregas recientes desplegadas por webhook
  const [openDeliveries, setOpenDeliveries] = useState<string | null>(null)
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([])
  const [deliveriesLoading, setDeliveriesLoading] = useState(false)

  function setList(next: Webhook[]) {
    setWebhooks(next)
    onCountChange?.(next.filter(w => w.is_active).length)
  }

  function load() {
    setLoading(true)
    setError(false)
    apiFetch('crm', '/webhooks')
      .then(r => r.json() as Promise<any>)
      .then(d => { setList(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const urlValid = /^https?:\/\/.+\..+/i.test(url.trim())

  async function handleCreate() {
    if (!urlValid || events.length === 0) return
    setSaving(true)
    try {
      const res = await apiFetch('crm', '/webhooks', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() || null, url: url.trim(), events }),
      })
      const data = (await res.json()) as any
      if (res.ok && data.id) {
        setList([data, ...webhooks])
        setShowCreate(false)
        setName(''); setUrl(''); setEvents(['lead.created'])
        setRevealedSecret(data.id)
        toast('Webhook creado. Copiá el secret para validar la firma en tu receptor.', 'success')
      } else {
        toast(data.error || 'No se pudo crear el webhook', 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    }
    setSaving(false)
  }

  async function handleToggle(w: Webhook) {
    try {
      const res = await apiFetch('crm', `/webhooks/${w.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !w.is_active }),
      })
      const data = (await res.json()) as any
      if (res.ok) {
        setList(webhooks.map(x => x.id === w.id ? { ...x, is_active: data.is_active } : x))
        toast(data.is_active ? 'Webhook activado' : 'Webhook pausado', data.is_active ? 'success' : 'warning')
      } else {
        toast(data.error || 'No se pudo actualizar', 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    }
  }

  async function handleDelete(w: Webhook) {
    const label = w.name || w.url
    if (!confirm(`¿Eliminar el webhook "${label}"? Dejará de recibir eventos y se borra su historial de entregas.`)) return
    try {
      await apiFetch('crm', `/webhooks/${w.id}`, { method: 'DELETE' })
      setList(webhooks.filter(x => x.id !== w.id))
      toast('Webhook eliminado', 'warning')
    } catch {
      toast('Error al eliminar', 'error')
    }
  }

  async function handleTest(w: Webhook) {
    setTestingId(w.id)
    try {
      const res = await apiFetch('crm', `/webhooks/${w.id}/test`, { method: 'POST' })
      const data = (await res.json()) as any
      if (data.ok) {
        toast(`Prueba OK — el receptor respondió ${data.status}`, 'success')
        setList(webhooks.map(x => x.id === w.id ? { ...x, last_triggered_at: new Date().toISOString() } : x))
      } else {
        toast(`La prueba falló: ${data.error || `HTTP ${data.status}`}`, 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    }
    setTestingId(null)
  }

  async function toggleDeliveries(w: Webhook) {
    if (openDeliveries === w.id) { setOpenDeliveries(null); return }
    setOpenDeliveries(w.id)
    setDeliveries([])
    setDeliveriesLoading(true)
    try {
      const res = await apiFetch('crm', `/webhooks/${w.id}/deliveries`)
      const data = (await res.json()) as any
      setDeliveries(Array.isArray(data) ? data : [])
    } catch {
      setDeliveries([])
    }
    setDeliveriesLoading(false)
  }

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(k => (k === key ? null : k)), 2000)
    } catch {
      toast('No se pudo copiar', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-gray-500">
          Avisamos a tu sistema (n8n, Zapier, etc.) con un POST JSON cuando ocurre un evento.
          Cada entrega va firmada con <code className="text-xs bg-gray-100 px-1 py-0.5 rounded font-mono">X-VendePro-Signature: sha256=HMAC(secret, body)</code>.
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="shrink-0 flex items-center gap-2 bg-gradient-to-br from-brand-pink to-brand-orange text-white px-4 py-2.5 rounded-control text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Nuevo webhook
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : error ? (
        <div className="bg-white rounded-card border">
          <EmptyState
            icon={<AlertCircle className="w-6 h-6" />}
            title="No se pudieron cargar los webhooks."
            action={<Button variant="outline" onClick={load}>Reintentar</Button>}
          />
        </div>
      ) : webhooks.length === 0 ? (
        <div className="bg-white rounded-card border">
          <EmptyState
            icon={<WebhookIcon className="w-6 h-6" />}
            title="Todavía no hay webhooks"
            description="Creá uno para que tu sistema reciba los eventos del CRM en tiempo real."
            action={<Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>Nuevo webhook</Button>}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(w => (
            <div key={w.id} className={`bg-white border rounded-card p-4 space-y-3 ${w.is_active ? '' : 'opacity-70'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`shrink-0 w-9 h-9 rounded-control flex items-center justify-center ${w.is_active ? 'bg-pink-50 text-brand-pink' : 'bg-gray-100 text-gray-400'}`}>
                    <WebhookIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    {w.name && <p className="font-medium text-ink truncate">{w.name}</p>}
                    <p className={`text-xs font-mono truncate ${w.name ? 'text-gray-500' : 'text-ink font-medium'}`}>{w.url}</p>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {/* Toggle activo/pausado */}
                  <button
                    onClick={() => handleToggle(w)}
                    role="switch"
                    aria-checked={w.is_active}
                    aria-label={w.is_active ? 'Pausar webhook' : 'Activar webhook'}
                    className={`relative w-10 h-6 rounded-full transition-colors ${w.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${w.is_active ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                  </button>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${w.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                    {w.is_active ? 'Activo' : 'Pausado'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {w.events.map(e => (
                  <span key={e} className="text-[10px] px-2 py-0.5 rounded-full bg-pink-50 text-brand-pink">
                    {WEBHOOK_EVENTS[e as WebhookEventKey]?.label ?? e}
                  </span>
                ))}
              </div>

              {/* Secret */}
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-50 border border-gray-200 rounded-control px-3 py-1.5 text-xs font-mono text-gray-600 truncate">
                  {revealedSecret === w.id ? w.secret : '••••••••••••••••••••••••'}
                </code>
                <button
                  onClick={() => setRevealedSecret(revealedSecret === w.id ? null : w.id)}
                  aria-label={revealedSecret === w.id ? 'Ocultar secret' : 'Mostrar secret'}
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-control text-gray-400 hover:text-gray-700 hover:bg-gray-50"
                >
                  {revealedSecret === w.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => copyText(w.secret, `secret-${w.id}`)}
                  aria-label="Copiar secret"
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-control text-gray-400 hover:text-gray-700 hover:bg-gray-50"
                >
                  {copiedKey === `secret-${w.id}` ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
                <p className="text-xs text-gray-500 tabular-nums">
                  Último disparo {fmtDate(w.last_triggered_at)}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleDeliveries(w)}
                    className="flex items-center gap-1 px-2.5 h-9 rounded-control text-xs font-medium text-gray-500 hover:text-ink hover:bg-gray-50"
                  >
                    Entregas {openDeliveries === w.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleTest(w)}
                    disabled={testingId === w.id}
                    className="flex items-center gap-1.5 px-2.5 h-9 rounded-control text-xs font-medium text-brand-pink hover:bg-pink-50 disabled:opacity-50"
                  >
                    {testingId === w.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Probar
                  </button>
                  <button
                    onClick={() => handleDelete(w)}
                    title="Eliminar webhook"
                    aria-label={`Eliminar webhook ${w.name || w.url}`}
                    className="w-9 h-9 flex items-center justify-center rounded-control text-gray-400 hover:text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Entregas recientes */}
              {openDeliveries === w.id && (
                <div className="border-t border-gray-100 pt-2">
                  {deliveriesLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
                  ) : deliveries.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2 text-center">Sin entregas todavía.</p>
                  ) : (
                    <ul className="divide-y divide-gray-50">
                      {deliveries.map(d => (
                        <li key={d.id} className="flex items-center gap-2 py-1.5 text-xs">
                          {d.status === 'success'
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                            : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                          <span className="font-mono text-gray-700">{d.event}</span>
                          <span className="text-gray-400">
                            {d.http_status ? `HTTP ${d.http_status}` : (d.error ?? 'sin respuesta')}
                            {d.attempts > 1 ? ` · ${d.attempts} intentos` : ''}
                          </span>
                          <span className="ml-auto text-gray-400 tabular-nums">{fmtDate(d.created_at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal crear */}
      {showCreate && (
        <Modal
          open
          sheet
          onClose={() => setShowCreate(false)}
          title="Nuevo webhook"
          icon={<Plus className="w-5 h-5" />}
          footer={
            <>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!urlValid || events.length === 0}
                loading={saving}
                icon={<Plus className="w-4 h-4" />}
              >
                Crear webhook
              </Button>
            </>
          }
        >
            <Text size="sm" tone="muted" className="block mb-4">
              Vamos a hacer un POST a esta URL cada vez que ocurra un evento seleccionado.
            </Text>

            <Field label="Nombre" htmlFor="webhook-name">
              <Input
                id="webhook-name"
                placeholder="Ej: n8n producción"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </Field>

            <Field label="URL" required htmlFor="webhook-url" className="mt-3">
              {/* ds-todo: candidato a prop "initialFocus" en Modal — el autoFocus
                  que tenía este campo no sirve adentro del Modal: useOverlay
                  enfoca el primer focusable del panel, que es la X del
                  encabezado. */}
              <Input
                id="webhook-url"
                placeholder="https://tu-n8n.com/webhook/vendepro"
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="font-mono"
              />
            </Field>

            <Field label="Eventos" required className="mt-3">
              <div className="space-y-2">
                {EVENT_KEYS.map(key => (
                  <Checkbox
                    key={key}
                    checked={events.includes(key)}
                    onChange={checked => setEvents(checked ? [...events, key] : events.filter(x => x !== key))}
                    label={`${WEBHOOK_EVENTS[key].label} — ${WEBHOOK_EVENTS[key].description}`}
                    className="items-start"
                  />
                ))}
              </div>
            </Field>
        </Modal>
      )}
    </div>
  )
}
