'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  KeyRound, Plus, Trash2, Loader2, ArrowLeft, Copy, Check,
  AlertCircle, ShieldAlert, ShieldOff, Radio, Play, RotateCcw,
  Webhook as WebhookIcon,
} from 'lucide-react'
import { apiFetch, getApiBase } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { getCurrentUser } from '@/lib/auth'
import { API_SCOPES } from '@/lib/crm-config'
import WebhooksSection from '@/components/configuracion/WebhooksSection'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Heading, Text } from '@/components/ui/Typography'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tabs } from '@/components/ui/Tabs'
import { Modal } from '@/components/ui/Modal'
import { Field, Input, Textarea } from '@/components/ui/Input'
import type { ApiToken } from '@/lib/types'

const IMPORT_ENDPOINT = `${getApiBase('public')}/v1/leads`

// Ejemplo de request. Con el token real queda listo para copiar/pegar.
function buildCurl(token = '<TU_TOKEN>'): string {
  return `curl -X POST ${IMPORT_ENDPOINT} \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "full_name": "Juan Pérez",
    "phone": "+54 9 11 5555-5555",
    "email": "juan@example.com",
    "operation": "venta",
    "source_detail": "Prueba desde Configuración de API",
    "notes": "Lead de prueba"
  }'`
}

// El JWT de integración lleva el id del token (tid) en su payload, así podemos
// saber qué token vigilar en la prueba en vivo aunque el usuario lo pegue.
function decodeTid(jwt: string): string | null {
  try {
    const part = jwt.split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
    const json = JSON.parse(atob(b64 + pad))
    return typeof json.tid === 'string' ? json.tid : null
  } catch {
    return null
  }
}

type Tab = 'tokens' | 'webhooks' | 'test'

export default function ConfiguracionApiPage() {
  const { toast } = useToast()
  const user = getCurrentUser()
  const isAdmin = user?.role === 'admin' || user?.role === 'owner'

  const [tab, setTab] = useState<Tab>('tokens')

  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')

  // Token recién creado — se muestra UNA sola vez en claro
  const [newToken, setNewToken] = useState<{ id: string; name: string; token: string } | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Prueba en vivo
  const [testToken, setTestToken] = useState('')
  const [testStatus, setTestStatus] = useState<'idle' | 'waiting' | 'done'>('idle')
  const [testBaseline, setTestBaseline] = useState<string | null>(null)

  function loadTokens() {
    setLoading(true)
    setError(false)
    apiFetch('crm', '/api-tokens')
      .then(r => r.json() as Promise<any>)
      .then(d => { setTokens(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    loadTokens()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate() {
    if (name.trim().length < 2) return
    setSaving(true)
    try {
      const res = await apiFetch('crm', '/api-tokens', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = (await res.json()) as any
      if (data.token) {
        setNewToken({ id: data.id, name: data.name, token: data.token })
        setShowCreate(false)
        setName('')
        loadTokens()
        // Deja el token cargado en la prueba en vivo y salta a esa pestaña.
        setTestToken(data.token)
        setTestBaseline(null)
        setTestStatus('waiting')
        setTab('test')
      } else {
        toast(data.error || 'No se pudo crear el token', 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    }
    setSaving(false)
  }

  async function handleRevoke(id: string, tokenName: string) {
    if (!confirm(`¿Revocar el token "${tokenName}"? Las integraciones que lo usen dejarán de funcionar.`)) return
    try {
      await apiFetch('crm', `/api-tokens/${id}`, { method: 'DELETE' })
      toast('Token revocado', 'warning')
      setTokens(prev => prev.map(t => t.id === id ? { ...t, is_active: false } : t))
    } catch {
      toast('Error al revocar', 'error')
    }
  }

  async function handleDelete(token: ApiToken) {
    const warning = token.is_active
      ? `¿Eliminar el token "${token.name}"? Las integraciones que lo usen dejarán de funcionar y desaparece de la lista. No se puede deshacer.`
      : `¿Eliminar definitivamente el token "${token.name}"? No se puede deshacer.`
    if (!confirm(warning)) return
    try {
      await apiFetch('crm', `/api-tokens/${token.id}?permanent=1`, { method: 'DELETE' })
      toast('Token eliminado', 'warning')
      setTokens(prev => prev.filter(t => t.id !== token.id))
    } catch {
      toast('Error al eliminar', 'error')
    }
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

  async function startTest() {
    const tid = decodeTid(testToken.trim())
    if (!tid) { toast('Pegá un token de integración válido', 'error'); return }
    // baseline: último uso actual, para detectar el próximo request.
    let baseline: string | null = null
    try {
      const res = await apiFetch('crm', '/api-tokens')
      const list = (await res.json()) as any
      const t = Array.isArray(list) ? list.find((x: any) => x.id === tid) : null
      baseline = t?.last_used_at ?? null
    } catch { /* seguimos con baseline null */ }
    setTestBaseline(baseline)
    setTestStatus('waiting')
  }

  // Polling: `last_used_at` sólo cambia cuando un request autenticado llega a
  // /v1/leads, así que su cambio respecto al baseline confirma la prueba.
  useEffect(() => {
    if (testStatus !== 'waiting') return
    const tid = decodeTid(testToken.trim())
    if (!tid) return
    let cancelled = false
    const poll = setInterval(async () => {
      try {
        const res = await apiFetch('crm', '/api-tokens')
        const list = (await res.json()) as any
        const t = Array.isArray(list) ? list.find((x: any) => x.id === tid) : null
        if (!cancelled && t?.last_used_at && t.last_used_at !== testBaseline) {
          setTestStatus('done')
          setTokens(prev => prev.map(x => x.id === tid ? { ...x, last_used_at: t.last_used_at } : x))
        }
      } catch { /* reintenta en el próximo tick */ }
    }, 3000)
    return () => { cancelled = true; clearInterval(poll) }
  }, [testStatus, testToken, testBaseline])

  const fmtDate = (s: string | null) =>
    s ? new Date(s.replace(' ', 'T')).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

  const activeCount = tokens.filter(t => t.is_active).length
  const [webhookCount, setWebhookCount] = useState<number | null>(null)

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-16">
        <EmptyState
          icon={<ShieldAlert className="w-7 h-7" />}
          title="Acceso restringido"
          description="Sólo administradores pueden gestionar tokens de API."
          action={
            <Link href="/configuracion" className="inline-flex items-center gap-2 text-sm text-primary">
              <ArrowLeft className="w-4 h-4" /> Volver a Configuración
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header propio (pantalla con back-nav) */}
      <div>
        <Link href="/configuracion" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-ink mb-4">
          <ArrowLeft className="w-4 h-4" /> Volver a Configuración
        </Link>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-ink flex items-center gap-2">
              <KeyRound className="w-6 h-6 text-gray-600" /> Configuración de API
            </h1>
            <Text tone="muted" className="mt-1">Tokens para importar leads y webhooks para avisar a tus sistemas cuando pasa algo en el CRM.</Text>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            icon={<Plus className="w-4 h-4" />}
            className="shrink-0"
          >
            Nuevo token
          </Button>
        </div>
      </div>

      {/* Token recién creado — visible una sola vez, por encima de las tabs */}
      {newToken && (
        <Alert tone="warning" title={`Token “${newToken.name}” creado`} className="[&>div]:flex-1">
          <p>
            Copialo ahora: por seguridad <strong>no vas a poder verlo de nuevo</strong>. Ya lo dejamos cargado en <em>Prueba en vivo</em>.
          </p>
          <div className="mt-3 flex items-stretch gap-2">
            <code className="flex-1 bg-white border border-gray-200 rounded-control px-3 py-2 text-xs font-mono text-gray-700 break-all">
              {newToken.token}
            </code>
            <Button
              onClick={() => copyText(newToken.token, 'token')}
              aria-label="Copiar token al portapapeles"
              icon={copiedKey === 'token' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              className="shrink-0"
            >
              {copiedKey === 'token' ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
          <Button variant="ghost" onClick={() => setNewToken(null)} className="mt-2 -ml-3">
            Ya lo guardé, ocultar
          </Button>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs
        items={[
          { value: 'tokens', label: 'Tokens', icon: <KeyRound className="w-4 h-4" />, count: activeCount || undefined },
          { value: 'webhooks', label: 'Webhooks', icon: <WebhookIcon className="w-4 h-4" />, count: webhookCount || undefined },
          { value: 'test', label: 'Prueba en vivo', icon: <Radio className="w-4 h-4" /> },
        ]}
        value={tab}
        onChange={v => setTab(v as Tab)}
      />

      {/* ── TAB: TOKENS (grilla) ─────────────────────────────── */}
      {tab === 'tokens' && (
        <div role="tabpanel">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : error ? (
            <Card padded={false}>
              <EmptyState
                icon={<AlertCircle className="w-7 h-7" />}
                title="No se pudieron cargar los tokens"
                action={<Button variant="outline" onClick={loadTokens}>Reintentar</Button>}
              />
            </Card>
          ) : tokens.length === 0 ? (
            <Card padded={false}>
              <EmptyState
                icon={<KeyRound className="w-7 h-7" />}
                title="Todavía no hay tokens"
                description="Creá un token para conectar una integración que importe leads."
                action={
                  <Button onClick={() => setShowCreate(true)} icon={<Plus className="w-4 h-4" />}>
                    Nuevo token
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tokens.map(token => (
                <Card
                  key={token.id}
                  className={`p-4 flex flex-col gap-3 ${token.is_active ? '' : 'opacity-70'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`shrink-0 w-9 h-9 rounded-control flex items-center justify-center ${token.is_active ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'}`}>
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <Text size="base" weight="medium" className="truncate">{token.name}</Text>
                    </div>
                    <Badge tone={token.is_active ? 'success' : 'neutral'} className="shrink-0">
                      {token.is_active ? 'Activo' : 'Revocado'}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {token.scopes?.map(s => (
                      <Badge key={s} tone="primary">
                        {API_SCOPES[s as keyof typeof API_SCOPES]?.label ?? s}
                      </Badge>
                    ))}
                  </div>

                  <Text size="xs" tone="muted" className="font-mono truncate">{token.prefix}</Text>

                  <div className="flex items-end justify-between gap-2 mt-auto pt-1 border-t border-gray-100">
                    <Text size="xs" tone="muted" className="tabular-nums leading-relaxed">
                      Creado {fmtDate(token.created_at)}<br />
                      Último uso {fmtDate(token.last_used_at)}
                    </Text>
                    <div className="shrink-0 flex items-center -mr-1 -mb-1">
                      {token.is_active && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRevoke(token.id, token.name)}
                          title="Revocar token (queda en la lista, deja de funcionar)"
                          aria-label={`Revocar token ${token.name}`}
                          className="w-11 h-11 p-0 text-gray-400 hover:text-warning hover:bg-warning/10"
                        >
                          <ShieldOff className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(token)}
                        title="Eliminar token definitivamente"
                        aria-label={`Eliminar token ${token.name}`}
                        className="w-11 h-11 p-0 text-gray-400 hover:text-danger hover:bg-danger/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: WEBHOOKS ────────────────────────────────────── */}
      {tab === 'webhooks' && (
        <div role="tabpanel">
          <WebhooksSection onCountChange={setWebhookCount} />
        </div>
      )}

      {/* ── TAB: PRUEBA EN VIVO ──────────────────────────────── */}
      {tab === 'test' && (
        <div role="tabpanel" className="space-y-5">
          {/* Paso 1: token */}
          <Card>
            <Heading level={4} className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center">1</span>
              Tu token
            </Heading>
            <Text tone="muted" className="mb-3">
              Pegá el token de integración que querés probar. Si acabás de crear uno, ya está cargado.
            </Text>
            <Textarea
              value={testToken}
              onChange={e => { setTestToken(e.target.value); setTestStatus('idle') }}
              placeholder="eyJhbGciOi..."
              rows={2}
              className="text-xs font-mono resize-none min-h-0 px-3 py-2.5"
            />
          </Card>

          {/* Paso 2: request de ejemplo */}
          <Card>
            <div className="flex items-center justify-between gap-2 mb-1">
              <Heading level={4} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center">2</span>
                Hacé el request
              </Heading>
              <Button variant="ghost" size="icon"
                onClick={() => copyText(buildCurl(testToken.trim() || undefined), 'curl')}
                aria-label="Copiar comando de ejemplo"
                className="p-0 flex items-center gap-1.5 text-xs font-medium text-primary hover:opacity-80"
              >
                {copiedKey === 'curl' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey === 'curl' ? 'Copiado' : 'Copiar comando'}
              </Button>
            </div>
            <Text tone="muted" className="mb-3">
              Acepta un lead o varios (<code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{'{ "leads": [...] }'}</code>, hasta 100).
              Entran sin asignar, en estado <strong>Nuevo</strong>.
            </Text>
            <div className="overflow-x-auto">
              <pre className="bg-gray-900 text-gray-100 rounded-control p-4 text-xs leading-relaxed">{buildCurl(testToken.trim() || undefined)}</pre>
            </div>
            <Text size="xs" tone="muted" className="mt-2">
              Campos: <code className="font-mono">full_name</code> (requerido), <code className="font-mono">phone</code>,{' '}
              <code className="font-mono">email</code>, <code className="font-mono">operation</code>,{' '}
              <code className="font-mono">source_detail</code>, <code className="font-mono">notes</code>.
            </Text>
          </Card>

          {/* Paso 3: escuchar en vivo */}
          <Card>
            <Heading level={4} className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center">3</span>
              Prueba en vivo
            </Heading>
            <Text tone="muted" className="mb-3">
              Iniciá la escucha y ejecutá el comando. Vamos a detectar el primer request que llegue con este token.
            </Text>

            <div aria-live="polite">
              {testStatus === 'idle' && (
                <Button
                  onClick={startTest}
                  disabled={!testToken.trim()}
                  icon={<Play className="w-4 h-4" />}
                >
                  Empezar prueba
                </Button>
              )}

              {testStatus === 'waiting' && (
                <Alert tone="warning" hideIcon className="px-4 py-3 [&>div]:flex-1">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-warning" />
                    </span>
                    <p className="flex-1">
                      Escuchando… ejecutá el comando de arriba para enviar tu lead de prueba.
                    </p>
                    <Loader2 className="w-4 h-4 animate-spin text-warning shrink-0" />
                    <Button variant="ghost" size="sm"
                      onClick={() => setTestStatus('idle')}
                      className="p-0 text-xs text-gray-600 underline shrink-0"
                    >
                      Cancelar
                    </Button>
                  </div>
                </Alert>
              )}

              {testStatus === 'done' && (
                <Alert tone="success" className="px-4 py-3 [&>div]:flex-1">
                  <div className="flex items-center gap-3">
                    <p className="flex-1">
                      <strong>¡Recibimos tu lead de prueba!</strong> La integración está funcionando. Aparece en <strong>Leads</strong>, sin asignar.
                    </p>
                    <Button variant="ghost" size="sm"
                      onClick={() => { setTestBaseline(null); setTestStatus('idle') }}
                      className="p-0 flex items-center gap-1.5 text-xs font-medium text-success hover:opacity-80 shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Probar de nuevo
                    </Button>
                  </div>
                </Alert>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Modal crear */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nuevo token de API"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={name.trim().length < 2 || saving}
              loading={saving}
              icon={<Plus className="w-4 h-4" />}
            >
              {saving ? 'Creando...' : 'Crear token'}
            </Button>
          </>
        }
      >
        <Text tone="muted" className="mb-4">Poné un nombre que te ayude a reconocer la integración.</Text>
        <Field label="Nombre" required>
          <Input
            autoFocus
            placeholder="Ej: Zapier, Landing propia, Portal X"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
          />
        </Field>
        <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
          <Badge tone="primary">Importar leads</Badge>
          <span>Permiso incluido</span>
        </div>
      </Modal>
    </div>
  )
}
